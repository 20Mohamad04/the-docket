import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Keep in sync with opusLimitForTier in app/page.tsx — that copy is
// display-only ("N left"); this is the one that actually enforces the limit.
function opusLimitForTier(tier: string | null): number {
  return tier === "max" ? 120 : 50;
}

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
    .select("status, current_period_end, tier")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("Failed to load subscription:", error);
    return { status: null as string | null, periodEnd: null as string | null, tier: null as string | null };
  }
  return {
    status: (data?.status as string | undefined) ?? null,
    periodEnd: (data?.current_period_end as string | undefined) ?? null,
    tier: (data?.tier as string | undefined) ?? null,
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

    const { status, periodEnd, tier } = await getSubscription(sb, userId);
    if (status !== "active" || !periodEnd) {
      return { allowed: false, periodEnd: null, overLimit: false };
    }

    const usage = await getUsageRow(sb, userId);
    const currentOpusCount = usage && usage.period_end === periodEnd ? usage.opus_count ?? 0 : 0;

    if (currentOpusCount >= opusLimitForTier(tier)) {
      return { allowed: false, periodEnd, overLimit: true };
    }
    return { allowed: true, periodEnd, overLimit: false };
  } catch (err) {
    console.error("Opus eligibility check threw — falling back to Sonnet:", err);
    return { allowed: false, periodEnd: null, overLimit: false };
  }
}

// Forces Claude to always return valid structured JSON via tool_use instead
// of prompt-based prose, eliminating the recurring "malformed JSON leaking
// into the visible reply" bug at the source rather than patching another
// edge case in a text-parsing recovery function. `items: { type: "object" }`
// is intentionally loose — systemPrompt's detailed action reference and
// behavioral instructions (unchanged) still govern WHAT goes in each action;
// this schema only guarantees the outer shape is always valid.
const DOCKET_RESPONSE_TOOL = {
  name: "docket_response",
  description:
    "The response containing any schedule actions to perform and the reply message to show the user.",
  input_schema: {
    type: "object",
    properties: {
      actions: {
        type: "array",
        description:
          "Zero or more actions to perform on the user's tasks/routines (add_task, add_routine, update_task, complete_task, remove_task, reopen_task, add_step, remove_step, update_routine, remove_routine, mark_routine_done, undo). Empty array if no changes are needed yet.",
        items: { type: "object" },
      },
      reply: {
        type: "string",
        description: "The natural-language message to show the user.",
      },
    },
    required: ["actions", "reply"],
  },
};

// ── Groq fallback only ───────────────────────────────────────────────────
// Groq doesn't support Anthropic's tool_choice syntax, so that branch stays
// prompt-based. This recovery logic used to live client-side in page.tsx;
// moved here so /api/ask always returns the same clean {actions, reply}
// shape no matter which model actually served the request — the frontend
// never has to guess again. The Claude path above never needs this: forced
// tool_choice guarantees valid structured output directly.
function findMatchingBracket(s: string, openIdx: number): number {
  let depth = 0, inStr = false, esc = false;
  for (let i = openIdx; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === "[" || c === "{") depth++;
    else if (c === "]" || c === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function parseGroqResponse(raw: string): { actions: any[]; reply: string } {
  const tryParse = (s: string) => { try { return JSON.parse(s); } catch { return null; } };
  let cleaned = raw.replace(/^```json\s*/i, "").replace(/^```/, "").replace(/```$/, "").trim();

  // Attempt 1: parse as-is
  let parsed = tryParse(cleaned);

  // Attempt 2: the model may have added stray prose before/after the JSON
  // despite instructions — isolate the outermost {...} block
  if (!parsed) {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      const slice = cleaned.slice(start, end + 1);
      parsed = tryParse(slice);
      // Attempt 3: the model may have used literal line breaks inside a
      // JSON string value (invalid JSON — needs \n) — escape and retry
      if (!parsed) parsed = tryParse(slice.replace(/\r?\n/g, "\\n"));
    }
  }

  if (parsed && typeof parsed === "object") {
    let actions: any[] = [];
    if (Array.isArray(parsed.actions) && parsed.actions.length > 0) actions = parsed.actions;
    else if (parsed.type) actions = [parsed];
    else if (parsed.action?.type) actions = [parsed.action];
    const reply = parsed.reply ?? parsed.message;
    if (reply) return { actions, reply };
  }

  // Attempt 4: the model abandoned the JSON envelope entirely and wrote the
  // actions as a loose array in prose (e.g. "added: [...]" followed by a
  // human explanation) instead of nesting them in {"actions":[...]}. Find a
  // "[{...}]" array of objects with a "type" field anywhere in the text,
  // parse it directly as the actions array, and treat whatever text follows
  // it as the reply — so actions still apply and the user only ever sees
  // clean text, never raw JSON.
  const arrStart = cleaned.search(/\[\s*\{/);
  if (arrStart !== -1) {
    const arrEnd = findMatchingBracket(cleaned, arrStart);
    if (arrEnd !== -1) {
      const arr = tryParse(cleaned.slice(arrStart, arrEnd + 1));
      if (
        Array.isArray(arr) &&
        arr.length > 0 &&
        arr.every((a) => a && typeof a === "object" && typeof a.type === "string")
      ) {
        const after = cleaned.slice(arrEnd + 1).replace(/^[\s:.,]*/, "").trim();
        return { actions: arr, reply: after || "Done — all set." };
      }
    }
  }

  // Total fallback: JSON never parsed. Never fabricate "Done." — that
  // actively lies about what happened. Instead surface the model's raw text
  // (stripped of obvious JSON scaffolding) so the user sees SOMETHING real
  // rather than a made-up confirmation, and take no actions since we can't
  // reliably tell what (if anything) the model intended to change.
  const bestEffort = cleaned
    .replace(/^[{\[]\s*/, "").replace(/\s*[}\]]$/, "")
    .replace(/"reply"\s*:\s*"/, "").replace(/"\s*,?\s*$/, "")
    .replace(/\\n/g, "\n").trim();
  return { actions: [], reply: bestEffort || "I had trouble processing that — could you try rephrasing?" };
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
          //
          // messages is forwarded exactly as the client built it — Anthropic's
          // Messages API accepts each message's `content` as either a plain
          // string or a multimodal array (e.g. [{type:"text",...},
          // {type:"image",source:{type:"base64",...}}]) natively, so no
          // reshaping happens here. Only the most recent user turn carries a
          // real image; the client downgrades any earlier attachment to a
          // text placeholder before it ever reaches this route.
          system,
          messages,
          tools: [DOCKET_RESPONSE_TOOL],
          tool_choice: { type: "tool", name: "docket_response" },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error("Claude error:", data);
        throw new Error(data.error?.message ?? "Claude API error");
      }
      // Forced tool_choice guarantees a tool_use block is present; adaptive
      // thinking (on by default for Sonnet 5, optionally for Opus) may still
      // put a "thinking" block before it, so find by type rather than
      // assuming position. .input is already a parsed object — no JSON.parse
      // needed, and no malformed-text edge case is possible here anymore.
      const toolUseBlock = Array.isArray(data.content)
        ? data.content.find((b: any) => b?.type === "tool_use" && b?.name === "docket_response")
        : null;
      if (!toolUseBlock) {
        console.error("Claude response had no docket_response tool_use block:", data);
        throw new Error("Claude did not return a structured response");
      }
      const actions = Array.isArray(toolUseBlock.input?.actions) ? toolUseBlock.input.actions : [];
      const reply =
        toolUseBlock.input?.reply ?? "I had trouble processing that — could you try rephrasing?";

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

      return NextResponse.json({ actions, reply, ...(opusFallback ? { opusFallback: true } : {}) });
    }

    // Groq fallback — only used if ANTHROPIC_API_KEY isn't set (e.g. Claude API
    // outage or misconfiguration). Kept as a safety net, not the primary path.
    // Groq's OpenAI-compatible API still supports temperature normally and
    // doesn't have thinking blocks, so this one is untouched. No Opus/usage
    // logic applies here — Groq is never Sonnet or Opus. Groq doesn't support
    // Anthropic's tool_choice syntax, so this stays prompt-based — recovered
    // into the same {actions, reply} shape via parseGroqResponse above.
    if (groqKey) {
      // llama-3.3-70b-versatile isn't vision-capable, and Groq's API doesn't
      // understand Anthropic's image content-block shape anyway — flatten any
      // multimodal message down to its text (plus a placeholder for the
      // image) so an in-progress image conversation degrades gracefully here
      // instead of hard-failing this fallback path.
      const groqMessages = messages.map((m: any) => {
        if (!Array.isArray(m.content)) return m;
        const text = m.content
          .filter((b: any) => b?.type === "text")
          .map((b: any) => b.text)
          .join(" ");
        const hasImage = m.content.some((b: any) => b?.type === "image");
        return {
          role: m.role,
          content: [text, hasImage ? "[user attached an image]" : ""].filter(Boolean).join(" "),
        };
      });
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
          messages: [{ role: "system", content: system }, ...groqMessages],
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.choices?.length) {
        console.error("Groq error:", data);
        throw new Error(data.error?.message ?? "Groq API error");
      }
      const { actions, reply } = parseGroqResponse(data.choices[0].message.content);
      return NextResponse.json({ actions, reply });
    }

    return NextResponse.json(
      {
        actions: [],
        reply: "No AI API key configured. Add ANTHROPIC_API_KEY in Vercel environment variables.",
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Ask route error:", err);
    return NextResponse.json(
      {
        actions: [],
        reply: "Something went wrong on my end — try rephrasing, or try again in a moment.",
      },
      { status: 200 }
    );
  }
}
