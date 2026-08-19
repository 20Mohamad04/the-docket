import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-07-29.dahlia" as any,
});

// Service-role client — bypasses RLS. Server-only; never expose this key to
// the client. Used to look up the caller's stripe_customer_id ourselves
// rather than trusting one sent in the request body.
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// Same pattern as app/api/ask/route.ts — verifies the caller's own Supabase
// access token instead of trusting a client-sent userId, which this route
// used to: anyone who knew or guessed a user's UUID could POST it here,
// fully unauthenticated, and get back a Stripe billing-portal URL for that
// user's own subscription.
function getSupabaseForToken(accessToken: string): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false },
  });
}

async function authenticateRequest(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
  const token = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  const sb = getSupabaseForToken(token);
  if (!sb) return null;
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user.id;
}

export async function POST(req: Request) {
  try {
    const userId = await authenticateRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sb = getSupabaseAdmin();
    if (!sb) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
    }

    const { data, error } = await sb
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Supabase lookup failed (portal):", error);
      return NextResponse.json({ error: "Could not look up subscription" }, { status: 500 });
    }
    if (!data?.stripe_customer_id) {
      return NextResponse.json({ error: "No Stripe customer found for this account" }, { status: 404 });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: data.stripe_customer_id,
      return_url: process.env.NEXT_PUBLIC_SITE_URL || "https://planner-docket-git-main-mohamad0420.vercel.app",
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("Stripe portal error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
