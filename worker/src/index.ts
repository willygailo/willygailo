import {
  fetchBadgeMetric,
  fetchFullProfileMetrics,
  fetchLanguagesOnly,
} from "./github.js";
import { renderActivityCardSvg } from "./renderers/activityCard.js";
import { renderForTheBadgeSvg } from "./renderers/badges.js";
import { renderLanguagesCardSvg } from "./renderers/languagesCard.js";
import { renderStatsCardSvg } from "./renderers/statsCard.js";
import { renderStreakCardSvg } from "./renderers/streakCard.js";
import { getTodayIsoInOffset } from "./streak.js";
import { jsonResponse, renderErrorCard, svgResponse } from "./svgUtils.js";
import type { CommitsScope } from "./types.js";

const USERNAME_RE = /^[a-zA-Z0-9-]{1,39}$/;

const BADGE_ROUTES = new Map<string, "followers" | "repos" | "starred" | "repo-stars">([
  ["/badge/followers", "followers"],
  ["/badge/repos", "repos"],
  ["/badge/starred", "starred"],
  ["/badge/repo-stars", "repo-stars"],
]);

function parseUsername(url: URL, defaultUsername: string): string {
  const raw = url.searchParams.get("user")?.trim() || defaultUsername;
  if (!USERNAME_RE.test(raw)) {
    throw new Error("Invalid GitHub username parameter");
  }
  return raw;
}

function parseCommitsScope(url: URL, defaultScope: string): CommitsScope {
  const raw = url.searchParams.get("scope") || defaultScope;
  return raw === "last_year" ? "last_year" : "all_time";
}

function parseOffsetMinutes(url: URL, defaultMinutes: string): number {
  const raw = url.searchParams.get("tz") ?? defaultMinutes;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < -720 || parsed > 840) {
    return 480;
  }
  return Math.trunc(parsed);
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (path === "/") {
      return jsonResponse({
        service: "willygailo-profile-stats",
        live: true,
        endpoints: [
          "/badge/followers",
          "/badge/repos",
          "/badge/starred",
          "/badge/repo-stars",
          "/card/stats",
          "/card/streak",
          "/card/languages",
          "/card/activity",
          "/health",
        ],
      });
    }

    if (path === "/health") {
      return jsonResponse({
        ok: true,
        username: env.GITHUB_USERNAME,
        hasToken: Boolean(env.GH_TOKEN),
        timestamp: new Date().toISOString(),
      });
    }

    try {
      const badgeType = BADGE_ROUTES.get(path);
      const isSupportedCard =
        path === "/card/languages" ||
        path === "/card/stats" ||
        path === "/card/streak" ||
        path === "/card/activity";

      if (!badgeType && !isSupportedCard) {
        return jsonResponse({ error: "Not found", path }, 404);
      }

      const username = parseUsername(url, env.GITHUB_USERNAME || "willygailo");
      const token = env.GH_TOKEN || undefined;

      if (!token) {
        console.warn(
          JSON.stringify({
            level: "warn",
            message: "GH_TOKEN not set; using unauthenticated fallback",
            path,
            username,
          })
        );
      }

      if (badgeType) {
        const badge = await fetchBadgeMetric(username, badgeType, token);
        console.log(
          JSON.stringify({
            message: "rendered badge",
            path,
            username,
            value: badge.value,
            mode: token ? "graphql" : "rest_fallback",
          })
        );
        return svgResponse(renderForTheBadgeSvg(badge));
      }

      if (path === "/card/languages") {
        const languages = await fetchLanguagesOnly(username, token);
        console.log(
          JSON.stringify({
            message: "rendered languages card",
            username,
            languageCount: languages.length,
            mode: token ? "graphql" : "rest_fallback",
          })
        );
        return svgResponse(renderLanguagesCardSvg(languages));
      }

      const scope = parseCommitsScope(url, env.COMMITS_SCOPE || "all_time");
      const offsetMinutes = parseOffsetMinutes(url, env.TIMEZONE_OFFSET_MINUTES || "480");
      const metrics = await fetchFullProfileMetrics(username, token, scope, offsetMinutes);
      const currentYear = Number(getTodayIsoInOffset(offsetMinutes).slice(0, 4));

      console.log(
        JSON.stringify({
          message: "rendered profile card",
          path,
          username,
          source: metrics.source,
          repoStars: metrics.repoStarsReceived,
          repos: metrics.publicRepos,
          followers: metrics.followers,
          totalCommits: metrics.totalCommits,
        })
      );

      if (path === "/card/stats") {
        return svgResponse(renderStatsCardSvg(metrics));
      }
      if (path === "/card/streak") {
        return svgResponse(renderStreakCardSvg(metrics.streak, currentYear));
      }
      return svgResponse(renderActivityCardSvg(metrics.name, metrics.recentDays));
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      console.error(
        JSON.stringify({
          message: "request failed",
          path,
          error: detail,
        })
      );
      return svgResponse(renderErrorCard("GitHub Stats Unavailable", detail), 502);
    }
  },
} satisfies ExportedHandler<Env>;
