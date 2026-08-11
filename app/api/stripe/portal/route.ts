import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

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

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();
    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
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
