import { describe, expect, it } from "vitest";
import {
  computeStreakStats,
  formatDateRange,
  getLastNDays,
  getTodayIsoInOffset,
} from "../src/streak.js";

describe("streak calculations", () => {
  it("computes total contributions, longest streak, and active streak ending today", () => {
    const days = [
      { date: "2024-11-05", count: 3 },
      { date: "2026-06-15", count: 1 },
      { date: "2026-06-16", count: 2 },
      { date: "2026-06-17", count: 4 },
      { date: "2026-06-18", count: 1 },
      { date: "2026-06-19", count: 1 },
      { date: "2026-06-20", count: 3 },
      { date: "2026-06-21", count: 2 },
      { date: "2026-11-21", count: 1 },
      { date: "2026-11-22", count: 21 },
      { date: "2026-11-23", count: 5 }, // future cell in week should be ignored
    ];

    const stats = computeStreakStats(days, "2026-11-22");
    expect(stats.totalContributions).toBe(39);
    expect(stats.firstContributionDate).toBe("2024-11-05");
    expect(stats.currentStreak).toBe(2);
    expect(stats.currentStreakStart).toBe("2026-11-21");
    expect(stats.currentStreakEnd).toBe("2026-11-22");
    expect(stats.longestStreak).toBe(7);
    expect(stats.longestStreakStart).toBe("2026-06-15");
    expect(stats.longestStreakEnd).toBe("2026-06-21");
  });

  it("keeps current streak alive when today has 0 contributions but yesterday had >= 1", () => {
    const days = [
      { date: "2026-11-20", count: 2 },
      { date: "2026-11-21", count: 4 },
      { date: "2026-11-22", count: 0 },
    ];
    const stats = computeStreakStats(days, "2026-11-22");
    expect(stats.currentStreak).toBe(2);
    expect(stats.currentStreakStart).toBe("2026-11-20");
    expect(stats.currentStreakEnd).toBe("2026-11-21");
  });

  it("returns 0 current streak when neither today nor yesterday has contributions", () => {
    const days = [
      { date: "2026-11-19", count: 3 },
      { date: "2026-11-20", count: 1 },
      { date: "2026-11-21", count: 0 },
      { date: "2026-11-22", count: 0 },
    ];
    const stats = computeStreakStats(days, "2026-11-22");
    expect(stats.currentStreak).toBe(0);
    expect(stats.currentStreakStart).toBeNull();
    expect(stats.currentStreakEnd).toBeNull();
  });

  it("formats current-year and cross-year date ranges cleanly", () => {
    expect(formatDateRange("2026-11-21", "2026-11-22", 2026)).toBe("Nov 21 - Nov 22");
    expect(formatDateRange("2025-12-30", "2026-01-02", 2026)).toBe("Dec 30, 2025 - Jan 2, 2026");
    expect(formatDateRange("2026-11-22", "2026-11-22", 2026)).toBe("Nov 22");
  });

  it("builds a zero-filled 31-day activity window in UTC+8", () => {
    const todayIso = getTodayIsoInOffset(480, new Date("2026-11-22T18:00:00Z"));
    expect(todayIso).toBe("2026-11-23"); // 18:00 UTC + 8h = next day 02:00

    const recent = getLastNDays([{ date: "2026-11-23", count: 7 }], todayIso, 31);
    expect(recent).toHaveLength(31);
    expect(recent[0].count).toBe(0);
    expect(recent[30]).toEqual({ date: "2026-11-23", count: 7 });
  });
});
