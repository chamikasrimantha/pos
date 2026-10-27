// src/lib/date-utils.ts
// Pure Asia/Colombo time zone calculations for consistent day, month, and report boundaries

export const COLOMBO_TIMEZONE = "Asia/Colombo";

/**
 * Returns date parts in Asia/Colombo time zone for a given timestamp.
 */
export function getColomboDateParts(timestamp: number = Date.now()): {
  year: number;
  month: number; // 1-indexed (1 = Jan, 12 = Dec)
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const d = new Date(timestamp);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: COLOMBO_TIMEZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });

  const parts = formatter.formatToParts(d);
  let year = d.getFullYear();
  let month = d.getMonth() + 1;
  let day = d.getDate();
  let hour = d.getHours();
  let minute = d.getMinutes();
  let second = d.getSeconds();

  for (const part of parts) {
    if (part.type === "year") year = parseInt(part.value, 10);
    if (part.type === "month") month = parseInt(part.value, 10);
    if (part.type === "day") day = parseInt(part.value, 10);
    if (part.type === "hour") hour = parseInt(part.value, 10);
    if (part.type === "minute") minute = parseInt(part.value, 10);
    if (part.type === "second") second = parseInt(part.value, 10);
  }

  // Edge case: hour12: false can return 24 for midnight in some Node versions
  if (hour === 24) hour = 0;

  return { year, month, day, hour, minute, second };
}

/**
 * Converts a year, month (1-12), day into start and end of that day (UTC ms timestamps) in Asia/Colombo.
 * Asia/Colombo is strictly UTC+05:30 with no daylight saving time (DST).
 */
export const COLOMBO_OFFSET_MS = (5 * 60 + 30) * 60 * 1000; // +05:30

export function getColomboDayRange(timestamp: number = Date.now()): {
  startOfDay: number;
  endOfDay: number;
  dateKey: string; // YYYY-MM-DD
} {
  const { year, month, day } = getColomboDateParts(timestamp);
  const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  // Start of day in UTC for Asia/Colombo:
  // e.g. 2026-10-27 00:00:00 Colombo = 2026-10-26 18:30:00 UTC
  const utcMidnight = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  const startOfDay = utcMidnight - COLOMBO_OFFSET_MS;
  const endOfDay = startOfDay + 24 * 60 * 60 * 1000 - 1;

  return { startOfDay, endOfDay, dateKey };
}

/**
 * Returns the start and end timestamps (UTC ms) for a given month in Asia/Colombo.
 * @param year e.g. 2026
 * @param month 1-12
 */
export function getColomboMonthRange(year: number, month: number): {
  startOfMonth: number;
  endOfMonth: number;
  daysInMonth: number;
  monthKey: string; // YYYY-MM
} {
  const daysInMonth = new Date(year, month, 0).getDate();
  const utcStart = Date.UTC(year, month - 1, 1, 0, 0, 0, 0);
  const startOfMonth = utcStart - COLOMBO_OFFSET_MS;
  const utcEnd = Date.UTC(year, month - 1, daysInMonth, 23, 59, 59, 999);
  const endOfMonth = utcEnd - COLOMBO_OFFSET_MS;
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;

  return { startOfMonth, endOfMonth, daysInMonth, monthKey };
}

/**
 * Formats a timestamp into YYYY-MM-DD string in Asia/Colombo.
 */
export function formatColomboDateKey(timestamp: number): string {
  const { year, month, day } = getColomboDateParts(timestamp);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Formats a timestamp to human readable date string in Asia/Colombo.
 */
export function formatColomboDateTime(timestamp: number): string {
  if (!timestamp) return "-";
  return new Intl.DateTimeFormat("en-LK", {
    timeZone: COLOMBO_TIMEZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

export function formatColomboTime(timestamp: number): string {
  if (!timestamp) return "-";
  return new Intl.DateTimeFormat("en-LK", {
    timeZone: COLOMBO_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(timestamp));
}
