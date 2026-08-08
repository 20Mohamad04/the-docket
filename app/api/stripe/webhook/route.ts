import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-07-29.dahlia" as any,
});

// Service-role client — bypasses RLS. Server-only; never expose this key to
// the client. Returns null if the env vars aren't configured so the webhook
// still 200s (and logs) rather than crashing on a misconfigured deploy.
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    console.error("Webhook signature error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  if (!sb) console.error("Supabase admin client unavailable — subscriptions table will not be updated");

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      console.log("✓ Subscription started:", session.customer_email);
      const userId = session.metadata?.userId;
      if (!userId) {
        console.error("checkout.session.completed missing metadata.userId — cannot link subscription to a user");
      } else if (sb) {
        const { error } = await sb.from("subscriptions").upsert(
          {
            user_id: userId,
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: session.subscription as string,
            status: "active",
          },
          { onConflict: "user_id" }
        );
        if (error) console.error("Supabase upsert failed (checkout.session.completed):", error);
      }
      break;
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      console.log("✗ Subscription cancelled:", subscription.customer);
      if (sb) {
        const { error } = await sb
          .from("subscriptions")
          .update({ status: "canceled" })
          .eq("stripe_customer_id", subscription.customer as string);
        if (error) console.error("Supabase update failed (customer.subscription.deleted):", error);
      }
      break;
    }
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      console.log("~ Subscription updated:", subscription.status);
      if (sb) {
        // current_period_end lives on the subscription item, not the
        // subscription itself, as of this Stripe API version.
        const periodEndSeconds = subscription.items.data[0]?.current_period_end;
        const { error } = await sb
          .from("subscriptions")
          .update({
            status: subscription.status,
            ...(periodEndSeconds
              ? { current_period_end: new Date(periodEndSeconds * 1000).toISOString() }
              : {}),
          })
          .eq("stripe_customer_id", subscription.customer as string);
        if (error) console.error("Supabase update failed (customer.subscription.updated):", error);
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}