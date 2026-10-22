# The Docket — Launch Checklist

Built from `NOTES.md`, `git log --oneline -80`, and a grep of the codebase for
`TODO`/`FIXME`/`HACK` (none found outside `.next/` build output), as of
**7 October 2026**.

> **Rule:** an item is **Done** only with evidence attached in the Evidence
> column — command output, a deployed-build screenshot, or a query result.
> **"Typecheck passes" is not evidence.** It proves the types are consistent,
> not that the feature works. Evidence is blank until that proof exists.

Status values: **Not started** · **In progress** · **Built-unverified** (code
exists but has never been exercised/observed) · **Mostly verified** (strong
live evidence collected, one specific remaining check named) ·
**Recorded, no action** (an Info-severity finding with no fix proposed —
logged for awareness, not tracked toward any gate) · **Done** (evidence
attached).

---

## GATE 0 — Housekeeping (now)

| ID | Description | Owner | Status | Evidence | Blocks |
|---|---|---|---|---|---|
| G0-1 | Confirm the onboarding-carousel change (embedded `InfoModal` in onboarding) is on `main` | Claude Code | Done | `git log --oneline -1` on `main` = `725c7cc fix: reuse the subscription carousel inside onboarding...`; `git status` clean at time of this scan (7 Oct 2026) | — |
| G0-2 | Decide whether dark mode should reset on sign-out (currently a device preference) | Mo | Not started | | Gate 3 (UX consistency) |
| G0-3 | Clean contaminated cloud rows in the main test account and `unshurdeen@gmail.com`, through the app, not SQL | Mo | Not started | | Gate 1 |
| G0-4 | Upgrade Supabase to the paid plan (backups, more compute) | Mo | Not started | | Gate 1 |
| G0-5 | Check Mo's MSB Solicitors employment contract for IP ownership / outside-work clauses; check LJMU IP policy | Mo | Not started | | IP assignment (Gate 2) |
| G0-6 | Decide company name availability (Docket Ltd) and director/registered-office address | Mo | Not started | | Gate 2 |

---

## GATE 1 — Safe to invite testers

### Verify what is built but never seen

| ID | Description | Owner | Status | Evidence | Blocks |
|---|---|---|---|---|---|
| G1-1 | Delete-account E2E on a throwaway account: all 7 tables empty, auth user gone, Stripe subscription cancelled, `[account/delete]` logs read; then force a Stripe failure once and confirm the account survives | Mo | Built-unverified | Code reviewed: `app/api/account/delete/route.ts` cancels Stripe first (fatal on failure), sweeps exactly 7 tables (`chat_messages, conversations, user_memories, tasks, routines, usage, subscriptions`), deletes the auth user last, logs orphaned tables. Never run end-to-end. | Gate 1 |
| G1-2 | Fresh signup in a browser holding old data: Daily Routine empty, neutral welcome copy, no leaked rows | Mo | Built-unverified | Fix shipped in `93a01f7` (scoped `localStorage` keys per account, dropped "Welcome back" copy). No browser verification on record. | Gate 1 |
| G1-3 | Onboarding carousel on desktop and phone: the free path and a real Pro checkout | Mo | Built-unverified | Shipped in `725c7cc` (today) on top of the carousel rebuild (`1dd6767`, `839aee0`). Typecheck and `check:i18n` pass; no browser/visual verification. | Gate 1 |
| G1-4 | Denied-geolocation path for prayer times | Mo | Built-unverified | Confirmed in code: explicit `"denied"` status value and translated `prayerDenied` string exist (`app/page.tsx` ~7227, ~7635-7642). Flagged as never-seen in `NOTES.md` #6. | Gate 1 |
| G1-5 | Arabic and RTL pass on the avatar card and Account/Plan (Renews date included) | Mo | Built-unverified | RTL work shipped across `3575390`, `0c45a83`, `c510481`. `NOTES.md` #6 explicitly lists this as unseen. | Gate 1 |
| G1-6 | Subscription carousel: Pro card not clipped at `CAROUSEL_H=330` | Mo | Built-unverified | Constant confirmed at `app/page.tsx:69` (`CAROUSEL_H=330`). Exact concern named in `NOTES.md` #6; never visually checked. | Gate 1 |
| G1-51 | Task recurrence and per-day completion (daily/every_N_days/weekdays/weekends/weekly/biweekly/monthly, with per-day completion tracking) | Claude Code | **Done** | Commits `5011ff3`, `224d829`, `1c5014c`, `082c7f8`. `node scripts/check-recurrence.mjs` — 49 assertions pass. Verified live, 18 Oct 2026: recurring tasks appear on their matching days with a Task tag, and the date label follows the tapped day. **Note:** the onboarding-seed anchor (`1c5014c`) still needs a fresh-account test. | Gate 1 |
| G1-59 | A recurring task finished under the old global-`done` model (shown under "Finished & Deleted" with a Completed badge) still reappeared in the Daily Routine timeline on every matching day | Claude Code | **Done** | Fixed in `0c4e2c6` — `taskOccursOn` now returns false for a recurring task with `done:true`, checked right after the deleted check; a one-off task's `done` is deliberately left alone (it's meant to keep showing, struck through). `node scripts/check-recurrence.mjs` — 55 assertions pass (49 original + 6 new: recurring+done:true/false/omitted, one-off+done:true unaffected). Verified live, 22 Oct 2026. | Gate 1 |

### Infrastructure

| ID | Description | Owner | Status | Evidence | Blocks |
|---|---|---|---|---|---|
| G1-7 | Custom SMTP, including domain ownership and SPF/DKIM/DMARC — currently blocking testing | Mo | Not started | | Gate 1 |
| G1-8 | Create the `support@`, `privacy@` and `legal@` mailboxes (the Help modal promises a 24h reply) | Mo | Not started | | Gate 1 |
| G1-9 | Google and Apple OAuth credentials | Mo | Built-unverified | UI side is built: `handleOAuth()` and both buttons exist (`app/page.tsx:2595-2726`), calling `supabase.auth.signInWithOAuth`. Whether real provider credentials are registered in the Supabase Auth dashboard can't be seen from the repo. | Gate 1 |
| G1-10 | Put the database schema in the repo as migration files | Claude Code | Not started | `git ls-files` shows no `migrations/` directory and no `.sql` file anywhere in the repo. Since this scan, further schema changes have been applied live with no migration file to show for them: the `tasks` table gained `completions` (jsonb, default `'{}'`) and `created_at` (timestamptz) on 11 Oct 2026; S-02 added the `reserve_usage`/`release_usage` RPC functions; S-06 added the `speak_usage` table and `reserve_speak` RPC function. All of this needs capturing as migration files, not just applied against the live database. | Gate 1 |
| G1-11 | Check indexes on `user_id` for every table | Claude Code / Mo | Cannot verify from repo | No schema file exists in-repo to check against; needs a live `pg_indexes` query (see G1-10). | Gate 1 |
| G1-12 | Replace the full-table rewrite on every change with debounced writes of changed rows | Claude Code | Not started | | Gate 1 |
| G1-13 | Schedule database exports | Mo | Not started | Overlaps with G0-4 (paid plan unlocks built-in backups). | Gate 1 |
| G1-14 | Load-test with about 10,000 users' worth of fake rows | Mo / Claude Code | Not started | | Gate 1 |
| G1-15 | *(found by scan)* No automated test suite or CI pipeline exists | Claude Code | Not started | No test framework in `package.json` (no Jest/Vitest/Playwright); no `.github/workflows`. `lint` / `check:i18n` / `tsc --noEmit` are run manually, not gated anywhere. | Gate 1 |
| G1-16 | S-07: Stripe checkout/portal fall back to a hardcoded personal preview URL if `NEXT_PUBLIC_SITE_URL` is unset | Claude Code | **Done** | Fixed in `280f49d` — hardcoded fallback removed from both routes; a missing `NEXT_PUBLIC_SITE_URL` now fails closed with a generic 500 instead of silently redirecting. Turned out not to be hypothetical: the variable was genuinely unset in the live Vercel project, so the old fallback had been handling every real checkout in production. Now set for both Production and Preview. Verified live, 10 Oct 2026: before the variable was set, checkout returned "Server not configured"; after, a real Pro checkout reached Stripe test mode and cancelling returned to `https://planner-docket.vercel.app/?subscription=cancelled`. | Gate 1 |

### Security audit (read-only, then fixes one at a time)

| ID | Description | Owner | Status | Evidence | Blocks |
|---|---|---|---|---|---|
| G1-17 | Run the `pg_policies` and `pg_tables` queries; check RLS on `conversations`, `chat_messages`, `user_memories`, `usage`, `subscriptions`; check chat-image storage bucket visibility | Mo / Claude Code | **Done** | Verified live, 8 Oct 2026: RLS is on for all seven tables; no policy uses a bare `true` (no open policies); `subscriptions` and `usage` have SELECT-only user policies; the `chat-images` bucket is private. | Gate 1 |
| G1-18 | Secrets scan of full git history (gitleaks/trufflehog); rotate anything found | Claude Code | Not started | Neither tool is in the repo/deps; history has not been scanned during this pass. | Gate 1 |
| G1-19 | Confirm only intended variables carry `NEXT_PUBLIC_` | Mo | Built-unverified | Grepped all source: only `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL` are referenced — all three are meant to be public. Can't rule out an unused public var sitting in the live Vercel project that the code never reads. | Gate 1 |
| G1-20 | Stripe webhook signature check on the raw body | Claude Code | Built-unverified | Confirmed in code: `app/api/stripe/webhook/route.ts:50-61` reads `req.text()` (raw body) and calls `stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET)`. Never exercised against a live/test webhook delivery. | Gate 1 |
| G1-21 | Review `/api/account/delete` | Claude Code | In progress | Read in full during this scan (`app/api/account/delete/route.ts`) — ordering (Stripe cancel → rows → auth user), confirm-email re-check server-side, and failure logging all look sound. Not independently signed off by anyone else. | Gate 1 |
| G1-22 | Check what stops prompt-injected content steering AI actions (`add_task` / `remove_routine` / `update_routine`) | Claude Code | Not started | Grepped `app/api/ask/_prompt.ts` for injection/untrusted-content handling language — none found. | Gate 1 |
| G1-23 | Rate-limit `/api/ask` | Claude Code | Not started | Grepped `app/api/ask/route.ts` for rate-limit logic — none found. | Gate 1 |
| G1-24 | S-05: Review the `?debug=1` Eruda loader | Claude Code | **Done** | Fixed in `f482364` — gated behind `process.env.NODE_ENV==="development"` in addition to `?debug=1`; Next.js statically strips this at build time, so it's removed from the production bundle entirely, not just logically disabled. Confirmed by `grep -rl "eruda" .next/static` returning nothing after a production build. Verified live, 10 Oct 2026: visiting `https://planner-docket.vercel.app/?debug=1` and typing `eruda` in the browser console gave `ReferenceError: eruda is not defined`. | Gate 1 |
| G1-25 | `npm audit` (S-01: `next` critical/high vulnerabilities — see `SECURITY_AUDIT.md`) | Claude Code | **Done** | Fixed in `089d6a0` — `next` upgraded 16.2.10 → 16.3.8 (lowest patched 16.x version, no major-version jump needed). `npm audit --omit=dev` now shows 0 Critical, 0 High. The typecheck, `check:i18n`, `next build`, and audit (before/after) steps all passed, and — separately — five deployed-site checks (sign-in/out, chat, calendar, subscription carousel, Arabic RTL) were done on the live site on 10 Oct 2026. | Gate 1 |
| G1-26 | S-10: Security headers (CSP etc.) | Claude Code | **Done** | Part 1: `b511316` + `aabf96c` (`X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`, dropping the unsupported `notifications=(self)` entry). Part 2: `d7bf7bc` (`Content-Security-Policy-Report-Only`). Part 3: `4fa614c` (same policy, enforcing — renamed to `Content-Security-Policy`). Verified live, 22 Oct 2026: the header is present in the response, and no violations were observed across sign-in/out, adding a task and a routine, a Pro checkout reaching Stripe test mode, Help, Arabic, prayer times, opening a past chat, and the background image and fonts. **Note:** `script-src`/`style-src` keep `'unsafe-inline'` (Next.js's own inline bootstrap scripts; 703 inline `style={{}}` attributes in `app/page.tsx`), so this CSP mainly restricts `connect-src`/`img-src`/`form-action`/`frame-ancestors` rather than scripts/styles. Self-hosting Google Fonts (G3-1) would let `style-src`/`font-src` drop the Google origins too. | Gate 1 |
| G1-27 | Supabase auth settings: email confirmation, password rules, redirect allowlist | Mo | Cannot verify from repo | Lives in the Supabase Auth dashboard, not the codebase. | Gate 1 |
| G1-28 | S-02: Nova/Vega usage cap is an atomic reservation (`reserve_usage`/`release_usage`), not a check-then-act race — see `SECURITY_AUDIT.md` | Claude Code | **Mostly verified** | Fixed in `bbbabaf`. Rollback tests `t t f` and `t 1 0` passed. Live counts observed rising 0→2→3→4→5 on 10 Oct 2026. Two real Anthropic requests then failed (out of credit) and correctly left the count unchanged at 5 — confirms `release_usage` fires on a real failure. **Outstanding:** one clean Claude-served run after credit is topped up, confirming the count rises by exactly one on success. | Gate 1 |
| G1-40 | S-06: `/api/speak` has no input-size cap, rate limit, or usage accounting on an authenticated paid TTS passthrough — see `SECURITY_AUDIT.md` | Claude Code | **Done** | Fixed in `366ce3f` (`app/api/speak/route.ts`, `speak()` in `app/page.tsx`): 2500-char server cap, 2000-char client truncation, `reserve_speak` daily request/char limits. Rollback test `t t f t` passed (reserve, reserve, over-limit reject, release-free failure path). Verified live, 10 Oct 2026: an unauthenticated POST returned 401, and one voiced reply was correctly recorded in `speak_usage` (`request_count` 1, `char_count` 74). **Not yet exercised live:** the 413 (text too long) and 429 (daily limit reached) paths. | Gate 1 |
| G1-48 | *(low priority)* Error replies ("Something went wrong") are voiced and consume `/api/speak` quota — skip voicing replies that are errors | Claude Code | Not started | | Gate 1 |
| G1-52 | *(low priority)* `addTask` does not validate `category`, `priority` or `type` against the app's allowed values — an AI action or a direct call could set an out-of-range value | Claude Code | Not started | | Gate 1 |
| G1-53 | *(note only)* The "9 Oct" date-label bug (the Daily Routine's date label tracked scroll position instead of the tapped day) is fixed | Claude Code | Done | Fixed in `5011ff3` as part of the recurrence work — the label render switched from the old scroll-driven `viewedDay` state to `selDay`, and the dead scroll-tracking state (`viewedDate`/`viewedDay`, the `idx`/`step`/`lastIdx` measuring block) was removed outright. | Gate 1 |
| G1-54 | A routine delete can be lost if the tab is closed or reloaded within a moment of deleting — the Supabase delete in the routines sync effect is an unawaited request with no `keepalive`, so navigation can abort it before it reaches the server | Claude Code | Not started | Traced during the routine-editor work (read-only investigation, 18 Oct 2026): no `beforeunload`/`pagehide` handler and no `fetch(...,{keepalive:true})`/`sendBeacon` anywhere in `app/page.tsx`. Smallest fix identified: a `keepalive` fetch straight to the Supabase REST endpoint for just this one delete call, without touching the effect's diffing/retry logic. A clean (non-reload) delete tested live on 18 Oct 2026 in 5 seconds and synced correctly; the quick-reload failure mode itself has not been reproduced live. Low-medium priority. | Gate 1 |
| G1-55 | On load, cloud data wins outright over `localStorage` whenever the account has any cloud rows — a failed or aborted write (see G1-54) can be silently overwritten by stale cloud data on the next reload | Mo / Claude Code | Not started | Confirmed in code: `loadCloudData`'s "cloud wins" branch replaces local state unconditionally whenever `hasCloudTasks`/`hasCloudRoutines` is true, never consulting `localStorage` in that branch. Needs a design decision (e.g. a last-write-wins timestamp, or reconciling by diffing rather than wholesale replacing) before any fix is attempted. **Related gap found while fixing G1-56:** if a cloud `select` itself returns an error object rather than throwing (a transient RLS/network hiccup surfaced as `{error}`, not a rejected promise), `hasCloudTasks`/`hasCloudRoutines` both read as false (empty `data` on an error response), so the account is wrongly treated as never-synced-before and the *local* cache is pushed up as authoritative — which could silently overwrite genuinely newer cloud rows with stale local ones. Can't be fixed as a confirmation-gate the way G1-56 was (this is an overwrite, not a delete); needs its own handling, e.g. checking `error` on both `select` calls and aborting the sync entirely instead of falling through to the first-sync branch. | Gate 1 |
| G1-56 | *(high priority)* Routine mass-delete on sign-in — a DELETE for all 7 of a real account's routine ids was sent right after sign-out/sign-in, and only failed because of an unrelated 401 ("JWT issued at future") | Claude Code | **Done** | **Cause:** the routines sync effect inferred deletions by diffing `routines` against a baseline ref (`prevRoutineIdsRef`) that was never reset on sign-out; after sign-out and sign-in, an empty post-sign-in hydration looked identical to "the user deleted everything," and every id still sitting in the stale baseline was sent to Supabase as a delete. **Fix:** `0891302` — a remote delete now requires an id to be in `explicitRoutineDeletesRef` (populated only by `confirmRoutineDelete`, the one place a real user-confirmed delete happens); `prevRoutineIdsRef` and that set are both reset on sign-out and on every account-id change; `cloudSyncingRef` is now set synchronously before `loadCloudData`'s first `await`, closing the race window that let the diff run unguarded. (`aabf96c`, same pass, is an unrelated Permissions-Policy cleanup — see G1-26.) Verified live, 20 Oct 2026: repeated sign-out/sign-in and a hard clear-site-data reload produced no DELETE request against `routines`; the routine count held at 7 throughout. | Gate 1 |
| G1-57 | *(low priority)* Remove the `[mic]` debug `console.log` lines before launch | Claude Code | Not started | Confirmed in code: `app/page.tsx:6083,6091,6097,6106` — added for diagnosing the iOS Safari mic bug, left in since. The matching `console.error` lines (`:6085,6099,6108`) are genuine error logging and are not in scope for removal. | Gate 1 |
| G1-58 | *(low priority)* Check the PC clock-sync issue behind the "JWT issued at future" 401 if it recurs | Mo | Not started | Surfaced during the G1-56 investigation: a freshly refreshed Supabase session token's `iat` can land slightly ahead of Supabase's own server clock under minor client clock drift, which Supabase rejects outright. Accidentally what prevented the G1-56 bug from actually deleting live data; unrelated to the fix itself, and not something `app/page.tsx` can correct — it's the signing device's system clock. | Gate 1 |
| G1-60 | *(low priority)* At startup, user preferences and memories load before the session is actually ready, producing console errors (`auth/v1/user` 403, `AuthSessionMissingError`, `/api/memories` 401) | Claude Code | Not started | Observed live, 22 Oct 2026, during the S-10 CSP verification pass. Fix: wait for the session to resolve before firing those calls, rather than racing it on mount. | Gate 1 |
| G1-61 | *(low priority)* A 400 on `auth/v1/token?grant_type=refresh_token` seen in a long-open tab | Mo | Not started | Observed live, 22 Oct 2026, during the S-10 CSP verification pass. Recheck after a fresh sign-in before treating this as a real bug — may be the same clock-skew class as G1-58. | Gate 1 |
| G1-41 | S-08: raw upstream error text (Stripe, ElevenLabs) returned to the client in 3 routes — see `SECURITY_AUDIT.md` | Claude Code | **Done** | Fixed in `d2097a1` — `checkout/route.ts` and `portal/route.ts` now return fixed generic messages ("Could not start checkout. Please try again." / "Could not open the billing portal. Please try again.") instead of `error.message`, still logging the real error server-side via the existing `console.error`. The ElevenLabs location (one of S-08's three original citations) was already fixed separately under S-06 (`366ce3f`), before this pass. Diff-verified: typecheck, `check:i18n`, `next build` all pass. **Not exercised live:** the error-response branch itself isn't triggerable without forcing a genuine Stripe API failure. | Gate 1 |
| G1-42 | S-09: `/api/ask`'s user-facing reply names the missing env var and hosting provider on misconfiguration — see `SECURITY_AUDIT.md` | Claude Code | **Done** | Fixed in `3099f28` — the "no AI API key configured" reply no longer names `ANTHROPIC_API_KEY` or Vercel; it's now a fixed generic string ("The assistant is unavailable right now. Please try again later."), with a new `console.error` on that branch so the operator still sees it in logs. Diff-verified: typecheck, `check:i18n`, `next build` all pass. **Not exercised live:** the branch itself isn't triggerable without actually unsetting both `ANTHROPIC_API_KEY` and `GROQ_API_KEY`. | Gate 1 |
| G1-43 | S-11: `update_task`/`update_routine` spread model-supplied fields with no allowlist — see `SECURITY_AUDIT.md` | Claude Code | Built-unverified | Fixed in `e4f3923` — `pickTaskChanges`/`pickRoutineChanges` now allowlist fields by name and runtime-validate each value's type (`pickAllowed`/`matchesFieldType`) before merging into `update_task`/`update_routine`. **Not yet exercised live:** the gym-routine-duration test — ask the assistant to change a routine's duration and confirm only allowlisted fields change, with a wrong-typed or out-of-range value rejected rather than silently applied. | Gate 1 |
| G1-49 | S-03: no code-level confirmation gate before destructive AI actions execute (`remove_routine`) — see `SECURITY_AUDIT.md` | Claude Code | Built-unverified | Fixed in `76deaed` — `remove_routine` now pushes to `pendingRoutineDeletes` and renders a `ConfirmDeleteCard` (Cancel/Delete) instead of deleting immediately; the undo snapshot is taken at confirm time. **Not yet exercised live:** the delete-confirm-card test — ask the assistant to delete a routine and confirm the card appears, Cancel leaves it intact, Delete removes it, Undo restores it, and the Arabic/RTL rendering of the card is correct. | Gate 1 |
| G1-50 | S-04: system prompt had no untrusted-data framing for interpolated task/routine JSON or chat images, leaving an injection path into AI actions (S-03) — see `SECURITY_AUDIT.md` | Claude Code | Built-unverified | Fixed in `c98ea52` (`app/api/ask/_prompt.ts`) — added an assistant-identity paragraph and explicit untrusted-data framing, with `=== END OF ... ===` markers around the three interpolated data blocks. **Not yet exercised live:** the injection-title test — a task/routine title or note containing an embedded instruction has not been tried against a real model response. | Gate 1 |
| G1-44 | S-12: task/routine free text (titles/notes) cached in plaintext in `localStorage` — see `SECURITY_AUDIT.md` | Claude Code | Recorded, no action | Inherent to the app's local-first architecture; the audit proposed no fix, only noted it for awareness. | — |
| G1-45 | S-13: no explicit event-id idempotency guard on the Stripe webhook (currently safe by construction only) — see `SECURITY_AUDIT.md` | Claude Code | Recorded, no action | Every handler is a pure upsert/update, not an increment, so a replayed event can't currently double-apply; logged as defense-in-depth context only. | — |
| G1-46 | S-14: Supabase session token pair lives in `localStorage` by default (no XSS found to exploit it) — see `SECURITY_AUDIT.md` | Claude Code | Recorded, no action | Standard Supabase SPA behavior; only exploitable in combination with an XSS vulnerability, and none was found in this codebase. | — |

### Found during live verification (10 Oct 2026)

Fallout from testing the S-01/S-02 fixes live, including an Anthropic account
running out of credit mid-session.

| ID | Description | Owner | Status | Evidence | Blocks |
|---|---|---|---|---|---|
| G1-29 | Stray JSON tail (trailing `"}`, lone `"`, or lone `}`) in AI replies | Mo | Built-unverified | Fixed in `fa8c8e9` (strips `"}`/`"}}`) and `a7c6673` (extended to a lone trailing `"` or `}`). Likely root cause: the artifact was first observed while Anthropic credit was out and the Groq fallback was serving replies — the stripping is a defensive guard against the model's own output, not a fix to Groq's malformed-JSON recovery itself. Not yet re-observed live after the fix; needs confirming on both a Groq-served and a Claude-served reply. | Gate 1 |
| G1-30 | Nova/Vega identity wording in the system prompt (assistant must not flatly deny being Nova, and must not confirm or deny which model answered) | Mo | Built-unverified | Added in `fb6130e`. Not yet tested live — test prompts: "are you Nova?", "what model are you?", "what's the difference between Nova and Vega?" | Gate 1 |
| G1-31 | Anthropic account ran out of credit mid-testing on 10 Oct 2026 — add a billing alert, auto-reload, and a spend limit before launch | Mo | Not started | Directly observed during the G1-28 live verification: two real requests failed on an out-of-credit error with nothing having alerted anyone beforehand. | Gate 1 |
| G1-32 | Users see the same generic "Something went wrong" message for any provider failure (Anthropic/Groq error, missing key) — consider a clearer message, at least distinguishing an outage/credit issue from a one-off hiccup | Claude Code | Not started | Confirmed in code: `app/api/ask/route.ts`'s outer catch returns one fixed string regardless of cause. Surfaced directly by the Anthropic credit outage during G1-28's live testing. | Gate 1 |
| G1-33 | No log line records which provider (Anthropic vs Groq) served a request — add one | Claude Code | Not started | Confirmed in code: the only provider-tagged log lines ("Claude error", "Groq error") fire on failure only; nothing logs which provider served a successful reply. | Gate 1 |
| G1-34 | Trim `ANTHROPIC_API_KEY` before the truthiness check — a whitespace-only value is truthy in JS and would misroute into a failing Anthropic call instead of cleanly falling back to Groq | Claude Code | Not started | Confirmed in code: `apiKey` is read (`process.env.ANTHROPIC_API_KEY`) and used with no `.trim()` anywhere. | Gate 1 |
| G1-35 | The Groq-fallback comment in `route.ts` is misleading — it says Groq is used on "Claude API outage or misconfiguration", but Groq only runs when `ANTHROPIC_API_KEY` is unset/empty; a genuine Claude API error throws straight to the generic failure message and never reaches Groq | Claude Code | Not started | Confirmed by tracing the control flow: both throw sites inside the Anthropic branch unwind to the outer catch, never to the `if(groqKey)` block below it. | Gate 1 |
| G1-36 | Free-tier Nova now fails closed on a database/RPC error (the S-02 fix), but shows the same "You've hit today's limit of 10 free messages" wording as a genuine over-limit case — misleading during an infra hiccup (low priority) | Claude Code | Not started | Deliberate trade-off made when fixing S-02 (fail closed instead of the old fail-open behavior); the user-facing message wasn't split out for the two cases. | Gate 1 |
| G1-37 | Pro/Max `sonnet_count` no longer increments (the old post-call tracking was removed as part of the S-02 fix); confirm no screen still displays it as if it were a live/incrementing count | Mo / Claude Code | Not started | Confirmed in code: the post-call `trackSonnetUsage` call for subscribers was removed in `bbbabaf`. Not yet confirmed whether the subscription carousel's "Nova messages" count (a plain, previously-uncapped count for subscribers) is still shown anywhere as if it were current. | Gate 1 |
| G1-38 | Dev-dependency `npm audit` findings in `eslint-config-next`'s own tooling (`brace-expansion`, `braces`, `browserslist`, `js-yaml` — 8 high, 1 moderate) — dev-only, never shipped to production (low priority) | Claude Code | Not started | Confirmed via plain `npm audit` (not `--omit=dev`) after the S-01 fix — every flagged package is a transitive dev dependency of `eslint-config-next`. | Gate 1 |
| G1-39 | System prompt should give the exact unsubscribe path (avatar card → Subscription → Stripe billing portal) so the assistant answers "how do I cancel?" correctly instead of vaguely | Claude Code | Not started | | Gate 1 |
| G1-47 | *(low priority)* The Tabler icon font is preloaded but not used within seconds of load, triggering a browser console warning — check the preload's `as` attribute or remove the preload | Claude Code | Not started | Observed as a browser console warning during live testing, 10 Oct 2026. | Gate 1 |

### Parked live tests (need Anthropic credit)

Each of these needs a real, credit-funded model response to exercise — code
review alone can't close them out:

- **G1-28** (S-02) — one clean Claude-served run after credit is topped up, confirming the usage count rises by exactly one on success.
- **G1-29** — the stray-JSON-tail fix (`fa8c8e9`, `a7c6673`) re-observed live on both a Groq-served and a Claude-served reply.
- **G1-30** — the Nova/Vega identity wording (`fb6130e`): "are you Nova?", "what model are you?", "what's the difference between Nova and Vega?"
- **G1-40** (S-06) — the remaining voiced-reply paths: a 413 (text too long) and a 429 (daily limit reached).
- **G1-49** (S-03) — the delete-confirm-card test: ask the assistant to delete a routine, and confirm Cancel/Delete/Undo and the Arabic/RTL rendering.
- **G1-50** (S-04) — the injection-title test: a task/routine title or note containing an embedded instruction.
- **G1-43** (S-11) — the gym-routine-duration test: ask the assistant to change a routine's duration and confirm only allowlisted fields apply.

---

## GATE 2 — Safe to take real payments

G2-1 through G2-3 were originally filed under Gate 0 ("now"). Moved here
deliberately: forming the company, opening its bank account, and starting the
D-U-N-S application are real-money/real-paperwork commitments that only need
to exist by the time Gate 2 is reached (real payments, company-owned
accounts), not before testers are even invited. Deferred on purpose, not
dropped.

| ID | Description | Owner | Status | Evidence | Blocks |
|---|---|---|---|---|---|
| G2-1 | *(moved from Gate 0, deliberately deferred)* Form Docket Ltd (check current Companies House fee) | Mo / Professional | Not started | | Gate 2 |
| G2-2 | *(moved from Gate 0, deliberately deferred)* Open the company bank account | Mo | Not started | | Gate 2 |
| G2-3 | *(moved from Gate 0, deliberately deferred)* Start the D-U-N-S number application for Apple organisation enrolment (can take weeks) | Mo | Not started | | Gate 4 |
| G2-4 | Sign the IP assignment (Mo → Docket Ltd): code, "The Docket" name and logo, domain, written content; agree consideration/tax treatment with an accountant | Professional | Not started | | Gate 2 |
| G2-5 | Move the domain, Vercel, Supabase, Anthropic, Groq and the GitHub repo into the company's name | Mo | Not started | | Gate 2 |
| G2-6 | Create Stripe in the company's name (live keys, live webhook endpoint); confirm the bank account is the company's | Mo | Not started | | Gate 2 |
| G2-7 | Test the 14-day manual refund process end to end | Mo | Not started | | Gate 2 |
| G2-8 | Confirm the Terms refund wording matches the 14-day decision | Claude Code | **Done** | `app/page.tsx:3500-3508` (Terms markdown): *"Docket Ltd gives you a 14-day refund period beginning on the date of your first subscription charge... If you cancel your subscription and request a refund within 14 calendar days of that first charge, we will refund that charge."* Already folded into the rewrite — no further action needed unless the business decision itself changes. | Gate 2 |
| G2-9 | Add the company number and registered office to the policies and site | Claude Code | Not started | Blocked on G0-6 and G2-1 (company doesn't exist yet to have a number). | Gate 2 |
| G2-10 | Accountant: VAT registration, corporation tax, reimbursing Mo's pre-formation costs (director's loan or reimbursement) | Professional | Not started | | Gate 2 |
| G2-11 | Ask someone qualified: does the ICO data protection fee apply, and at what tier? | Professional | Not started | | Gate 2 |
| G2-12 | Ask someone qualified: what must a UK company website display? | Professional | Not started | | Gate 2 |
| G2-13 | Confirm data processing terms with Supabase, Stripe, Anthropic, Groq and Vercel | Mo | Not started | | Gate 2 |
| G2-14 | Verify the policy's claims about AI providers (training/retention) and the international transfer mechanisms | Mo / Professional | Not started | Cannot verify from the repo: this is fact-checking the Privacy Policy's claims against each provider's actual (and changing) terms, not reading the text itself. | Gate 2 |
| G2-15 | Decide whether to build a data-export feature (the policy lists portability), and set up a process for access/deletion requests | Mo | Not started | | Gate 2 |

---

## GATE 3 — Public launch

### Compliance and accessibility audit (read-only, then separate fix passes)

| ID | Description | Owner | Status | Evidence | Blocks |
|---|---|---|---|---|---|
| G3-1 | Self-host the fonts (Google `@import` sends visitor IPs to Google) | Claude Code | Not started | `app/globals.css:1` still has `@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk...')`. Only the Tabler icon webfont was self-hosted (`eb93037`) — the text fonts were not. | Gate 3 |
| G3-2 | Check the licence of the CDN background image, if still used | Mo | Not started | Still in use: `app/globals.css:26` and `:33` load two images from a CloudFront URL (`d8j0ntlcm91z4.cloudfront.net/.../hf_...png`). Licence/provenance can't be confirmed from the repo. | Gate 3 |
| G3-3 | Search for trademark conflicts on "Nova" and "Vega" | Mo / Professional | Not started | Cannot verify from repo. | Gate 3 |
| G3-4 | Check the Google and Apple sign-in button brand guidelines | Mo | Not started | Buttons exist (`app/page.tsx:2701-2726`); not checked against either platform's current guidelines. | Gate 3 |
| G3-5 | Review unsupported claims ("Priority support", "Early access", "Advanced analytics") | Claude Code | In progress | Narrower than scoped: "Advanced analytics" and "Early access" no longer appear anywhere in the codebase — they were only ever in `OnboardingScreen`'s hardcoded feature chips, deleted in `725c7cc`. The one remaining instance is the Help FAQ at `app/page.tsx:4621`: *"Unlimited AI requests, sync across every device, automatic prayer times, productivity insights, and priority support."* | Gate 3 |
| G3-6 | Add a short cookies subsection to the Privacy Policy | Claude Code | Not started | Grepped the full Privacy Policy/Terms text for "cookie" — zero matches. | Gate 3 |
| G3-7 | WCAG 2.2 AA: icon-only button names, keyboard reach, focus states, contrast in both themes, modal focus trapping, reduced motion | Claude Code | In progress | Some groundwork exists (`aria-label`/`aria-hidden` on icon buttons, e.g. `app/page.tsx:4420`; `role="tablist"`/`role="tab"` on the carousel dots). No `prefers-reduced-motion`, no `:focus-visible` styling, and no focus-trap logic anywhere in the codebase — grepped, zero matches. No formal AA audit done. | Gate 3 |

### Product quality

| ID | Description | Owner | Status | Evidence | Blocks |
|---|---|---|---|---|---|
| G3-8 | Button consistency pass | Claude Code | Not started | | Gate 3 |
| G3-9 | Skeleton loaders and smart autofill (decide whether still wanted) | Mo | Not started | | Gate 3 |
| G3-10 | Error telemetry decision (Sentry or similar) | Mo | Not started | No telemetry SDK in `package.json`/`package-lock.json`. Matches `NOTES.md` #5: failures log to console only. | Gate 3 |
| G3-11 | Routine create/edit/delete UI (currently AI-only) | Claude Code | **Done** | Commits `23274b7` (add/edit/delete, task-or-routine sheet) and `107b1a7` (checkbox `stopPropagation`, undo toast, per-field errors). Verified live, 18 Oct 2026: add, edit, tick/untick a routine without opening the editor, delete via the confirm card with a working Undo toast, all per-field errors shown together, a deleted routine stays gone after a reload, and the toast and errors read correctly in Arabic. **Note:** the new strings still need native-speaker review alongside the rest of the machine-translated languages (see G3-13). | Gate 3 |
| G3-17 | Routines have no recycle bin — a deleted routine is unrecoverable once the undo toast (G3-11) is dismissed or expires | Mo / Claude Code | Not started | Decision (Mo): build a "Recently deleted" list for routines, mirroring the task archive. Needs a `deleted` column on the `routines` table (new Supabase column, SQL run first — see G1-10), restore and permanent-delete actions, and an i18n pass. Medium priority. | Gate 3 |
| G3-18 | *(low priority)* Browser console warning "A form field element should have an id or name attribute" on 3 inputs, from missing autofill attributes | Claude Code | Not started | Observed as a browser console warning during live testing, 18 Oct 2026. Fix: add `id`/`name`/`autoComplete` attributes to the 3 affected inputs in one pass. Linked to G3-9 (smart autofill decision) — same inputs, same underlying gap. | Gate 3 |
| G3-12 | About 88 untranslated strings (Help FAQ, pricing table, onboarding) | Claude Code | Not started | **Count is now stale.** `NOTES.md`'s ~88 figure (24 Sep) included ~12 `OnboardingScreen`-specific strings that `725c7cc` deleted outright (replaced by the shared carousel). The Help FAQ (~24 Q&A pairs) and the carousel's own hardcoded strings ("Free"/"Pro"/"Max", "Cancel anytime before day 7...", etc.) still stand but now also surface inside onboarding, since onboarding renders the same component — no new untranslated strings were added. Needs a recount, not a reuse of the old number. | Gate 3 |
| G3-13 | Native-speaker review of the machine-translated languages, or launch with fewer | Mo | Not started | `NOTES.md` #1: ~2,700 values across 10 languages, all machine-translated; known factual and typographic errors already found on manual inspection (e.g. `upgradeBlurb` wrongly promised "unlimited Opus"). | Gate 3 |

### Last

| ID | Description | Owner | Status | Evidence | Blocks |
|---|---|---|---|---|---|
| G3-14 | Solicitor review of Privacy Policy and Terms, after everything above | Professional | Not started | `NOTES.md` #7 confirms §14 (liability cap) and §7 (14-day refund) were written without legal review. | Gate 3 |
| G3-15 | Professional penetration test before taking payments at scale | Professional | Not started | | Gate 3 |
| G3-16 | *(found by scan)* No `robots.txt`, `sitemap.xml`, or web app manifest | Claude Code | Not started | Checked `app/` and `public/` — none exist. | Gate 3 |

---

## GATE 4 — Native app

| ID | Description | Owner | Status | Evidence | Blocks |
|---|---|---|---|---|---|
| G4-1 | Apple Developer organisation account (needs D-U-N-S, see G2-3), Google Play organisation account, and a Mac | Mo | Not started | | Gate 4 |
| G4-2 | In-App Purchase via RevenueCat or StoreKit, with restore purchases | Claude Code | Not started | No native wrapper project exists in this repo yet (no `/ios`, `/android`, Capacitor or Expo config). | Gate 4 |
| G4-3 | Check the current Apple and Google payment rules before designing checkout | Mo | Not started | | Gate 4 |
| G4-4 | Sign in with Apple | Claude Code | Not started | | Gate 4 |
| G4-5 | A working reviewer demo account | Mo | Not started | | Gate 4 |
| G4-6 | Native value beyond a wrapped site (notifications, widgets) | Claude Code | Not started | | Gate 4 |
| G4-7 | Report button for AI output | Claude Code | Not started | | Gate 4 |
| G4-8 | iPad layouts | Claude Code | Not started | | Gate 4 |
| G4-9 | Secure token storage in the wrapper | Claude Code | Not started | | Gate 4 |
| G4-10 | Store privacy disclosures | Mo | Not started | | Gate 4 |
| G4-11 | Native security pass | Claude Code / Professional | Not started | | Gate 4 |

---

## PARKED

| ID | Description | Owner | Status | Evidence | Blocks |
|---|---|---|---|---|---|
| P-1 | Lottie orb (blocked on asset) | Claude Code | Not started | Current orb is pure CSS/SVG (`8952644`), by design, until the Lottie asset exists. | — |
| P-2 | iOS keyboard resize lag | Claude Code | Not started | | — |
| P-3 | Splitting `page.tsx` | Claude Code | Not started | File is ~8,200+ lines; confirmed single-file architecture via `git ls-files`. | — |
| P-4 | Shared constant for price strings | Claude Code | Not started | Directly relevant to G3-12/G1-16-style drift — £4.99/£14.99 and the Vega limits (50/120) are still separate hardcoded literals in `InfoModal`'s `plans` array and `opusLimitForTier()`. | — |
| P-5 | Icon-font subsetting (only with a CI guard) | Claude Code | Not started | Depends on G1-15 (no CI pipeline exists yet to guard it). | — |
| P-6 | `TaskModal`, `RoutineModal` and `AddChoiceSheet` each duplicate the same backdrop/card/header/footer scaffolding | Claude Code | Not started | Deliberate at the time (`RoutineModal`'s own comment: "duplicates TaskModal's... scaffolding rather than factoring out a shared shell"), to keep each fix narrowly scoped. Worth factoring into a shared modal shell once no more of these are being added in quick succession. | — |

---

## Git log says done, not verified

Commits below read as completed work, but nothing in the repo or `NOTES.md`
records them being exercised against a live/deployed instance:

- **`725c7cc`** "reuse the subscription carousel inside onboarding" — see G1-3.
- **`93a01f7`** "scope localStorage tasks/routines per account, drop stale onboarding copy" — see G1-2.
- **`3c29f5a`** "consolidate sign-out, restyle the Plan icon, and add account deletion" — account deletion shipped; see G1-1 (never run end-to-end, Stripe-failure path never forced).
- **`ed90d2a`** "make client-generated ids per-account safe, matching the composite key" — fixes the cross-account routine-id collision described in `NOTES.md`; no live query has confirmed zero collisions on existing accounts since the fix.
- **`f9b7dd9`** "stop cloud writes failing silently" — fixes the specific silent-failure bug, but the underlying gap it was found through (no fleet-wide error visibility — `NOTES.md` #5 / G3-10) is still open.
- **`1dd6767`** / **`839aee0`** "rebuild the plan picker as a carousel... clamp to one neighbour, warn before Vega runs out" — see G1-6 (`CAROUSEL_H` clipping never checked).
- **`7c294ff`** "replace Privacy Policy and Terms with the full markdown documents" — text exists; see G3-14 (no solicitor has reviewed it).
- **`e0fcecf`** / **`0c45a83`** / **`c510481`** "add six languages... translate InfoModal... fix bidi bugs" — translations shipped; see G3-13 (none reviewed by a native speaker).

## Could not verify from the repo alone

- **G1-11** — indexes on `user_id` (needs a live `pg_indexes` query)
- **G1-27** — Supabase Auth dashboard settings (email confirmation, password rules, redirect allowlist)
- **G1-19** (partially) — whether any *unused* `NEXT_PUBLIC_` vars exist in the live Vercel project beyond what the code references
- **G0-3 / G0-4 / G0-5 / G0-6** — all external facts (account state, a named individual's contract, company-formation specifics)
- **G2-1, G2-2, G2-3** — company-formation specifics, banking, and a government ID application; moved from Gate 0, still external facts
- **G2-4, G2-5, G2-6, G2-10, G2-11, G2-12, G2-13, G2-14** — ownership/legal/accounting facts that live with Mo, an accountant, or third-party providers, not in this codebase
- **G3-2** — licence terms of the CDN-hosted background image (provenance, not just presence, is the open question)
- **G3-3** — trademark register search results
- **G4-1, G4-3, G4-5, G4-10** — Apple/Google platform policy and account state
