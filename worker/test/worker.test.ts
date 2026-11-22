import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { env, exports } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../src/index.js";

const MOCK_GRAPHQL_USER = {
  data: {
    user: {
      name: "PENTESTER",
      login: "willygailo",
      pronouns: "he/him",
      followers: { totalCount: 15 },
      starredRepositories: { totalCount: 100 },
      repositories: {
        totalCount: 88,
        pageInfo: { hasNextPage: false, endCursor: null },
        nodes: [
          { stargazerCount: 40, primaryLanguage: { name: "Python", color: "#3572A5" } },
          { stargazerCount: 31, primaryLanguage: { name: "Kotlin", color: "#A97BFF" } },
        ],
      },
      contributionsCollection: {
        totalCommitContributions: 85,
        restrictedContributionsCount: 5,
        contributionYears: [2026],
        contributionCalendar: {
          totalContributions: 175,
          weeks: [
            {
              contributionDays: [
                { date: "2026-11-21", contributionCount: 2 },
                { date: "2026-11-22", contributionCount: 5 },
              ],
            },
          ],
        },
      },
    },
  },
};

describe("Worker HTTP endpoints", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns service index and health metadata with no-cache headers", async () => {
    const rootRes = await exports.default.fetch("https://example.com/");
    expect(rootRes.status).toBe(200);
    expect(rootRes.headers.get("cache-control")).toBe(
      "no-cache, no-store, must-revalidate, max-age=0"
    );
    const rootJson = (await rootRes.json()) as { live: boolean; endpoints: string[] };
    expect(rootJson.live).toBe(true);
    expect(rootJson.endpoints).toContain("/badge/repo-stars");

    const healthRes = await exports.default.fetch("https://example.com/health");
    expect(healthRes.status).toBe(200);
    const healthJson = (await healthRes.json()) as { ok: boolean; username: string };
    expect(healthJson.ok).toBe(true);
    expect(healthJson.username).toBe("willygailo");
  });

  it("rejects non-GET requests and unknown paths cleanly", async () => {
    const postRes = await exports.default.fetch("https://example.com/card/stats", {
      method: "POST",
    });
    expect(postRes.status).toBe(405);

    const notFound = await exports.default.fetch("https://example.com/unknown");
    expect(notFound.status).toBe(404);
  });

  it("serves live badge SVGs with zero-cache headers via REST fallback", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.includes("/repos")) {
        return Response.json([{ stargazers_count: 71 }]);
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    const ctx = createExecutionContext();
    const res = await worker.fetch(new Request("https://example.com/badge/repo-stars"), env, ctx);
    await waitOnExecutionContext(ctx);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/svg+xml; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe(
      "no-cache, no-store, must-revalidate, max-age=0"
    );
    expect(res.headers.get("cdn-cache-control")).toBe("no-store");
    const svg = await res.text();
    expect(svg).toContain("REPO STARS");
    expect(svg).toContain(">71<");
  });

  it("serves all live cards from GraphQL when GH_TOKEN is configured", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
      const parsed = JSON.parse(String(init?.body ?? "{}")) as { query?: string };
      if (parsed.query?.includes("y0:")) {
        return Response.json({
          data: {
            user: {
              y0: {
                totalCommitContributions: 85,
                restrictedContributionsCount: 5,
                contributionCalendar: {
                  weeks: [
                    {
                      contributionDays: [
                        { date: "2026-11-21", contributionCount: 2 },
                        { date: "2026-11-22", contributionCount: 5 },
                      ],
                    },
                  ],
                },
              },
            },
          },
        });
      }
      return Response.json(MOCK_GRAPHQL_USER);
    });

    const authedEnv: Env = { ...env, GH_TOKEN: "ghp_mock_secret_token" };

    for (const [path, expectedSnippet] of [
      ["/card/stats", "88"],
      ["/card/streak", "Current Streak"],
      ["/card/languages", "Top Languages by Repo"],
      ["/card/activity", "PENTESTER&#39;s Contribution Graph"],
    ] as const) {
      const ctx = createExecutionContext();
      const res = await worker.fetch(new Request(`https://example.com${path}`), authedEnv, ctx);
      await waitOnExecutionContext(ctx);

      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("image/svg+xml; charset=utf-8");
      expect(res.headers.get("cache-control")).toBe(
        "no-cache, no-store, must-revalidate, max-age=0"
      );
      const svg = await res.text();
      expect(svg).toContain(expectedSnippet);
    }
  });

  it("returns 502 error SVG with no-cache headers when upstream fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("GitHub timeout"));

    const ctx = createExecutionContext();
    const res = await worker.fetch(new Request("https://example.com/card/stats"), env, ctx);
    await waitOnExecutionContext(ctx);

    expect(res.status).toBe(502);
    expect(res.headers.get("cache-control")).toBe(
      "no-cache, no-store, must-revalidate, max-age=0"
    );
    const svg = await res.text();
    expect(svg).toContain("GitHub Stats Unavailable");
  });
});
