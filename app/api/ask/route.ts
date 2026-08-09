import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Keep in sync with OPUS_MONTHLY_LIMIT in app/page.tsx — that copy is
// display-only ("N left"); this is the one that actually enforces the limit.
const OPUS_MONTHLY_LIMIT = 50;

// Service-role client — bypasses RLS. Server-only; same pattern as the
// Stripe webhook's admin client.
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function getSubscription(sb: any, userId: string) {
  const { data, error } = await sb
    .from("subscriptions")
    .select("status, current_period_end")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("Failed to load subscription:", error);
    return { status: null as string | null, periodEnd: null as string | null };
  }
  return {
    status: (data?.status as string | undefined) ?? null,
    periodEnd: (data?.current_period_end as string | undefined) ?? null,
  };
}

async function getUsageRow(sb: any, userId: string) {
  const { data, error } = await sb
    .from("usage")
    .select("period_end, sonnet_count, opus_count")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("Failed to load usage row:", error);
    return null;
  }
  return data as { period_end: string; sonnet_count: number; opus_count: number } | null;
}

// Writes a bump to sonnet_count or opus_count for the given billing period.
// On a new period (row missing, or its period_end doesn't match the current
// one), both counters reset — the field being bumped starts at 1, the other
// at 0. On an existing-period row, only the given field increments; the
// other is simply omitted from the payload, which leaves it unchanged.
async function bumpUsage(
  sb: any,
  userId: string,
  periodEnd: string,
  field: "sonnet_count" | "opus_count"
) {
  const usage = await getUsageRow(sb, userId);
  const isNewPeriod = !usage || usage.period_end !== periodEnd;
  const otherField = field === "sonnet_count" ? "opus_count" : "sonnet_count";
  const nextCount = isNewPeriod ? 1 : (usage![field] ?? 0) + 1;

  const { error } = await sb.from("usage").upsert(
    {
      user_id: userId,
      period_end: periodEnd,
      [field]: nextCount,
      ...(isNewPeriod ? { [otherField]: 0 } : {}),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) console.error(`Usage tracking: failed to write usage row (${field}):`, error);
}

// Phase 1: track Sonnet usage per user per billing period. No enforcement —
// this only counts. Must never throw: a tracking failure should never break
// the actual chat response, so every error path here just logs.
async function trackSonnetUsage(userId: string) {
  try {
    const sb = getSupabaseAdmin();
    if (!sb) {
      console.error("Usage tracking skipped — Supabase admin client unavailable");
      return;
    }
    const { periodEnd } = await getSubscription(sb, userId);
    if (!periodEnd) {
      // No subscription (or no current_period_end yet) for this user — there's
      // no billing period to key usage against, so skip rather than invent one.
      console.log("Usage tracking skipped — no current_period_end for user:", userId);
      return;
    }
    await bumpUsage(sb, userId, periodEnd, "sonnet_count");
  } catch (err) {
    console.error("Usage tracking threw:", err);
  }
}

// Phase 2: increments opus_count for a period we already resolved during
// the eligibility check below. Same never-throw contract as trackSonnetUsage.
async function trackOpusUsage(userId: string, periodEnd: string) {
  try {
    const sb = getSupabaseAdmin();
    if (!sb) return;
    await bumpUsage(sb, userId, periodEnd, "opus_count");
  } catch (err) {
    console.error("Opus usage tracking threw:", err);
  }
}

// Phase 2: server-side Opus eligibility check. CRITICAL — never trust a
// client-sent isPro/useOpus claim; that can be spoofed via devtools. This
// independently re-verifies subscription status against Supabase. Any
// failure (missing config, DB error, thrown exception) fails closed to
// "use Sonnet, no special flag" — identical to a genuine non-Pro user, so a
// transient error here can never grant free Opus access or produce a
// confusing fallback message for something that isn't actually a limit.
async function resolveOpusEligibility(
  userId: string
): Promise<{ allowed: boolean; periodEnd: string | null; overLimit: boolean }> {
  try {
    const sb = getSupabaseAdmin();
    if (!sb) return { allowed: false, periodEnd: null, overLimit: false };

    const { status, periodEnd } = await getSubscription(sb, userId);
    if (status !== "active" || !periodEnd) {
      return { allowed: false, periodEnd: null, overLimit: false };
    }

    const usage = await getUsageRow(sb, userId);
    const currentOpusCount = usage && usage.period_end === periodEnd ? usage.opus_count ?? 0 : 0;

    if (currentOpusCount >= OPUS_MONTHLY_LIMIT) {
      return { allowed: false, periodEnd, overLimit: true };
    }
    return { allowed: true, periodEnd, overLimit: false };
  } catch (err) {
    console.error("Opus eligibility check threw — falling back to Sonnet:", err);
    return { allowed: false, periodEnd: null, overLimit: false };
  }
}

export async function POST(req: Request) {
  try {
    const { system, messages, userId, useOpus } = await req.json();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;

    // Claude Sonnet 5 — meaningfully stronger reasoning and instruction-following
    // than Haiku, which matters a lot here: the system prompt asks the model to
    // make judgment calls (when to ask a clarifying question vs just act, how to
    // read an ambiguous request, how to explain what it did in its own words).
    if (apiKey) {
      let model = "claude-sonnet-5";
      let maxTokens = 4096;
      let opusFallback = false;
      let opusPeriodEnd: string | null = null;

      if (useOpus && userId) {
        const eligibility = await resolveOpusEligibility(userId);
        if (eligibility.allowed) {
          model = "claude-opus-4-8";
          maxTokens = 8192;
          opusPeriodEnd = eligibility.periodEnd;
        } else if (eligibility.overLimit) {
          // Genuinely Pro, but used up this period's Opus credits — fall
          // back to Sonnet and tell the frontend so it can show a note.
          opusFallback = true;
        }
        // Otherwise: not genuinely Pro (or we couldn't verify) — silently
        // ignore useOpus and proceed with Sonnet as normal, no error, no flag.
      }

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          // Sonnet 5 default of 4096 raised for adaptive-thinking headroom;
          // Opus gets 8192 per the Think Harder spec — same reasoning, more
          // room for the stronger/more expensive tier.
          max_tokens: maxTokens,
          // NOTE: both Sonnet 5 and Opus 4.8 reject `temperature` (and
          // top_p/top_k) with a hard 400 unless left at the default — this is
          // a real, documented constraint on both models, not a bug. Do NOT
          // re-add a non-default temperature here for either model. Behavior
          // that used to be tuned via temperature should be controlled
          // through the system prompt instead (which this route already does
          // heavily).
          system,
          messages,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error("Claude error:", data);
        throw new Error(data.error?.message ?? "Claude API error");
      }
      // IMPORTANT: with adaptive thinking on by default for Sonnet 5, and
      // optionally for Opus, data.content is an array that may start with a
      // "thinking" block before the real text block — content[0] is not
      // reliably the actual answer. Find the first block that's actually
      // type "text" instead of assuming position.
      const textBlock = Array.isArray(data.content)
        ? data.content.find((b: any) => b?.type === "text")
        : null;
      const content = textBlock?.text ?? "{}";

      if (userId) {
        if (model === "claude-opus-4-8" && opusPeriodEnd) {
          await trackOpusUsage(userId, opusPeriodEnd);
        } else {
          // Sonnet's usage tracking stays exactly as it was in Phase 1 —
          // track only, no enforcement — whether we ended up on Sonnet
          // because useOpus was never set, because the caller wasn't
          // genuinely Pro, or because of an Opus-limit fallback.
          await trackSonnetUsage(userId);
        }
      }

      return NextResponse.json({ content, ...(opusFallback ? { opusFallback: true } : {}) });
    }

    // Groq fallback — only used if ANTHROPIC_API_KEY isn't set (e.g. Claude API
    // outage or misconfiguration). Kept as a safety net, not the primary path.
    // Groq's OpenAI-compatible API still supports temperature normally and
    // doesn't have thinking blocks, so this one is untouched. No Opus/usage
    // logic applies here — Groq is never Sonnet or Opus.
    if (groqKey) {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          temperature: 0.2,
          max_tokens: 1500,
          messages: [{ role: "system", content: system }, ...messages],
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.choices?.length) {
        console.error("Groq error:", data);
        throw new Error(data.error?.message ?? "Groq API error");
      }
      const content = data.choices[0].message.content;
      return NextResponse.json({ content });
    }

    return NextResponse.json(
      { content: '{"actions":[],"reply":"No AI API key configured. Add ANTHROPIC_API_KEY in Vercel environment variables."}' },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Ask route error:", err);
    return NextResponse.json(
      { content: '{"actions":[],"reply":"Something went wrong on my end — try rephrasing, or try again in a moment."}' },
      { status: 200 }
    );
  }
}
