import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-07-29.dahlia" as any,
});

// Same pattern as app/api/ask/route.ts — verifies the caller's own Supabase
// access token instead of trusting a client-sent userId/email, which this
// route used to: anyone (no login required) could POST an arbitrary user's
// UUID and get a Checkout session created with that id in its metadata,
// leaving a spoofed subscription row for the webhook to write.
function getSupabaseForToken(accessToken: string): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false },
  });
}

async function authenticateRequest(req: Request): Promise<{ userId: string; email: string } | null> {
  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
  const token = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  const sb = getSupabaseForToken(token);
  if (!sb) return null;
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data?.user) return null;
  return { userId: data.user.id, email: data.user.email ?? "" };
}

export async function POST(req: Request) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tier } = await req.json();
    const resolvedTier = tier === "max" ? "max" : "pro";
    const priceId = resolvedTier === "max" ? process.env.STRIPE_PRICE_ID_MAX : process.env.STRIPE_PRICE_ID;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://planner-docket-git-main-mohamad0420.vercel.app";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId!, quantity: 1 }],
      customer_email: auth.email,
      metadata: { userId: auth.userId },
      // The 7-day free trial advertised everywhere in the app (onboarding,
      // the pricing modal, the FAQ) — without this, Checkout has no trial
      // configured at all and charges the card immediately on signup.
      // Checkout's default payment_method_collection ("always") already
      // collects the card upfront during the trial, so the real charge at
      // day 7 (when Stripe auto-converts trialing -> active) just works
      // with no further config.
      subscription_data: { trial_period_days: 7 },
      // tier is known here at request time — passing it through avoids
      // depending on the webhook's (possibly delayed) subscriptions-table
      // write having landed by the time the success redirect is handled.
      success_url: `${siteUrl}?subscription=success&tier=${resolvedTier}`,
      cancel_url: `${siteUrl}?subscription=cancelled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("Stripe checkout error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}