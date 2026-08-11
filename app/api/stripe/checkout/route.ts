import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-07-29.dahlia" as any,
});

export async function POST(req: Request) {
  try {
    const { email, userId, tier } = await req.json();
    const resolvedTier = tier === "max" ? "max" : "pro";
    const priceId = resolvedTier === "max" ? process.env.STRIPE_PRICE_ID_MAX : process.env.STRIPE_PRICE_ID;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://planner-docket-git-main-mohamad0420.vercel.app";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId!, quantity: 1 }],
      customer_email: email,
      metadata: { userId: userId || "" },
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