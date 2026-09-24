# The Docket — known gaps and pre-launch notes

Working notes on things that are broken, missing, or deliberately deferred.
Kept in the repo so they're reviewable and survive independently of any one
session. Last updated **24 September 2026**.

---

## Outstanding before launch

Ordered by how much it would hurt to miss.

### 1. Native-speaker review of every translation

~2,700 values across 10 non-English languages (Arabic, Bengali, French, Hindi,
Mandarin, Portuguese, Russian, Spanish, Turkish, Urdu), **all
machine-translated**. Only English is authored.

This is not a polish item. The translation work surfaced real *factual* errors
propagated into 11 languages at once — `upgradeBlurb` promised "unlimited Opus
access" when Vega is the capped model — and two typographic bugs a native
speaker spots instantly:

- Arabic's `و` is a proclitic and takes no space before the following word
- Chinese uses no word spacing, so `和` must not be padded

Both shipped and were only caught on manual inspection. Assume more of the same
kind remain.

### 2. ~88 user-facing strings still English-only

- Help & Feedback FAQ — 24 Q&A pairs, the longest prose outside the legal docs
- Subscription carousel copy — ~8 strings added during the carousel rebuild
- `OnboardingScreen` — ~12 strings

The legal documents (Privacy Policy, Terms) stay English **by design** — each
carries a translated notice saying the English version governs. Do not
machine-translate a document that states a liability cap.

Guard: `npm run check:i18n` fails on any key defined in `T.en` that nothing
calls, on key drift between language blocks, and on a stale allowlist entry.
It does *not* catch hardcoded English that was never keyed.

### 3. Routines have no create/edit/delete UI

See [Routines: AI-only](#routines-ai-only) below.

### 4. Seeded demo data in the production database

See [Seeded demo data](#seeded-demo-data-in-production) below.

### 5. Error telemetry

Cloud-write failures now log to the console and raise a passive row in the
avatar card, but **detection still depends on a user noticing and reporting
it**. There is no fleet-wide visibility.

This is exactly how the routine id collision (below) went unnoticed for two
months: all six writes to `tasks`/`routines` discarded the error Supabase
returned, so data silently not arriving looked identical to data arriving.
Fixed at the call sites; the absence of telemetry is not.

### 6. Surfaces never seen rendered

Everything behind the auth gate has shipped unobserved, because the assistant
doing the work cannot create an account or sign in:

- Avatar card and Account/Plan section in Arabic
- Denied-geolocation path for prayer times
- Subscription carousel — in particular whether `CAROUSEL_H = 330` clips the
  Pro card, and whether side cards read correctly on a narrow phone
- Vega low-credit notice in its final wording

The `?debugVegaUsage` override pattern worked well for closing one of these
(narrow, explicitly triggered, no writes, removed after use). A similarly
scoped hook for a signed-in view would let the rest be verified directly
rather than shipped on reasoning alone.

### 7. Legal

- `support@`, `privacy@` and `legal@thedocket.app` must exist and be monitored
  before the policies go live — all three are cited in the documents
- Terms §14 (liability cap) and §7 (14-day refund promise) were written
  without legal review

---

## Routines: AI-only

**Routines have no UI for create, edit or delete.** Every mutation goes through
`handleAiActions` in `app/page.tsx` (`add_routine`, `update_routine`,
`remove_routine`), triggered only by the AI chat. There are no `addRoutine`,
`updateRoutine` or `deleteRoutine` helpers at all — the AI branches call
`setRoutines` inline.

What a user can reach today:

- The checkbox in Daily Routine, which writes one date into the `completions`
  JSON column and leaves the recurring routine intact
- Nothing else. `TimelineRow` has no `onClick`, so tapping a routine row does
  nothing

**This is not a partially-built feature.** `TaskModal` creates and edits *tasks
only* — its "Nature: Ongoing" and "Repeats: Daily" fields set the `type` and
`recurring` columns on a **tasks** row. A recurring task is still a task.
`TaskModal` has no `days[]`, `duration` or `intensity` fields. Routines were
designed AI-first and the management UI was never built.

### Agreed plan (deferred 23 Sep 2026)

Scheduled as dedicated follow-up rather than done inline, because the most
valuable part — extracting `ModalShell`, `FieldLabel` and `OptionPills` out of
the working `TaskModal` — is too risky to do alongside a new modal, a new
day-picker, new mutations and ~250 lines of translation in one pass.

- **Separate `RoutineModal`**, built on a shared extracted shell. Not a mode
  toggle inside `TaskModal`: the field sets overlap only on label and category,
  and a toggle that swaps five of seven fields loses the user's input.
- **Entry via a two-choice "Task / Routine" sheet** from the Daily Routine view
  and the bottom bar's `+`. Leave All Tasks' `+ New Task` alone — that view
  shows only tasks. The sheet's copy is where the task-vs-routine distinction
  actually gets explained.
- **Delete lives inside the modal**, not a swipe or long-press.
- **`TimelineRow` becomes tappable**, mirroring `TaskCard`'s existing `onEdit`.
  The checkbox needs `stopPropagation` or ticking off would also open the
  editor.

Estimate: ~600 new lines, ~60 removed, one file (`app/page.tsx`), including
~22 new translation keys × 11 languages.

### Interim

AI deletion — e.g. *"delete the Trading 212 check-in routine"* — is the only
route for removing a routine. Being verified. If it fails, a minimal delete
affordance becomes urgent independently of the full editor.

---

## Seeded demo data in production

The initial commit (`724ae1c`) shipped hardcoded demo content in
`defaultTasks()` / `defaultRoutines()`:

- **Tasks, ids 1–11** — *Trading 212 portfolio*, *Land Law*, *Cheshire Oak
  interview*, *fee waiver*, *water utility*, and others
- **Routines, ids 1–10+** — *Fajr*, *Gym session*, *Breakfast*, *Trading 212
  check-in*, *Develop Claude / AI tools account*, *Dhuhr*, *Lunch*, and others

`ed7f471` (26 July 2026) emptied both to `[]`, so no new account is seeded —
but nothing removed what had already been written.

**How it reached the database:** empty `localStorage` on first load populated
state from the defaults; the persistence effects wrote them to `localStorage`;
`loadCloudData`'s "first time this account has synced — push whatever's on this
device up" branch upserted them under the real `user_id`. The app promoted its
own placeholder content into a real account.

**Identifying them: single-digit ids are seeded, 13-digit ids are
user-created.** More reliable than titles — several seeded rows (*Fajr*, *Gym
session*, *Revise Land Law*) look plausibly real and may since have been
adopted as genuine.

**SQL alone will not remove them.** `localStorage` still holds them, so the
sync effect pushes them straight back on the next load. Either remove them
through the app (for routines, that means the AI chat), or delete the rows
*and* clear `docket-tasks-v2` / `docket-routines-v1` in that browser.

---

## Fixed, but worth knowing

Context for anyone reading the surrounding code.

### Routine ids were colliding across accounts

Routine ids were `Math.max(existing) + 1`, so every account's first routine got
id 1. With a primary key of `id` alone and RLS in force, the first account to
sync claimed those ids **globally**: every later account's upsert hit the
unique constraint, converted to an `ON CONFLICT DO UPDATE` against a row it was
not permitted to see, and failed — silently, because no call site checked the
error. The routines table was effectively single-tenant.

Fixed by migrating both tables to `PRIMARY KEY (user_id, id)` and unifying all
client-side id generation on one `nextId(existing)` helper, called *inside* the
functional updater.

**If any account's routines are missing, they are probably not lost** — they
are still in that user's `localStorage`, and will sync on the next visit now
that the schema accepts them. Only someone who cleared site data or changed
device in the interim actually lost anything.

### Tasks had the same bug, narrower

`addTask` used `Date.now()` and never consulted the array it appended to, so an
AI reply creating several tasks gave them all the same millisecond and the
upsert collapsed them into one row. `addStep` had it too — three steps added in
one turn shared an id, and removing one removed all three.

### Vega fallback is intentional

When a subscriber exhausts their Vega (Opus) credits, the request falls back to
Nova (Sonnet) and the reply carries `opusFallback: true`, rendered as an inline
note. **This is deliberate, not unfinished.** A hard stop was considered and
rejected: exhausting a premium allowance should degrade the model a paying
subscriber gets, not take chat away from them. See the comment on the
`overLimit` branch in `app/api/ask/route.ts`.

### Display names

The chat models are shown as **Nova** (Sonnet) and **Vega** (Opus) throughout
the UI. Internal identifiers — `sonnet_count`, `opus_count`,
`selectedModel: "sonnet" | "opus"` — deliberately keep the original names.
