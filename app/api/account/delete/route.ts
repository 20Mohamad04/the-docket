import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Permanently deletes an account: the Stripe subscription, every row the user
// owns, and finally the auth record itself. There is no undo and no soft-delete
// flag — the user has typed their own email to get here.
//
// Server-side because it has to be. Deleting an auth.users row needs
// supabase.auth.admin.deleteUser(), which requires the service-role key, and
// that key must never reach a browser. The row deletions could technically run
// client-side under RLS, but splitting the operation across two trust domains
// would mean a half-deleted account whenever the client navigated away
// mid-flight.

// Constructed lazily, not at module scope — the Stripe SDK throws
// synchronously on a missing key, and a module-scope throw runs at build time,
// failing the whole production build over one absent secret. Same reasoning as
// the other Stripe routes.
let stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripe) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2026-07-29.dahlia" as any,
    });
  }
  return stripe;
}

// Service-role client — bypasses RLS. Server-only.
function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function getSupabaseForToken(accessToken: string): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false },
  });
}

// Identity comes from the caller's own verified token, never from the request
// body. A userId parameter here would let anyone who knew a UUID delete that
// account outright.
async function authenticateRequest(
  req: Request
): Promise<{ id: string; email: string | null } | null> {
  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
  const token = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  const sb = getSupabaseForToken(token);
  if (!sb) return null;
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data?.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}

// Every table carrying a user_id. Ordered deliberately: chat_messages before
// conversations, since messages belong to a conversation and orphaning them
// would leave rows nothing can reach. The rest are independent.
//
// Adding a user-owned table and forgetting to add it here leaves that user's
// data behind after they have asked for it to be erased, which is a UK GDPR
// problem, not just untidiness.
const USER_TABLES = [
  "chat_messages",
  "conversations",
  "user_memories",
  "tasks",
  "routines",
  "usage",
  "subscriptions",
] as const;

export async function POST(req: Request) {
  try {
    const caller = await authenticateRequest(req);
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Second gate, server side. The UI already requires the user to type their
    // address, but a client-side check is a suggestion — this is the one that
    // actually holds. Compared case-insensitively because email is
    // case-insensitive in practice and nobody should lose their account over a
    // capital letter.
    let body: { confirmEmail?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Malformed request" }, { status: 400 });
    }
    const confirm = (body.confirmEmail ?? "").trim().toLowerCase();
    if (!confirm || !caller.email || confirm !== caller.email.toLowerCase()) {
      return NextResponse.json(
        { error: "Confirmation email does not match this account." },
        { status: 400 }
      );
    }

    const sb = getSupabaseAdmin();
    if (!sb) {
      console.error("[account/delete] Supabase admin client unavailable");
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    // ── 1. Stripe first, and fatally ────────────────────────────────────
    // Before anything is destroyed, because this is the only step whose
    // failure leaves the user actively worse off: an account they can no
    // longer sign into, still being billed every month, with no way to cancel
    // it themselves. Aborting here costs them nothing — nothing has been
    // deleted yet — so a failure returns and asks them to contact support
    // rather than pressing on.
    //
    // Cancelled immediately rather than at period end: the account is about to
    // stop existing, so leaving the subscription to lapse would only bill for
    // access nobody can use.
    const { data: subRow, error: subReadErr } = await sb
      .from("subscriptions")
      .select("stripe_subscription_id")
      .eq("user_id", caller.id)
      .maybeSingle();

    if (subReadErr) {
      console.error("[account/delete] Could not read subscription row:", subReadErr);
      return NextResponse.json(
        { error: "Could not verify your subscription. Nothing has been deleted — please contact support." },
        { status: 500 }
      );
    }

    if (subRow?.stripe_subscription_id) {
      try {
        await getStripe().subscriptions.cancel(subRow.stripe_subscription_id);
      } catch (err: any) {
        // Already gone at Stripe's end is success, not failure — the goal is
        // "no live subscription", and a resource_missing means there isn't one.
        const alreadyGone =
          err?.code === "resource_missing" || err?.statusCode === 404;
        if (!alreadyGone) {
          console.error("[account/delete] Stripe cancellation failed:", err);
          return NextResponse.json(
            {
              error:
                "We could not cancel your subscription, so your account has not been deleted. " +
                "Please contact support so you are not charged again.",
            },
            { status: 502 }
          );
        }
        console.warn("[account/delete] Subscription already absent at Stripe, continuing.");
      }
    }

    // ── 2. Rows, before the auth record ─────────────────────────────────
    // Order matters. Deleting auth.users first and then failing on a table
    // would leave rows belonging to a user who can no longer be identified or
    // contacted — unreachable by the account they came from and invisible to
    // any future deletion request.
    //
    // A failure here does NOT abort: the subscription is already cancelled, so
    // stopping would leave the user unable to retry through a UI they can still
    // reach but which no longer has a live subscription to cancel. Better to
    // continue, remove the auth record, and log precisely what was left behind.
    const failedTables: string[] = [];
    for (const table of USER_TABLES) {
      const { error } = await sb.from(table).delete().eq("user_id", caller.id);
      if (error) {
        console.error(`[account/delete] Failed to clear ${table} for ${caller.id}:`, error);
        failedTables.push(table);
      }
    }

    // ── 3. The auth record last ─────────────────────────────────────────
    // This is the irreversible step and the one that makes the account gone.
    const { error: authErr } = await sb.auth.admin.deleteUser(caller.id);
    if (authErr) {
      console.error("[account/delete] Failed to delete auth user:", authErr);
      return NextResponse.json(
        {
          error:
            "Your data was removed but the account itself could not be deleted. " +
            "Please contact support.",
        },
        { status: 500 }
      );
    }

    if (failedTables.length > 0) {
      // The account is gone, so this is not a failure the user can act on —
      // but it is one someone needs to clean up by hand, and it must be
      // findable in the logs.
      console.error(
        `[account/delete] Account ${caller.id} deleted with orphaned rows in: ${failedTables.join(", ")}`
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[account/delete] Unhandled failure:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
