import { describe, expect, it } from "vitest";
import { renderActivityCardSvg } from "../src/renderers/activityCard.js";
import { renderForTheBadgeSvg } from "../src/renderers/badges.js";
import { renderLanguagesCardSvg } from "../src/renderers/languagesCard.js";
import { renderStatsCardSvg } from "../src/renderers/statsCard.js";
import { renderStreakCardSvg } from "../src/renderers/streakCard.js";
import type { FullProfileMetrics } from "../src/types.js";

const SAMPLE_METRICS: FullProfileMetrics = {
  name: "PENTESTER",
  login: "willygailo",
  pronouns: "he/him",
  publicRepos: 87,
  starredRepos: 99,
  repoStarsReceived: 70,
  totalCommits: 120,
  followers: 14,
  streak: {
    totalContributions: 173,
    firstContributionDate: "2024-11-05",
    currentStreak: 2,
    currentStreakStart: "2026-11-21",
    currentStreakEnd: "2026-11-22",
    longestStreak: 7,
    longestStreakStart: "2026-06-15",
    longestStreakEnd: "2026-06-21",
  },
  languages: [
    { name: "Python", color: "#3572A5", count: 50, percentage: 62.5 },
    { name: "JavaScript", color: "#f1e05a", count: 14, percentage: 17.5 },
    { name: "Kotlin", color: "#A97BFF", count: 6, percentage: 7.5 },
    { name: "HTML", color: "#e34c26", count: 5, percentage: 6.3 },
    { name: "TypeScript", color: "#3178c6", count: 5, percentage: 6.3 },
  ],
  recentDays: [
    { date: "2026-11-20", count: 1 },
    { date: "2026-11-21", count: 1 },
    { date: "2026-11-22", count: 21 },
  ],
  source: "graphql",
};

describe("SVG renderers", () => {
  it("renders for-the-badge SVG with escaped text", () => {
    const svg = renderForTheBadgeSvg({
      label: "Repo Stars",
      value: "70",
      color: "0e75b6",
    });
    expect(svg).toContain("<svg ");
    expect(svg).toContain("REPO STARS");
    expect(svg).toContain(">70<");
  });

  it("renders Dracula stats card with all metrics and escapes XML entities", () => {
    const svg = renderStatsCardSvg({
      ...SAMPLE_METRICS,
      name: 'PEN<TEST>&"ER',
    });
    expect(svg).toContain("PEN&lt;TEST&gt;&amp;&quot;ER");
    expect(svg).toContain("87");
    expect(svg).toContain("70");
    expect(svg).toContain("120");
    expect(svg).toContain("14");
  });

  it("renders Dracula streak card with expected ranges", () => {
    const svg = renderStreakCardSvg(SAMPLE_METRICS.streak, 2026);
    expect(svg).toContain("173");
    expect(svg).toContain("Nov 5, 2024 - Present");
    expect(svg).toContain("Nov 21 - Nov 22");
    expect(svg).toContain("Jun 15 - Jun 21");
  });

  it("renders languages donut card cleanly for multi, single, and empty datasets", () => {
    const multi = renderLanguagesCardSvg(SAMPLE_METRICS.languages);
    expect(multi).toContain("Top Languages by Repo");
    expect(multi).toContain("Python");
    expect(multi).toContain("<path ");

    const single = renderLanguagesCardSvg([
      { name: "Python", color: "#3572A5", count: 10, percentage: 100 },
    ]);
    expect(single).toContain("Python");
    expect(single).toContain("<path ");

    const empty = renderLanguagesCardSvg([]);
    expect(empty).toContain("No language data yet");
  });

  it("renders contribution activity graph card", () => {
    const svg = renderActivityCardSvg(SAMPLE_METRICS.name, SAMPLE_METRICS.recentDays);
    expect(svg).toContain("PENTESTER&#39;s Contribution Graph");
    expect(svg).toContain("<circle ");
  });
});
