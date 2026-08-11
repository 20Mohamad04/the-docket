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

// current_period_end lives on the subscription item, not the subscription
// object itself, as of this Stripe API version — see SubscriptionItems.
function periodEndISO(sub: Stripe.Subscription): string | undefined {
  const seconds = sub.items.data[0]?.current_period_end;
  return seconds ? new Date(seconds * 1000).toISOString() : undefined;
}

// Phase 1 of the Max tier: which price the subscription is actually on lives
// on the same subscription item current_period_end is read from above.
// Defaults to "pro" if the price ID matches neither configured price — this
// should never happen, but must never error or leave tier unset.
function resolveTier(sub: Stripe.Subscription): "pro" | "max" {
  const priceId = sub.items.data[0]?.price?.id;
  if (priceId && priceId === process.env.STRIPE_PRICE_ID_MAX) return "max";
  if (priceId && priceId === process.env.STRIPE_PRICE_ID) return "pro";
  console.error("Subscription price ID matched neither STRIPE_PRICE_ID nor STRIPE_PRICE_ID_MAX — defaulting to pro:", priceId);
  return "pro";
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
        // The checkout/payment already succeeded on Stripe's side by this
        // point — this DB write is bookkeeping, not part of that flow. Any
        // failure here (including a thrown exception, not just a resolved
        // {error}) must not stop this handler from returning 200, or Stripe
        // will interpret it as a failed delivery and retry, risking
        // duplicate processing.
        try {
          // The checkout session itself doesn't carry subscription item data
          // (session.subscription is just an ID here, not expanded) — fetch
          // the subscription separately to get current_period_end.
          let currentPeriodEnd: string | undefined;
          let tier: "pro" | "max" = "pro";
          if (session.subscription) {
            const sub = await stripe.subscriptions.retrieve(session.subscription as string);
            currentPeriodEnd = periodEndISO(sub);
            tier = resolveTier(sub);
          }
          const { error } = await sb.from("subscriptions").upsert(
            {
              user_id: userId,
              stripe_customer_id: session.customer as string,
              stripe_subscription_id: session.subscription as string,
              status: "active",
              tier,
              ...(currentPeriodEnd ? { current_period_end: currentPeriodEnd } : {}),
            },
            { onConflict: "user_id" }
          );
          if (error) console.error("Supabase upsert failed (checkout.session.completed):", error);
        } catch (err) {
          console.error("Supabase upsert threw (checkout.session.completed):", err);
        }
      }
      break;
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      console.log("✗ Subscription cancelled:", subscription.customer);
      if (sb) {
        try {
          const { error } = await sb
            .from("subscriptions")
            .update({ status: "canceled" })
            .eq("stripe_customer_id", subscription.customer as string);
          if (error) console.error("Supabase update failed (customer.subscription.deleted):", error);
        } catch (err) {
          console.error("Supabase update threw (customer.subscription.deleted):", err);
        }
      }
      break;
    }
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      console.log("~ Subscription updated:", subscription.status);
      if (sb) {
        try {
          const currentPeriodEnd = periodEndISO(subscription);
          const tier = resolveTier(subscription);
          const { error } = await sb
            .from("subscriptions")
            .update({
              status: subscription.status,
              tier,
              ...(currentPeriodEnd ? { current_period_end: currentPeriodEnd } : {}),
            })
            .eq("stripe_customer_id", subscription.customer as string);
          if (error) console.error("Supabase update failed (customer.subscription.updated):", error);
        } catch (err) {
          console.error("Supabase update threw (customer.subscription.updated):", err);
        }
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}