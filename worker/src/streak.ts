import type { ContributionDay, StreakMetrics } from "./types.js";

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export function getTodayIsoInOffset(offsetMinutes: number, now: Date = new Date()): string {
  const shiftedMs = now.getTime() + offsetMinutes * 60_000;
  return new Date(shiftedMs).toISOString().slice(0, 10);
}

export function addDaysIso(isoDate: string, deltaDays: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return dt.toISOString().slice(0, 10);
}

export function formatShortDate(isoDate: string, includeYear: boolean): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const month = MONTH_NAMES[m - 1] ?? "Jan";
  return includeYear ? `${month} ${d}, ${y}` : `${month} ${d}`;
}

export function formatDateRange(
  startIso: string | null,
  endIso: string | null,
  currentYear: number,
  emptyLabel = "No contributions"
): string {
  if (!startIso || !endIso) {
    return emptyLabel;
  }
  const startYear = Number(startIso.slice(0, 4));
  const endYear = Number(endIso.slice(0, 4));
  const showYears = startYear !== currentYear || endYear !== currentYear;
  if (startIso === endIso) {
    return formatShortDate(startIso, showYears);
  }
  return `${formatShortDate(startIso, showYears)} - ${formatShortDate(endIso, showYears)}`;
}

/**
 * Compute total contributions, current streak, and longest streak from a list of daily counts.
 * Dates after `todayIso` are excluded so future cells in the current week do not affect streaks.
 */
export function computeStreakStats(
  rawDays: readonly ContributionDay[],
  todayIso: string
): StreakMetrics {
  const dayMap = new Map<string, number>();
  for (const day of rawDays) {
    if (day.date <= todayIso) {
      dayMap.set(day.date, Math.max(dayMap.get(day.date) ?? 0, day.count));
    }
  }

  const sortedDates = Array.from(dayMap.keys()).sort();
  if (sortedDates.length === 0) {
    return {
      totalContributions: 0,
      firstContributionDate: null,
      currentStreak: 0,
      currentStreakStart: null,
      currentStreakEnd: null,
      longestStreak: 0,
      longestStreakStart: null,
      longestStreakEnd: null,
    };
  }

  let totalContributions = 0;
  let firstContributionDate: string | null = null;
  let longestStreak = 0;
  let longestStreakStart: string | null = null;
  let longestStreakEnd: string | null = null;

  let activeRun = 0;
  let activeRunStart: string | null = null;
  let prevDate: string | null = null;

  for (const date of sortedDates) {
    const count = dayMap.get(date) ?? 0;
    totalContributions += count;

    if (count > 0 && firstContributionDate === null) {
      firstContributionDate = date;
    }

    const isConsecutive = prevDate !== null && addDaysIso(prevDate, 1) === date;
    if (count > 0) {
      if (activeRun === 0 || !isConsecutive) {
        activeRun = 1;
        activeRunStart = date;
      } else {
        activeRun += 1;
      }
      if (activeRun >= longestStreak) {
        longestStreak = activeRun;
        longestStreakStart = activeRunStart;
        longestStreakEnd = date;
      }
    } else {
      activeRun = 0;
      activeRunStart = null;
    }
    prevDate = date;
  }

  // Current streak stays alive if yesterday had contributions and today hasn't yet.
  const todayCount = dayMap.get(todayIso) ?? 0;
  const yesterdayIso = addDaysIso(todayIso, -1);
  const yesterdayCount = dayMap.get(yesterdayIso) ?? 0;

  let currentEnd: string | null = null;
  if (todayCount > 0) {
    currentEnd = todayIso;
  } else if (yesterdayCount > 0) {
    currentEnd = yesterdayIso;
  }

  let currentStreak = 0;
  let currentStart: string | null = null;
  if (currentEnd !== null) {
    let cursor = currentEnd;
    while ((dayMap.get(cursor) ?? 0) > 0) {
      currentStreak += 1;
      currentStart = cursor;
      cursor = addDaysIso(cursor, -1);
    }
  }

  return {
    totalContributions,
    firstContributionDate,
    currentStreak,
    currentStreakStart: currentStart,
    currentStreakEnd: currentEnd,
    longestStreak,
    longestStreakStart,
    longestStreakEnd,
  };
}

export function getLastNDays(
  rawDays: readonly ContributionDay[],
  todayIso: string,
  numDays: number
): ContributionDay[] {
  const dayMap = new Map<string, number>();
  for (const day of rawDays) {
    if (day.date <= todayIso) {
      dayMap.set(day.date, Math.max(dayMap.get(day.date) ?? 0, day.count));
    }
  }

  const result: ContributionDay[] = [];
  for (let i = numDays - 1; i >= 0; i -= 1) {
    const date = addDaysIso(todayIso, -i);
    result.push({ date, count: dayMap.get(date) ?? 0 });
  }
  return result;
}
