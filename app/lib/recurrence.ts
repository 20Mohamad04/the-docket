// Pure, framework-free recurrence logic for tasks — no React, no app state,
// so this can be imported from both app/page.tsx and a plain Node test
// script (scripts/check-recurrence.mjs) with nothing else dragged in.
//
// Once an anchor "YYYY-MM-DD" string exists, all arithmetic on it is done in
// UTC (parsed as UTC midnight, never local-time Date math) — that part never
// drifts across DST boundaries or between users in different timezones
// comparing the same stored string. The one exception is deriving that
// anchor from a task's createdAt timestamp in the first place (see
// localDateOf below) — that conversion is deliberately LOCAL, because it has
// to match the calendar date the user's own clock was showing at the moment
// the task was created, not whatever UTC happened to read.

export interface RecurrenceTask {
  date: string;
  recurring: string;
  deleted: boolean;
  createdAt?: string;
}

function toUTCDate(dateISO: string): Date {
  return new Date(dateISO + "T00:00:00Z");
}

// Converts a createdAt timestamp (always UTC, e.g. new Date().toISOString())
// to the LOCAL calendar date it fell on, using local getters — not
// toISOString().slice(0,10), which reads the UTC date instead and can land a
// full day before the user's own day (e.g. 00:30 BST on the 12th is still
// 23:30 UTC on the 11th). In the browser "local" is the user's own system
// timezone; in a Node process it's whatever TZ that process is running
// under (see scripts/check-recurrence.mjs for a test that sets TZ
// explicitly).
function localDateOf(isoTimestamp: string): string {
  const d = new Date(isoTimestamp);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysBetween(aISO: string, bISO: string): number {
  const msPerDay = 86400000;
  return Math.round((toUTCDate(bISO).getTime() - toUTCDate(aISO).getTime()) / msPerDay);
}

function weekdayOf(dateISO: string): number {
  return toUTCDate(dateISO).getUTCDay(); // 0 = Sunday ... 6 = Saturday
}

function dayOfMonthOf(dateISO: string): number {
  return toUTCDate(dateISO).getUTCDate();
}

function lastDayOfMonth(year: number, month1to12: number): number {
  // Date.UTC's month is 0-indexed, so passing the 1-indexed target month
  // with day 0 lands on the last day of the PREVIOUS (0-indexed) month,
  // which is exactly the target month in 1-indexed terms.
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}

export function taskOccursOn(task: RecurrenceTask, dateISO: string): boolean {
  if (task.deleted) return false;

  const recurring = task.recurring || "";
  if (!recurring) {
    // No recurrence: current behaviour, unchanged. An Ongoing task with no
    // recurrence has no date at all, so this never matches anything — it
    // stays chip-only, exactly as today.
    return task.date === dateISO;
  }

  const anchor = task.date || (task.createdAt ? localDateOf(task.createdAt) : "");
  if (!anchor) {
    // Recurrence set, but nothing to anchor it to — fall back to the
    // same one-off behaviour rather than matching every day or none
    // unpredictably.
    return task.date === dateISO;
  }
  if (dateISO < anchor) return false; // never before the anchor day

  const diff = daysBetween(anchor, dateISO);

  switch (recurring) {
    case "daily":
      return true;
    case "every_2_days":
      return diff % 2 === 0;
    case "every_3_days":
      return diff % 3 === 0;
    case "weekdays": {
      const wd = weekdayOf(dateISO);
      return wd >= 1 && wd <= 5;
    }
    case "weekends": {
      const wd = weekdayOf(dateISO);
      return wd === 0 || wd === 6;
    }
    case "weekly":
      return weekdayOf(dateISO) === weekdayOf(anchor);
    case "biweekly":
      return weekdayOf(dateISO) === weekdayOf(anchor) && diff % 14 === 0;
    case "monthly": {
      const anchorDay = dayOfMonthOf(anchor);
      const [y, m] = dateISO.split("-").map(Number);
      const d = dayOfMonthOf(dateISO);
      const last = lastDayOfMonth(y, m);
      return d === Math.min(anchorDay, last);
    }
    default:
      // Unrecognised recurrence value — degrade to one-off rather than
      // silently matching every day.
      return task.date === dateISO;
  }
}
