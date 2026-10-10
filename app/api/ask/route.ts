import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { buildSystemPrompt, type ChatContext } from "./_prompt";

// The request body's `context` arrives untrusted, so it's checked before the
// prompt interpolates it. Deliberately shallow: this data is the user's own,
// so bad values only degrade their own assistant's answer — the check exists
// to stop a malformed body throwing inside the template, not to police
// content. What is NOT accepted at any strength is a client-supplied prompt;
// `system` is ignored outright (see the POST handler).
function isChatContext(v: unknown): v is ChatContext {
  if (!v || typeof v !== "object") return false;
  const c = v as Record<string, unknown>;
  return (
    typeof c.today === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(c.today) &&
    typeof c.weekday === "string" &&
    !!c.schedule &&
    typeof c.schedule === "object" &&
    Array.isArray(c.tasks) &&
    Array.isArray(c.routines)
  );
}

// Same pattern as app/api/conversations/_lib.ts and app/api/memories/_lib.ts
// — duplicated rather than shared, matching this codebase's convention of
// small, self-contained per-route-group helpers. Verifies the caller's own
// Supabase access token (a genuine round-trip via getUser(jwt)) rather than
// trusting a client-sent userId, which this route used to do — anyone could
// otherwise POST an arbitrary user's UUID and rack up their Opus/Sonnet
// usage or write fake conversation history under their account.
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

// "trialing" grants the same full access as "active" — it's a trial of
// the paid tier, not a lesser one, and Stripe reports a subscription as
// "trialing" (not "active") for the first 7 days of the free trial by
// design. Shared by both eligibility checks below so they can't drift.
function isEntitledStatus(status: string | null): boolean {
  return status === "active" || status === "trialing";
}

// ── Atomic usage reservation (S-02 fix) ─────────────────────────────────
// Replaces the old read-then-write flow (read the count, compare to the
// limit, write count+1 as a separate step) — a classic check-then-act race:
// concurrent requests could all read the same stale count, all pass the same
// eligibility check, and all proceed, letting a user exceed their Nova/Vega
// cap just by firing requests concurrently. reserve_usage (a Postgres
// function, callable only by the service role) does the check-and-increment
// as a single atomic database operation instead, so there is no window
// between "is there room" and "take the room" for a second request to land
// in. It creates or rolls the row over to the given period itself; callers
// no longer read the row at all.
//
// Reserved BEFORE the Anthropic call, not after — release_usage undoes a
// reservation if the call then fails, so a failed request still costs
// nothing, same as before, but a successful one is now counted exactly once
// with no race.
async function reserveUsage(
  sb: any,
  userId: string,
  periodEnd: string,
  field: "sonnet_count" | "opus_count",
  limit: number
): Promise<boolean> {
  const { data, error } = await sb.rpc("reserve_usage", {
    p_user_id: userId,
    p_period_end: periodEnd,
    p_field: field,
    p_limit: limit,
  });
  if (error) {
    // Fail closed: an RPC failure must never be treated as "room available" —
    // see the callers below, which both treat this identically to a genuine
    // over-limit result rather than letting the request through unmetered.
    console.error(`reserve_usage RPC failed (${field}):`, error);
    return false;
  }
  return data === true;
}

// Releases one previously-made reservation. Never throws — this is called
// from failure paths that are themselves about to report an error to the
// user, and a release failure must not replace that error or crash the
// response.
async function releaseUsage(
  sb: any,
  userId: string,
  periodEnd: string,
  field: "sonnet_count" | "opus_count"
): Promise<void> {
  try {
    const { error } = await sb.rpc("release_usage", {
      p_user_id: userId,
      p_period_end: periodEnd,
      p_field: field,
    });
    if (error) console.error(`release_usage RPC failed (${field}):`, error);
  } catch (err) {
    console.error(`release_usage RPC threw (${field}):`, err);
  }
}

// ── Phase 1: persistent chat history ────────────────────────────────────
// Best-effort, like usage tracking above — a persistence failure must never
// break the actual chat response, so every error path here just logs.
// Uses the same service-role client as the rest of this route (see
// reserveUsage etc.), with userId taken from the verified token rather
// than RLS: ownership is enforced manually below instead. The four
// /api/conversations routes
// take the opposite approach (a user-scoped client so Postgres RLS on
// conversations/chat_messages genuinely applies) since they have no other
// reason to need this route's elevated privileges.

// First few words of the user's first message — used only when creating a
// brand new conversation, so the history list has something readable to
// show without a separate model call just to name it.
function titleFromMessage(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const allWords = trimmed.split(/\s+/);
  const words = allWords.slice(0, 8);
  return words.length < allWords.length ? `${words.join(" ")}…` : words.join(" ");
}

// The client (buildApiMessages in page.tsx) sends the current turn's
// content as either a plain string, or — when an image is attached — an
// array of Anthropic content blocks ([{type:"text"},{type:"image",...}]).
// Pulls the plain text and, if present, the raw base64 image data back out
// of whichever shape this turn actually is.
function extractUserTurnContent(content: any): { text: string; imageBase64: string | null } {
  if (typeof content === "string") return { text: content, imageBase64: null };
  if (!Array.isArray(content)) return { text: "", imageBase64: null };
  const textBlock = content.find((b: any) => b?.type === "text");
  const imageBlock = content.find((b: any) => b?.type === "image");
  return { text: textBlock?.text ?? "", imageBase64: imageBlock?.source?.data ?? null };
}

// Uploads the current turn's image (if any) to the private chat-images
// bucket and returns the STORAGE PATH — not a URL. The bucket is private
// (per-user RLS — see the storage policies set up alongside it), so there's
// no permanent public/signed URL to hand back here; GET
// /api/conversations/[id] mints a short-lived signed URL from this path
// each time a conversation is actually loaded, instead of a long-lived one
// sitting in the database.
async function uploadChatImage(
  sb: any,
  userId: string,
  conversationId: string,
  imageBase64: string
): Promise<string | null> {
  try {
    const path = `${userId}/${conversationId}/${crypto.randomUUID()}.jpg`;
    const bytes = Buffer.from(imageBase64, "base64");
    const { error } = await sb.storage
      .from("chat-images")
      .upload(path, bytes, { contentType: "image/jpeg", upsert: false });
    if (error) {
      console.error("Chat image upload failed:", error);
      return null;
    }
    return path;
  } catch (err) {
    console.error("Chat image upload threw:", err);
    return null;
  }
}

// Resolves which conversation this turn belongs to (creating one if none
// was given, or if the client-sent id doesn't actually check out) and
// writes both the user's message and the assistant's reply to
// chat_messages. Returns the resolved conversation id so the client can
// keep using it for later turns in the same chat — or null if persistence
// isn't possible or failed, in which case the chat itself still works
// exactly as it did before this feature existed.
async function persistTurn({
  userId,
  conversationId,
  userContent,
  assistantReply,
}: {
  userId: string;
  conversationId: string | null | undefined;
  userContent: any;
  assistantReply: string;
}): Promise<string | null> {
  try {
    const sb = getSupabaseAdmin();
    if (!sb) return null;

    const { text, imageBase64 } = extractUserTurnContent(userContent);

    let resolvedId: string | null = conversationId || null;
    if (resolvedId) {
      // Never trust a client-sent conversationId at face value — confirm it
      // actually belongs to this user before writing into it. If it
      // doesn't (wrong owner, or it no longer exists), fall through to
      // creating a fresh conversation instead of erroring the whole turn
      // out.
      const { data: existing } = await sb
        .from("conversations")
        .select("id")
        .eq("id", resolvedId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!existing) resolvedId = null;
    }

    if (!resolvedId) {
      const title = titleFromMessage(text);
      const { data: created, error } = await sb
        .from("conversations")
        .insert({ user_id: userId, ...(title ? { title } : {}) })
        .select("id")
        .single();
      if (error || !created) {
        console.error("Failed to create conversation:", error);
        return null;
      }
      resolvedId = created.id as string;
    }

    const imagePath = imageBase64 ? await uploadChatImage(sb, userId, resolvedId, imageBase64) : null;

    const { error: insertError } = await sb.from("chat_messages").insert([
      {
        conversation_id: resolvedId,
        role: "user",
        content: text,
        ...(imagePath ? { image_url: imagePath } : {}),
      },
      { conversation_id: resolvedId, role: "assistant", content: assistantReply },
    ]);
    if (insertError) console.error("Failed to insert chat messages:", insertError);

    const { error: touchError } = await sb
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", resolvedId);
    if (touchError) console.error("Failed to touch conversation updated_at:", touchError);

    return resolvedId;
  } catch (err) {
    console.error("Conversation persistence threw:", err);
    return null;
  }
}

// ── Persistent AI memory ────────────────────────────────────────────────
// No insert RLS policy exists on user_memories (select/delete only, same as
// the rest of this file's tables) — inserts go through the service-role
// client, by design.

const MEMORY_CAP = 50;

// Fetches the user's most recent memories, capped, for two purposes in the
// same request: injecting them into the system prompt below, and reused
// as-is by persistMemories as the working set for its cap/eviction
// decisions — one query instead of two.
async function fetchUserMemories(
  userId: string
): Promise<{ id: string; content: string; source: string }[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  const { data, error } = await sb
    .from("user_memories")
    .select("id, content, source")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(MEMORY_CAP);
  if (error) {
    console.error("Failed to load user memories:", error);
    return [];
  }
  return data ?? [];
}

// Server-side check for the user's "let the AI automatically remember
// useful details" preference (Profile → AI Memory card), stored the same
// way as email_opt_in — in Supabase auth user_metadata. Deliberately
// re-verified here via the admin API rather than trusting a client-sent
// flag: same reasoning as resolveOpusEligibility below not trusting a
// client-sent isPro claim — a user who turned this off is relying on the
// server actually enforcing it, not on unmodified client JS choosing to
// respect it. Unset (the common case — nobody has toggled it yet) means
// enabled, matching the feature's default-on behavior; any lookup failure
// fails CLOSED (treated as disabled) rather than defaulting to on, since
// this gates a privacy preference, not a billing one — an occasionally
// skipped automatic memory costs far less than occasionally creating one
// the user explicitly turned off, however that happened.
async function isAutoMemoryEnabled(userId: string): Promise<boolean> {
  try {
    const sb = getSupabaseAdmin();
    if (!sb) return false;
    const { data, error } = await sb.auth.admin.getUserById(userId);
    if (error || !data?.user) return false;
    return data.user.user_metadata?.auto_memory_enabled !== false;
  } catch (err) {
    console.error("Failed to check auto-memory preference:", err);
    return false;
  }
}

// Appended to the system prompt built in ./_prompt — memories live in a table
// the server can read directly, unlike the schedule/tasks/routines context
// (client-only in-memory state), so there's no reason to round-trip this
// through the client the way that context has to be. Omitted entirely when
// there's nothing to show, rather than telling the model "you know nothing
// yet" on every single message.
function buildMemorySystemAddition(memories: { content: string }[]): string {
  if (memories.length === 0) return "";
  const lines = memories.map((m) => `- ${m.content}`).join("\n");
  return `\n\n=== WHAT YOU KNOW ABOUT THIS USER (from past conversations) ===\n${lines}`;
}

// Persists any {type:"remember"} actions the model returned. Best-effort,
// like the persistence above — a failure here must never break the actual
// reply. `existingMemories` is the same list already fetched for prompt
// injection (see fetchUserMemories) and is mutated in place as memories are
// inserted/evicted, so multiple `remember` actions in one turn are each
// judged against the state the previous one left, not a stale snapshot.
async function persistMemories(
  sb: any,
  userId: string,
  actions: any[],
  existingMemories: { id: string; source: string }[],
  autoMemoryEnabled: boolean
): Promise<void> {
  const rememberActions = Array.isArray(actions)
    ? actions.filter((a) => a?.type === "remember" && typeof a.content === "string" && a.content.trim())
    : [];
  if (rememberActions.length === 0) return;

  for (const action of rememberActions) {
    try {
      const source = action.source === "explicit" ? "explicit" : "automatic";
      // Explicit memories are the user's own direct request and always go
      // through regardless of this preference — only the model's own
      // automatic judgment calls are gated by it.
      if (source === "automatic" && !autoMemoryEnabled) continue;
      const content = action.content.trim();

      if (existingMemories.length >= MEMORY_CAP) {
        // existingMemories is newest-first. Prefer evicting the oldest
        // automatic memory to make room. Explicit memories are never
        // evicted to make room for an automatic one — if every existing
        // memory is explicit and the new one is only automatic, skip it
        // silently instead. But a cap made up entirely of explicit
        // memories still needs to make room for a brand new EXPLICIT
        // request the user just made (ignoring "remember that I..." would
        // feel broken), so that specific case evicts the oldest explicit
        // memory instead — explicit-for-explicit turnover, not
        // explicit-for-automatic.
        let evictIdx: number | undefined;
        for (let i = existingMemories.length - 1; i >= 0; i--) {
          if (existingMemories[i].source === "automatic") { evictIdx = i; break; }
        }
        if (evictIdx === undefined && source === "explicit") {
          evictIdx = existingMemories.length - 1;
        }
        if (evictIdx === undefined) continue;

        const [evicted] = existingMemories.splice(evictIdx, 1);
        const { error: deleteError } = await sb.from("user_memories").delete().eq("id", evicted.id);
        if (deleteError) console.error("Failed to evict old memory:", deleteError);
      }

      const { data: inserted, error: insertError } = await sb
        .from("user_memories")
        .insert({ user_id: userId, content, source })
        .select("id, source")
        .single();
      if (insertError || !inserted) {
        console.error("Failed to insert memory:", insertError);
        continue;
      }
      existingMemories.unshift(inserted);
    } catch (err) {
      console.error("Persisting memory threw:", err);
    }
  }
}

// Phase 2: server-side Opus eligibility check. CRITICAL — never trust a
// client-sent isPro/useOpus claim; that can be spoofed via devtools. This
// independently re-verifies subscription status against Supabase. A missing
// subscription (not entitled) fails closed to "use Sonnet, no special flag" —
// identical to a genuine non-Pro user. Reserving via reserve_usage (not a
// separate read-then-compare) also closes the race condition a concurrent
// burst of requests used to be able to exploit to exceed the Vega cap — see
// reserveUsage above.
async function resolveOpusEligibility(
  userId: string
): Promise<{
  allowed: boolean;
  overLimit: boolean;
  reservation: { periodEnd: string; field: "opus_count" } | null;
}> {
  try {
    const sb = getSupabaseAdmin();
    if (!sb) return { allowed: false, overLimit: false, reservation: null };

    const { status, periodEnd, tier } = await getSubscription(sb, userId);
    if (!isEntitledStatus(status) || !periodEnd) {
      return { allowed: false, overLimit: false, reservation: null };
    }

    // reserve_usage atomically increments opus_count only if still under the
    // cap — this is both the limit check and the write, with no window for a
    // concurrent request to slip through on a stale count. A false result
    // means either the cap is genuinely reached, or the RPC itself failed
    // (logged inside reserveUsage) — both are treated identically as "over
    // limit" so an infra hiccup can never let an unmetered Opus call through;
    // it just degrades to Sonnet exactly like a real spent allowance would.
    const reserved = await reserveUsage(sb, userId, periodEnd, "opus_count", opusLimitForTier(tier));
    if (!reserved) {
      return { allowed: false, overLimit: true, reservation: null };
    }
    return { allowed: true, overLimit: false, reservation: { periodEnd, field: "opus_count" } };
  } catch (err) {
    console.error("Opus eligibility check threw — falling back to Sonnet:", err);
    return { allowed: false, overLimit: false, reservation: null };
  }
}

// Free-tier Sonnet messages are capped at 10/day. This can't reuse
// resolveOpusEligibility's periodEnd verbatim: that reset is tied to a real
// subscription's monthly current_period_end, and a free-tier user has no
// subscription row at all to key against. What IS reused is the underlying
// mechanism reserve_usage already implements — an opaque "period" marker
// stored alongside a count, reset to zero the moment the marker no longer
// matches "now" — just with today's UTC calendar date standing in as that
// marker for a free user, instead of a billing period end. Active
// subscribers (Pro or Max) never touch this: Sonnet is unlimited for them,
// exactly as advertised.
const FREE_SONNET_DAILY_LIMIT = 10;

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

// Shared by the eligibility check below and its own reservation call, so
// both always agree on what "the current period" is for this user.
async function resolveSonnetPeriod(
  sb: any,
  userId: string
): Promise<{ periodEnd: string; isActiveSubscriber: boolean }> {
  const { status, periodEnd } = await getSubscription(sb, userId);
  if (isEntitledStatus(status) && periodEnd) return { periodEnd, isActiveSubscriber: true };
  return { periodEnd: todayUTC(), isActiveSubscriber: false };
}

// Reserves (not reads-then-compares) the free-tier daily Nova allowance —
// same race-condition fix as resolveOpusEligibility above. Active
// subscribers skip this entirely: Sonnet is unlimited for them, no
// reservation needed, same as before.
//
// This now fails CLOSED on an RPC error (treated as "no room"), not open.
// The old read-then-compare version failed open on a transient DB hiccup so
// a legitimate free user was never locked out of basic chat by infra
// trouble — but "fail open" is exactly the kind of gap that let a metering
// failure through unmetered, which is what this whole fix removes.
async function resolveSonnetEligibility(userId: string): Promise<{
  allowed: boolean;
  reservation: { periodEnd: string; field: "sonnet_count" } | null;
}> {
  try {
    const sb = getSupabaseAdmin();
    if (!sb) return { allowed: false, reservation: null };
    const { periodEnd, isActiveSubscriber } = await resolveSonnetPeriod(sb, userId);
    if (isActiveSubscriber) return { allowed: true, reservation: null };
    const reserved = await reserveUsage(sb, userId, periodEnd, "sonnet_count", FREE_SONNET_DAILY_LIMIT);
    if (!reserved) return { allowed: false, reservation: null };
    return { allowed: true, reservation: { periodEnd, field: "sonnet_count" } };
  } catch (err) {
    console.error("Sonnet eligibility check threw — failing closed:", err);
    return { allowed: false, reservation: null };
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
          "Zero or more actions to perform on the user's tasks/routines (add_task, add_routine, update_task, complete_task, remove_task, reopen_task, add_step, remove_step, update_routine, remove_routine, mark_routine_done, undo), plus remember (save a durable fact about the user for future conversations — see the MEMORY section of the system prompt for when to use it). Empty array if no changes are needed yet.",
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
  // Declared outside the try below, not inside it — a function declared
  // inside a try{} block is scoped to that block and invisible from the
  // catch{} block, which also needs to call this on failure. userId lives
  // on the reservation record itself (rather than being captured from an
  // outer binding) for the same reason: nothing above this line has it yet.
  //
  // At most one of the eligibility checks below ever actually reserves — a
  // free user reserves sonnet_count (Pro/Max skip it, Sonnet is unlimited
  // for them); a subscriber requesting Opus separately reserves opus_count
  // (only reachable once already confirmed entitled, so a free user can
  // never also reach that branch). Tracked here so any failure path below
  // can release whichever one actually happened, exactly once, and never
  // when none was made.
  let activeReservation:
    | { userId: string; periodEnd: string; field: "sonnet_count" | "opus_count" }
    | null = null;
  async function releasePendingReservation(): Promise<void> {
    if (!activeReservation) return;
    const { userId, periodEnd, field } = activeReservation;
    activeReservation = null;
    const sb = getSupabaseAdmin();
    if (!sb) return;
    await releaseUsage(sb, userId, periodEnd, field);
  }

  try {
    const authedUserId = await authenticateRequest(req);
    if (!authedUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Re-declared with an explicit non-nullable type: TS's control-flow
    // narrowing above doesn't persist into the nested function declarations
    // below (persistIfPossible etc.), which close over this binding.
    const userId: string = authedUserId;

    // `system` is deliberately NOT destructured. The prompt is server-owned
    // now (see ./_prompt); anything the client sends under that name is
    // ignored rather than merged or used as a fallback.
    const { context, messages, useOpus, conversationId } = await req.json();

    if (!isChatContext(context)) {
      return NextResponse.json(
        { error: "Missing or malformed `context`" },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;

    // The client always sends the current turn as the last element of
    // `messages` (see buildApiMessages in page.tsx).
    async function persistIfPossible(reply: string): Promise<string | null> {
      const lastMessage = messages?.[messages.length - 1];
      if (!lastMessage || lastMessage.role !== "user") return null;
      return persistTurn({
        userId,
        conversationId,
        userContent: lastMessage.content,
        assistantReply: reply,
      });
    }

    // Fetched once up front (not per-branch) since both the Claude and Groq
    // paths need the enriched system prompt, and persistMemories below
    // reuses this exact list rather than re-querying.
    const existingMemories = await fetchUserMemories(userId);
    const enrichedSystem = `${buildSystemPrompt(context)}${buildMemorySystemAddition(existingMemories)}`;

    async function persistMemoriesIfPossible(actions: any[]): Promise<void> {
      if (!Array.isArray(actions) || !actions.some((a) => a?.type === "remember")) return;
      const sb = getSupabaseAdmin();
      if (!sb) return;
      // Only checked when there's actually a remember action to gate — no
      // reason to pay for this admin-API round trip on the vast majority of
      // turns that don't touch memory at all.
      const autoMemoryEnabled = await isAutoMemoryEnabled(userId);
      await persistMemories(sb, userId, actions, existingMemories, autoMemoryEnabled);
    }

    // Free-tier daily Sonnet cap — reserved unconditionally before any model
    // call, including when useOpus was requested but the user isn't
    // actually eligible for it and would otherwise silently fall back to
    // Sonnet below, since that fallback is still subject to the same cap.
    // Active subscribers always pass immediately with no reservation (see
    // resolveSonnetEligibility).
    {
      const sonnetEligibility = await resolveSonnetEligibility(userId);
      if (sonnetEligibility.reservation) activeReservation = { userId, ...sonnetEligibility.reservation };
      if (!sonnetEligibility.allowed) {
        return NextResponse.json({
          actions: [],
          reply:
            "You've hit today's limit of 10 free messages — it resets tomorrow, or upgrade to Pro for unlimited Sonnet messages any time.",
          conversationId: null,
        });
      }
    }

    // Claude Sonnet 5 — meaningfully stronger reasoning and instruction-following
    // than Haiku, which matters a lot here: the system prompt asks the model to
    // make judgment calls (when to ask a clarifying question vs just act, how to
    // read an ambiguous request, how to explain what it did in its own words).
    if (apiKey) {
      let model = "claude-sonnet-5";
      let maxTokens = 4096;
      let opusFallback = false;

      if (useOpus) {
        const eligibility = await resolveOpusEligibility(userId);
        if (eligibility.reservation) activeReservation = { userId, ...eligibility.reservation };
        if (eligibility.allowed) {
          model = "claude-opus-4-8";
          maxTokens = 8192;
        } else if (eligibility.overLimit) {
          // Genuinely Pro, but this period's Opus credits are spent. Falling
          // back to Sonnet is the INTENDED behaviour, not a gap to be closed
          // later: a hard stop was considered and rejected. Exhausting the
          // premium allowance degrades the model a paying subscriber gets, it
          // does not take chat away from them — refusing the message would
          // turn a spent perk into a broken product.
          //
          // The frontend is told via opusFallback so it can note which model
          // actually answered, and a separate warning appears client-side at
          // 90% of the cap so the degrade is never the first the user hears
          // of it. Please don't "fix" this into an error response.
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
          // text placeholder before it ever reaches this route. system is
          // the enriched version (client's prompt + this user's memories
          // appended) built above, not the raw client-sent one.
          system: enrichedSystem,
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
      // toolUseBlock.input is already a genuinely parsed object (JSON.parse
      // ran once, on the raw HTTP response body) — so if reply still
      // contains the two literal characters \ and n instead of a real line
      // break, that's not a parsing bug on our end, it's the model itself
      // occasionally double-escaping a newline inside the tool call's JSON
      // arguments. Normalizing it back here is safe: nothing in a
      // scheduling assistant's reply ever legitimately needs to show a
      // literal backslash-n.
      const rawReply: string =
        toolUseBlock.input?.reply ?? "I had trouble processing that — could you try rephrasing?";
      const reply = rawReply.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n");

      // No post-call increment here anymore — reserveUsage already counted
      // this request, before the fetch above, exactly once. Nothing further
      // to do on success; a failure path (above or in the outer catch) is
      // what calls releasePendingReservation instead.

      const persistedConversationId = await persistIfPossible(reply);
      await persistMemoriesIfPossible(actions);

      return NextResponse.json({
        actions,
        reply,
        ...(opusFallback ? { opusFallback: true } : {}),
        conversationId: persistedConversationId,
      });
    }

    // Groq fallback — only used if ANTHROPIC_API_KEY isn't set (e.g. Claude API
    // outage or misconfiguration). Kept as a safety net, not the primary path.
    // Groq's OpenAI-compatible API still supports temperature normally and
    // doesn't have thinking blocks, so this one is untouched. No Opus/usage
    // logic applies here — Groq is never Sonnet or Opus. Groq doesn't support
    // Anthropic's tool_choice syntax, so this stays prompt-based — recovered
    // into the same {actions, reply} shape via parseGroqResponse above.
    if (groqKey) {
      // Groq never counted against Nova/Vega usage even before this fix
      // (see the comment above this branch) — but the Sonnet reservation
      // above runs unconditionally, before either model branch is chosen, so
      // a free user's reservation must be released here before anything
      // else, or a Groq-served reply would silently cost them one of their
      // free messages for the first time.
      await releasePendingReservation();

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
          messages: [{ role: "system", content: enrichedSystem }, ...groqMessages],
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.choices?.length) {
        console.error("Groq error:", data);
        throw new Error(data.error?.message ?? "Groq API error");
      }
      const { actions, reply } = parseGroqResponse(data.choices[0].message.content);
      const persistedConversationId = await persistIfPossible(reply);
      await persistMemoriesIfPossible(actions);
      return NextResponse.json({ actions, reply, conversationId: persistedConversationId });
    }

    // Neither model is reachable — no AI call will ever happen for this
    // request, so any reservation made above must not stand.
    await releasePendingReservation();
    return NextResponse.json(
      {
        actions: [],
        reply: "No AI API key configured. Add ANTHROPIC_API_KEY in Vercel environment variables.",
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Ask route error:", err);
    // Covers every throw above (Claude non-OK response, missing tool_use
    // block, Groq error) — a failed request must cost nothing, so release
    // whatever reservation was made before reporting the failure.
    await releasePendingReservation();
    return NextResponse.json(
      {
        actions: [],
        reply: "Something went wrong on my end — try rephrasing, or try again in a moment.",
      },
      { status: 200 }
    );
  }
}
