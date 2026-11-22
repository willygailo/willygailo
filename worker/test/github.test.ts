import { describe, expect, it } from "vitest";
import {
  fetchBadgeMetric,
  fetchFullProfileMetrics,
  parsePublicContributionsHtml,
} from "../src/github.js";

describe("GitHub client and pagination", () => {
  it("paginates GraphQL repositories to compute accurate Repo Stars", async () => {
    let callCount = 0;
    const mockFetch: typeof fetch = async (_input, init) => {
      callCount += 1;
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        variables?: { after?: string };
      };
      if (!body.variables?.after) {
        return Response.json({
          data: {
            user: {
              repositories: {
                pageInfo: { hasNextPage: true, endCursor: "cursor-1" },
                nodes: [
                  { stargazerCount: 50, primaryLanguage: { name: "Python", color: "#3572A5" } },
                  { stargazerCount: 19, primaryLanguage: { name: "Kotlin", color: "#A97BFF" } },
                ],
              },
            },
          },
        });
      }
      return Response.json({
        data: {
          user: {
            repositories: {
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: [{ stargazerCount: 1, primaryLanguage: { name: "TypeScript", color: "#3178c6" } }],
            },
          },
        },
      });
    };

    const badge = await fetchBadgeMetric("willygailo", "repo-stars", "test-token", mockFetch);
    expect(callCount).toBe(2);
    expect(badge).toEqual({ label: "Repo Stars", value: "70", color: "0e75b6" });
  });

  it("aggregates multi-year GraphQL commit contributions and calendar days", async () => {
    let callIndex = 0;
    const mockFetch: typeof fetch = async () => {
      callIndex += 1;
      if (callIndex === 1) {
        return Response.json({
          data: {
            user: {
              name: "PENTESTER",
              login: "willygailo",
              pronouns: "he/him",
              followers: { totalCount: 13 },
              starredRepositories: { totalCount: 99 },
              repositories: {
                totalCount: 87,
                pageInfo: { hasNextPage: false, endCursor: null },
                nodes: [
                  { stargazerCount: 69, primaryLanguage: { name: "Python", color: "#3572A5" } },
                ],
              },
              contributionsCollection: {
                totalCommitContributions: 85,
                restrictedContributionsCount: 5,
                contributionYears: [2025, 2026],
                contributionCalendar: {
                  totalContributions: 100,
                  weeks: [
                    {
                      contributionDays: [
                        { date: "2026-11-21", contributionCount: 1 },
                        { date: "2026-11-22", contributionCount: 21 },
                      ],
                    },
                  ],
                },
              },
            },
          },
        });
      }
      return Response.json({
        data: {
          user: {
            y0: {
              totalCommitContributions: 40,
              restrictedContributionsCount: 0,
              contributionCalendar: {
                weeks: [
                  {
                    contributionDays: [{ date: "2025-06-15", contributionCount: 3 }],
                  },
                ],
              },
            },
            y1: {
              totalCommitContributions: 85,
              restrictedContributionsCount: 5,
              contributionCalendar: {
                weeks: [
                  {
                    contributionDays: [
                      { date: "2026-11-21", contributionCount: 1 },
                      { date: "2026-11-22", contributionCount: 21 },
                    ],
                  },
                ],
              },
            },
          },
        },
      });
    };

    const metrics = await fetchFullProfileMetrics(
      "willygailo",
      "test-token",
      "all_time",
      480,
      mockFetch,
      new Date("2026-11-22T12:00:00Z")
    );
    expect(metrics.publicRepos).toBe(87);
    expect(metrics.repoStarsReceived).toBe(69);
    expect(metrics.totalCommits).toBe(130);
    expect(metrics.streak.currentStreak).toBe(2);
    expect(metrics.streak.firstContributionDate).toBe("2025-06-15");
    expect(metrics.source).toBe("graphql");
  });

  it("parses GitHub public contributions HTML fragment accurately", () => {
    const html = `
      <table>
        <td id="day-1" data-date="2026-11-21" data-level="1"></td>
        <td data-date="2026-11-22" id="day-2" data-level="4"></td>
        <td id="day-3" data-date="2026-11-23" data-level="0"></td>
      </table>
      <tool-tip for="day-1">1 contribution on November 21.</tool-tip>
      <tool-tip for="day-2">21 contributions on November 22.</tool-tip>
      <tool-tip for="day-3">No contributions on November 23.</tool-tip>
    `;
    const parsed = parsePublicContributionsHtml(html);
    expect(parsed).toEqual([
      { date: "2026-11-21", count: 1 },
      { date: "2026-11-22", count: 21 },
      { date: "2026-11-23", count: 0 },
    ]);
  });
});
