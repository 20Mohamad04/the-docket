import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-07-29.dahlia" as any,
});

export async function POST(req: Request) {
  try {
    const { email, userId, tier } = await req.json();
    const priceId = tier === "max" ? process.env.STRIPE_PRICE_ID_MAX : process.env.STRIPE_PRICE_ID;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId!, quantity: 1 }],
      customer_email: email,
      metadata: { userId: userId || "" },
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://planner-docket-git-main-mohamad0420.vercel.app"}?subscription=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://planner-docket-git-main-mohamad0420.vercel.app"}?subscription=cancelled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("Stripe checkout error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}