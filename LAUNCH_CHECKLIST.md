# The Docket — Launch Checklist

Built from `NOTES.md`, `git log --oneline -80`, and a grep of the codebase for
`TODO`/`FIXME`/`HACK` (none found outside `.next/` build output), as of
**7 October 2026**.

> **Rule:** an item is **Done** only with evidence attached in the Evidence
> column — command output, a deployed-build screenshot, or a query result.
> **"Typecheck passes" is not evidence.** It proves the types are consistent,
> not that the feature works. Evidence is blank until that proof exists.

Status values: **Not started** · **In progress** · **Built-unverified** (code
exists but has never been exercised/observed) · **Done** (evidence attached).

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

### Infrastructure

| ID | Description | Owner | Status | Evidence | Blocks |
|---|---|---|---|---|---|
| G1-7 | Custom SMTP, including domain ownership and SPF/DKIM/DMARC — currently blocking testing | Mo | Not started | | Gate 1 |
| G1-8 | Create the `support@`, `privacy@` and `legal@` mailboxes (the Help modal promises a 24h reply) | Mo | Not started | | Gate 1 |
| G1-9 | Google and Apple OAuth credentials | Mo | Built-unverified | UI side is built: `handleOAuth()` and both buttons exist (`app/page.tsx:2595-2726`), calling `supabase.auth.signInWithOAuth`. Whether real provider credentials are registered in the Supabase Auth dashboard can't be seen from the repo. | Gate 1 |
| G1-10 | Put the database schema in the repo as migration files | Claude Code | Not started | `git ls-files` shows no `migrations/` directory and no `.sql` file anywhere in the repo. | Gate 1 |
| G1-11 | Check indexes on `user_id` for every table | Claude Code / Mo | Cannot verify from repo | No schema file exists in-repo to check against; needs a live `pg_indexes` query (see G1-10). | Gate 1 |
| G1-12 | Replace the full-table rewrite on every change with debounced writes of changed rows | Claude Code | Not started | | Gate 1 |
| G1-13 | Schedule database exports | Mo | Not started | Overlaps with G0-4 (paid plan unlocks built-in backups). | Gate 1 |
| G1-14 | Load-test with about 10,000 users' worth of fake rows | Mo / Claude Code | Not started | | Gate 1 |
| G1-15 | *(found by scan)* No automated test suite or CI pipeline exists | Claude Code | Not started | No test framework in `package.json` (no Jest/Vitest/Playwright); no `.github/workflows`. `lint` / `check:i18n` / `tsc --noEmit` are run manually, not gated anywhere. | Gate 1 |
| G1-16 | *(found by scan)* Stripe checkout/portal fall back to a hardcoded personal preview URL if `NEXT_PUBLIC_SITE_URL` is unset | Claude Code | Not started | `app/api/stripe/checkout/route.ts:56` and `app/api/stripe/portal/route.ts:84` both fall back to `https://planner-docket-git-main-mohamad0420.vercel.app`. If the env var is ever missing in prod, Stripe return/redirect sends real customers to a dev preview URL. | Gate 1 |

### Security audit (read-only, then fixes one at a time)

| ID | Description | Owner | Status | Evidence | Blocks |
|---|---|---|---|---|---|
| G1-17 | Run the `pg_policies` and `pg_tables` queries; check RLS on `conversations`, `chat_messages`, `user_memories`, `usage`, `subscriptions`; check chat-image storage bucket visibility | Mo / Claude Code | Cannot verify from repo | Lives entirely in the live Supabase project; no SQL/policy files in the repo. | Gate 1 |
| G1-18 | Secrets scan of full git history (gitleaks/trufflehog); rotate anything found | Claude Code | Not started | Neither tool is in the repo/deps; history has not been scanned during this pass. | Gate 1 |
| G1-19 | Confirm only intended variables carry `NEXT_PUBLIC_` | Mo | Built-unverified | Grepped all source: only `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL` are referenced — all three are meant to be public. Can't rule out an unused public var sitting in the live Vercel project that the code never reads. | Gate 1 |
| G1-20 | Stripe webhook signature check on the raw body | Claude Code | Built-unverified | Confirmed in code: `app/api/stripe/webhook/route.ts:50-61` reads `req.text()` (raw body) and calls `stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET)`. Never exercised against a live/test webhook delivery. | Gate 1 |
| G1-21 | Review `/api/account/delete` | Claude Code | In progress | Read in full during this scan (`app/api/account/delete/route.ts`) — ordering (Stripe cancel → rows → auth user), confirm-email re-check server-side, and failure logging all look sound. Not independently signed off by anyone else. | Gate 1 |
| G1-22 | Check what stops prompt-injected content steering AI actions (`add_task` / `remove_routine` / `update_routine`) | Claude Code | Not started | Grepped `app/api/ask/_prompt.ts` for injection/untrusted-content handling language — none found. | Gate 1 |
| G1-23 | Rate-limit `/api/ask` | Claude Code | Not started | Grepped `app/api/ask/route.ts` for rate-limit logic — none found. | Gate 1 |
| G1-24 | Review the `?debug=1` Eruda loader | Claude Code | Not started | Still present and unconditional: any visitor who appends `?debug=1` gets a live JS console injected into production (`app/page.tsx` ~7395-7408). | Gate 1 |
| G1-25 | `npm audit` | Claude Code | Not started | Deliberately not run during this pass — out of scope for a documentation-only task. | Gate 1 |
| G1-26 | Security headers (CSP etc.) | Claude Code | Not started | `next.config.ts` has no headers config at all — confirmed by reading the file. | Gate 1 |
| G1-27 | Supabase auth settings: email confirmation, password rules, redirect allowlist | Mo | Cannot verify from repo | Lives in the Supabase Auth dashboard, not the codebase. | Gate 1 |

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
| G3-11 | Routine create/edit/delete UI (currently AI-only) | Claude Code | Not started | Confirmed: `TimelineRow` has no `onClick`; no `RoutineModal`, no `addRoutine`/`updateRoutine`/`deleteRoutine` helpers. Agreed plan recorded in `NOTES.md` ("Routines: AI-only" section, deferred 23 Sep 2026). | Gate 3 |
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
- **G1-17** — RLS/`pg_policies`, storage bucket visibility (live Supabase project)
- **G1-27** — Supabase Auth dashboard settings (email confirmation, password rules, redirect allowlist)
- **G1-19** (partially) — whether any *unused* `NEXT_PUBLIC_` vars exist in the live Vercel project beyond what the code references
- **G0-3 / G0-4 / G0-5 / G0-6** — all external facts (account state, a named individual's contract, company-formation specifics)
- **G2-1, G2-2, G2-3** — company-formation specifics, banking, and a government ID application; moved from Gate 0, still external facts
- **G2-4, G2-5, G2-6, G2-10, G2-11, G2-12, G2-13, G2-14** — ownership/legal/accounting facts that live with Mo, an accountant, or third-party providers, not in this codebase
- **G3-2** — licence terms of the CDN-hosted background image (provenance, not just presence, is the open question)
- **G3-3** — trademark register search results
- **G4-1, G4-3, G4-5, G4-10** — Apple/Google platform policy and account state
