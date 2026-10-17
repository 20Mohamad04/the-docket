// Plain-Node tests for app/lib/recurrence.ts — no new dependencies, no build
// step. Node's built-in TypeScript type stripping lets this .mjs file import
// the .ts module directly.
//
// `node scripts/check-recurrence.mjs`. Exits non-zero on any failure.

import { taskOccursOn } from "../app/lib/recurrence.ts";

let pass = 0, fail = 0;
function check(label, actual, expected) {
  if (actual === expected) {
    pass++;
  } else {
    fail++;
    console.error(`FAIL: ${label} — expected ${expected}, got ${actual}`);
  }
}

// ── every_2_days across 6 days ──────────────────────────────────────────
{
  const task = { date: "2026-01-01", recurring: "every_2_days", deleted: false };
  check("every_2_days day 0 (2026-01-01)", taskOccursOn(task, "2026-01-01"), true);
  check("every_2_days day 1 (2026-01-02)", taskOccursOn(task, "2026-01-02"), false);
  check("every_2_days day 2 (2026-01-03)", taskOccursOn(task, "2026-01-03"), true);
  check("every_2_days day 3 (2026-01-04)", taskOccursOn(task, "2026-01-04"), false);
  check("every_2_days day 4 (2026-01-05)", taskOccursOn(task, "2026-01-05"), true);
  check("every_2_days day 5 (2026-01-06)", taskOccursOn(task, "2026-01-06"), false);
}

// ── every_3_days spot check (same family, different modulus) ────────────
{
  const task = { date: "2026-01-01", recurring: "every_3_days", deleted: false };
  check("every_3_days day 0", taskOccursOn(task, "2026-01-01"), true);
  check("every_3_days day 1", taskOccursOn(task, "2026-01-02"), false);
  check("every_3_days day 2", taskOccursOn(task, "2026-01-03"), false);
  check("every_3_days day 3", taskOccursOn(task, "2026-01-04"), true);
}

// ── weekdays across a week (2024-01-01 is a known Monday) ───────────────
{
  const task = { date: "2024-01-01", recurring: "weekdays", deleted: false };
  check("weekdays Mon 2024-01-01", taskOccursOn(task, "2024-01-01"), true);
  check("weekdays Tue 2024-01-02", taskOccursOn(task, "2024-01-02"), true);
  check("weekdays Wed 2024-01-03", taskOccursOn(task, "2024-01-03"), true);
  check("weekdays Thu 2024-01-04", taskOccursOn(task, "2024-01-04"), true);
  check("weekdays Fri 2024-01-05", taskOccursOn(task, "2024-01-05"), true);
  check("weekdays Sat 2024-01-06", taskOccursOn(task, "2024-01-06"), false);
  check("weekdays Sun 2024-01-07", taskOccursOn(task, "2024-01-07"), false);
}

// ── weekends spot check ──────────────────────────────────────────────────
{
  const task = { date: "2024-01-01", recurring: "weekends", deleted: false };
  check("weekends Mon", taskOccursOn(task, "2024-01-01"), false);
  check("weekends Sat", taskOccursOn(task, "2024-01-06"), true);
  check("weekends Sun", taskOccursOn(task, "2024-01-07"), true);
}

// ── weekly ────────────────────────────────────────────────────────────────
{
  const task = { date: "2024-01-01", recurring: "weekly", deleted: false };
  check("weekly anchor day", taskOccursOn(task, "2024-01-01"), true);
  check("weekly +7 (same weekday)", taskOccursOn(task, "2024-01-08"), true);
  check("weekly +14", taskOccursOn(task, "2024-01-15"), true);
  check("weekly +1 (wrong weekday)", taskOccursOn(task, "2024-01-02"), false);
  check("weekly +8 (wrong weekday)", taskOccursOn(task, "2024-01-09"), false);
}

// ── biweekly ──────────────────────────────────────────────────────────────
{
  const task = { date: "2024-01-01", recurring: "biweekly", deleted: false };
  check("biweekly anchor day", taskOccursOn(task, "2024-01-01"), true);
  check("biweekly +7 (right weekday, wrong week)", taskOccursOn(task, "2024-01-08"), false);
  check("biweekly +14", taskOccursOn(task, "2024-01-15"), true);
  check("biweekly +21 (right weekday, wrong week)", taskOccursOn(task, "2024-01-22"), false);
  check("biweekly +28", taskOccursOn(task, "2024-01-29"), true);
}

// ── monthly on the 31st through February (2024 is a leap year) ──────────
{
  const task = { date: "2024-01-31", recurring: "monthly", deleted: false };
  check("monthly Jan 31 (anchor)", taskOccursOn(task, "2024-01-31"), true);
  check("monthly Feb 28 (not the clamp day in a leap year)", taskOccursOn(task, "2024-02-28"), false);
  check("monthly Feb 29 (leap-year clamp)", taskOccursOn(task, "2024-02-29"), true);
  check("monthly Mar 31 (back to 31)", taskOccursOn(task, "2024-03-31"), true);
  check("monthly Apr 30 (clamp, no 31st)", taskOccursOn(task, "2024-04-30"), true);
}
{
  // Non-leap year: Feb only has 28 days, so the clamp day is the 28th.
  const task = { date: "2025-01-31", recurring: "monthly", deleted: false };
  check("monthly non-leap Feb 28 clamp", taskOccursOn(task, "2025-02-28"), true);
  check("monthly non-leap Feb 27 (not clamp day)", taskOccursOn(task, "2025-02-27"), false);
}

// ── a date before the anchor ──────────────────────────────────────────────
{
  const dailyTask = { date: "2024-01-10", recurring: "daily", deleted: false };
  check("before anchor (daily)", taskOccursOn(dailyTask, "2024-01-05"), false);
  const weeklyTask = { date: "2024-01-10", recurring: "weekly", deleted: false };
  check("before anchor (weekly)", taskOccursOn(weeklyTask, "2024-01-01"), false);
}

// ── one-off behaviour (no recurrence) ────────────────────────────────────
{
  const task = { date: "2024-03-15", recurring: "", deleted: false };
  check("one-off matches its own date", taskOccursOn(task, "2024-03-15"), true);
  check("one-off doesn't match a later date", taskOccursOn(task, "2024-03-16"), false);
  check("one-off doesn't match an earlier date", taskOccursOn(task, "2024-03-14"), false);
}

// ── anchor falls back to createdAt when date is empty ────────────────────
{
  const task = { date: "", recurring: "daily", deleted: false, createdAt: "2024-02-01T10:23:00.000Z" };
  check("createdAt anchor, on day", taskOccursOn(task, "2024-02-01"), true);
  check("createdAt anchor, after", taskOccursOn(task, "2024-02-05"), true);
  check("createdAt anchor, before", taskOccursOn(task, "2024-01-31"), false);
}

// ── no anchor at all (recurrence set, but no date and no createdAt) ──────
{
  const task = { date: "", recurring: "weekly", deleted: false };
  check("no anchor at all, never occurs", taskOccursOn(task, "2024-01-01"), false);
}

// ── deleted tasks never occur, regardless of recurrence ──────────────────
{
  const task = { date: "2024-01-01", recurring: "daily", deleted: true };
  check("deleted task never occurs", taskOccursOn(task, "2024-01-01"), false);
}

// ── createdAt anchor uses the LOCAL date, not a UTC date-slice ───────────
// Placed last and sets TZ itself, so no earlier test (all of which only
// exercise the UTC-parsed arithmetic, unaffected by TZ) is put at risk by
// this process-wide mutation. Node resolves the timezone per Date call,
// not once at process start, so this takes effect for every Date
// constructed from this line on.
//
// 2026-10-11T23:30:00.000Z is 00:30 BST on 2026-10-12 local time (BST is
// still in effect — it doesn't end until the last Sunday of October) — i.e.
// the user's own clock had already turned over to the 12th. The anchor must
// be the 12th; slicing the UTC string instead would wrongly anchor on the
// 11th, a full day earlier than the user's own day.
process.env.TZ = "Europe/London";
{
  const task = { date: "", recurring: "every_2_days", deleted: false, createdAt: "2026-10-11T23:30:00.000Z" };
  check("TZ anchor: Oct 12 is the anchor day itself (diff 0)", taskOccursOn(task, "2026-10-12"), true);
  check("TZ anchor: Oct 13 is one day after the anchor (diff 1, odd)", taskOccursOn(task, "2026-10-13"), false);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exitCode = 1;
