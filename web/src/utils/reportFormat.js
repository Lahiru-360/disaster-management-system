// How UC04 reports show dates and numbers. Dates are counted as the contract
// counts them (docs/api-contract.md §14.1): whole days in Sri Lanka time
// (UTC+05:30 all year), written "YYYY-MM-DD", worked out by shifting the
// instant, so the officer's own time zone never moves a day.

const OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const sriLanka = (instant) => new Date(new Date(instant).getTime() + OFFSET_MS).toISOString();

/** The Sri Lanka day an instant falls on, e.g. "2026-06-08"; null for none. */
export function sriLankaDay(instant) {
  return instant ? sriLanka(instant).slice(0, 10) : null;
}

const parts = (day) => {
  const [year, month, date] = day.split('-').map(Number);
  return { year, month: MONTHS[month - 1], date };
};

/**
 * A day or a run of days, e.g. "8–20 Jun 2026", "12 Jun 2026", or without
 * the year "14–15 Jun".
 * @param {string} from "YYYY-MM-DD"
 * @param {string} [to] "YYYY-MM-DD", the same day when left out
 * @param {{ year?: boolean }} [options]
 */
export function formatDayRange(from, to = from, { year = true } = {}) {
  const a = parts(from);
  const b = parts(to);
  const tail = (y) => (year ? ` ${y}` : '');
  if (from === to) return `${a.date} ${a.month}${tail(a.year)}`;
  if (a.year === b.year && a.month === b.month)
    return `${a.date}–${b.date} ${b.month}${tail(b.year)}`;
  if (a.year === b.year) return `${a.date} ${a.month} – ${b.date} ${b.month}${tail(b.year)}`;
  return `${a.date} ${a.month} ${a.year} – ${b.date} ${b.month} ${b.year}`;
}

/** An instant in Sri Lanka time, e.g. "7 Oct 2026, 14:30". */
export function formatMoment(instant) {
  const local = sriLanka(instant);
  return `${formatDayRange(local.slice(0, 10))}, ${local.slice(11, 16)}`;
}

/** A hazard event's period as Sri Lanka days: { from, to } (to null while active). */
export function eventDays(event) {
  return { from: sriLankaDay(event.startDate), to: sriLankaDay(event.endDate) };
}

const NUMBER = new Intl.NumberFormat('en-US');

/** A count with thousands separators, e.g. "128,400"; "–" for none. */
export function formatCount(value) {
  return value === null || value === undefined ? '–' : NUMBER.format(value);
}

/** A share as a percentage, e.g. 0.93997 -> "94%"; "–" for none. */
export function formatPercent(rate, digits = 0) {
  return rate === null || rate === undefined ? '–' : `${(rate * 100).toFixed(digits)}%`;
}

/** When a Sri Lanka day starts, in milliseconds: its midnight, 18:30 UTC the day before. */
export function sriLankaDayStart(day) {
  return Date.parse(`${day}T00:00:00.000Z`) - OFFSET_MS;
}

export const DAY_MS = 24 * 60 * 60 * 1000;
