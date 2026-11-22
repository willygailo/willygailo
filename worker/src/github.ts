import { computeStreakStats, getLastNDays, getTodayIsoInOffset } from "./streak.js";
import type {
  BadgeData,
  CommitsScope,
  ContributionDay,
  FullProfileMetrics,
  LanguageStat,
} from "./types.js";

const GITHUB_REST_URL = "https://api.github.com";
const GITHUB_GRAPHQL_URL = "https://api.github.com/graphql";
const USER_AGENT = "willygailo-live-profile-stats";

const LANGUAGE_COLORS: Record<string, string> = {
  Python: "#3572A5",
  JavaScript: "#f1e05a",
  Kotlin: "#A97BFF",
  HTML: "#e34c26",
  TypeScript: "#3178c6",
  Java: "#b07219",
  "C++": "#f34b7d",
  C: "#555555",
  Shell: "#89e051",
  PHP: "#4F5D95",
  CSS: "#563d7c",
  Go: "#00ADD8",
  Rust: "#dea584",
  Dart: "#00B4AB",
  Ruby: "#701516",
};

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message?: string }>;
}

interface RepoNode {
  stargazerCount: number;
  primaryLanguage: { name: string; color: string | null } | null;
}

interface ContributionCollectionNode {
  totalCommitContributions: number;
  restrictedContributionsCount: number;
  contributionYears?: number[];
  contributionCalendar: {
    totalContributions: number;
    weeks: Array<{
      contributionDays: Array<{
        date: string;
        contributionCount: number;
      }>;
    }>;
  };
}

interface FullUserQueryData {
  user: {
    name: string | null;
    login: string;
    pronouns: string | null;
    followers: { totalCount: number };
    starredRepositories: { totalCount: number };
    repositories: {
      totalCount: number;
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      nodes: RepoNode[];
    };
    contributionsCollection: ContributionCollectionNode;
  } | null;
}

interface ReposPageQueryData {
  user: {
    repositories: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      nodes: RepoNode[];
    };
  } | null;
}

interface BadgeOverviewQueryData {
  user: {
    followers: { totalCount: number };
    starredRepositories: { totalCount: number };
    repositories: { totalCount: number };
  } | null;
}

function buildHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": USER_AGENT,
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function fetchGraphQL<T>(
  query: string,
  variables: Record<string, unknown>,
  token: string,
  fetchFn: typeof fetch = fetch
): Promise<T> {
  const response = await fetchFn(GITHUB_GRAPHQL_URL, {
    method: "POST",
    headers: {
      ...buildHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`GitHub GraphQL HTTP ${response.status}`);
  }

  const parsed = (await response.json()) as GraphQLResponse<T>;
  if (parsed.errors && parsed.errors.length > 0) {
    throw new Error(parsed.errors.map((e) => e.message ?? "GraphQL error").join("; "));
  }
  if (!parsed.data) {
    throw new Error("GitHub GraphQL returned empty data");
  }
  return parsed.data;
}

async function fetchRestJson<T>(
  url: string,
  token?: string,
  fetchFn: typeof fetch = fetch
): Promise<{ data: T; headers: Headers }> {
  const response = await fetchFn(url, {
    headers: buildHeaders(token),
  });
  if (!response.ok) {
    throw new Error(`GitHub REST HTTP ${response.status} for ${url}`);
  }
  const data = (await response.json()) as T;
  return { data, headers: response.headers };
}

function aggregateLanguages(nodes: readonly { name: string | null; color?: string | null }[]): LanguageStat[] {
  const counts = new Map<string, { count: number; color: string }>();
  for (const item of nodes) {
    if (!item.name) continue;
    const existing = counts.get(item.name);
    const color = item.color || LANGUAGE_COLORS[item.name] || "#8be9fd";
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(item.name, { count: 1, color });
    }
  }

  const total = Array.from(counts.values()).reduce((sum, entry) => sum + entry.count, 0);
  return Array.from(counts.entries())
    .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
    .map(([name, info]) => ({
      name,
      color: info.color,
      count: info.count,
      percentage: total > 0 ? Math.round((info.count / total) * 1000) / 10 : 0,
    }));
}

function extractDays(collection: ContributionCollectionNode | undefined): ContributionDay[] {
  const weeks = collection?.contributionCalendar?.weeks ?? [];
  const days: ContributionDay[] = [];
  for (const week of weeks) {
    for (const day of week.contributionDays) {
      days.push({ date: day.date, count: day.contributionCount });
    }
  }
  return days;
}

async function fetchAllRepoNodesGraphQL(
  username: string,
  token: string,
  initialNodes: RepoNode[],
  initialPageInfo: { hasNextPage: boolean; endCursor: string | null },
  fetchFn: typeof fetch
): Promise<RepoNode[]> {
  const allNodes = [...initialNodes];
  let hasNext = initialPageInfo.hasNextPage;
  let cursor = initialPageInfo.endCursor;

  const pageQuery = `
    query($login: String!, $after: String!) {
      user(login: $login) {
        repositories(ownerAffiliations: OWNER, privacy: PUBLIC, first: 100, after: $after, orderBy: { field: STARGAZERS, direction: DESC }) {
          pageInfo { hasNextPage endCursor }
          nodes {
            stargazerCount
            primaryLanguage { name color }
          }
        }
      }
    }
  `;

  while (hasNext && cursor) {
    const pageData = await fetchGraphQL<ReposPageQueryData>(
      pageQuery,
      { login: username, after: cursor },
      token,
      fetchFn
    );
    const repos = pageData.user?.repositories;
    if (!repos) break;
    allNodes.push(...repos.nodes);
    hasNext = repos.pageInfo.hasNextPage;
    cursor = repos.pageInfo.endCursor;
  }

  return allNodes;
}

async function fetchContributionsByYearsGraphQL(
  username: string,
  years: readonly number[],
  token: string,
  fetchFn: typeof fetch
): Promise<{ totalCommitsAllYears: number; days: ContributionDay[] }> {
  if (years.length === 0) {
    return { totalCommitsAllYears: 0, days: [] };
  }

  const yearFields = years
    .map(
      (year, idx) => `
      y${idx}: contributionsCollection(from: "${year}-01-01T00:00:00Z", to: "${year}-12-31T23:59:59Z") {
        totalCommitContributions
        restrictedContributionsCount
        contributionCalendar {
          weeks {
            contributionDays {
              date
              contributionCount
            }
          }
        }
      }`
    )
    .join("\n");

  const query = `
    query($login: String!) {
      user(login: $login) {
        ${yearFields}
      }
    }
  `;

  const result = await fetchGraphQL<{
    user: Record<string, ContributionCollectionNode> | null;
  }>(query, { login: username }, token, fetchFn);

  if (!result.user) {
    return { totalCommitsAllYears: 0, days: [] };
  }

  let totalCommitsAllYears = 0;
  const days: ContributionDay[] = [];
  for (const key of Object.keys(result.user)) {
    const col = result.user[key];
    if (!col) continue;
    totalCommitsAllYears +=
      (col.totalCommitContributions ?? 0) + (col.restrictedContributionsCount ?? 0);
    days.push(...extractDays(col));
  }

  return { totalCommitsAllYears, days };
}

export async function fetchBadgeMetric(
  username: string,
  type: "followers" | "repos" | "starred" | "repo-stars",
  token?: string,
  fetchFn: typeof fetch = fetch
): Promise<BadgeData> {
  if (token) {
    if (type === "repo-stars") {
      const repoStars = await fetchRepoStarsGraphQL(username, token, fetchFn);
      return { label: "Repo Stars", value: String(repoStars), color: "0e75b6" };
    }

    const query = `
      query($login: String!) {
        user(login: $login) {
          followers { totalCount }
          starredRepositories { totalCount }
          repositories(ownerAffiliations: OWNER, privacy: PUBLIC) { totalCount }
        }
      }
    `;
    const data = await fetchGraphQL<BadgeOverviewQueryData>(
      query,
      { login: username },
      token,
      fetchFn
    );
    if (!data.user) {
      throw new Error(`GitHub user "${username}" not found`);
    }
    if (type === "followers") {
      return { label: "Followers", value: String(data.user.followers.totalCount), color: "0e75b6" };
    }
    if (type === "repos") {
      return {
        label: "Repositories",
        value: String(data.user.repositories.totalCount),
        color: "0e75b6",
      };
    }
    return {
      label: "Stars",
      value: String(data.user.starredRepositories.totalCount),
      color: "0e75b6",
    };
  }

  // Unauthenticated REST fallback
  if (type === "followers" || type === "repos") {
    const { data: user } = await fetchRestJson<{ public_repos: number; followers: number }>(
      `${GITHUB_REST_URL}/users/${encodeURIComponent(username)}`,
      undefined,
      fetchFn
    );
    return type === "followers"
      ? { label: "Followers", value: String(user.followers ?? 0), color: "0e75b6" }
      : { label: "Repositories", value: String(user.public_repos ?? 0), color: "0e75b6" };
  }

  if (type === "starred") {
    const count = await countStarredRest(username, undefined, fetchFn);
    return { label: "Stars", value: String(count), color: "0e75b6" };
  }

  const repos = await fetchAllReposRest(username, undefined, fetchFn);
  const stars = repos.reduce((sum, repo) => sum + (repo.stargazers_count ?? 0), 0);
  return { label: "Repo Stars", value: String(stars), color: "0e75b6" };
}

async function fetchRepoStarsGraphQL(
  username: string,
  token: string,
  fetchFn: typeof fetch
): Promise<number> {
  const firstQuery = `
    query($login: String!) {
      user(login: $login) {
        repositories(ownerAffiliations: OWNER, privacy: PUBLIC, first: 100, orderBy: { field: STARGAZERS, direction: DESC }) {
          pageInfo { hasNextPage endCursor }
          nodes {
            stargazerCount
            primaryLanguage { name color }
          }
        }
      }
    }
  `;
  const data = await fetchGraphQL<ReposPageQueryData>(
    firstQuery,
    { login: username },
    token,
    fetchFn
  );
  if (!data.user) {
    throw new Error(`GitHub user "${username}" not found`);
  }
  const nodes = await fetchAllRepoNodesGraphQL(
    username,
    token,
    data.user.repositories.nodes,
    data.user.repositories.pageInfo,
    fetchFn
  );
  return nodes.reduce((sum, node) => sum + (node.stargazerCount ?? 0), 0);
}

export async function fetchLanguagesOnly(
  username: string,
  token?: string,
  fetchFn: typeof fetch = fetch
): Promise<LanguageStat[]> {
  if (token) {
    const firstQuery = `
      query($login: String!) {
        user(login: $login) {
          repositories(ownerAffiliations: OWNER, privacy: PUBLIC, first: 100, orderBy: { field: STARGAZERS, direction: DESC }) {
            pageInfo { hasNextPage endCursor }
            nodes {
              stargazerCount
              primaryLanguage { name color }
            }
          }
        }
      }
    `;
    const data = await fetchGraphQL<ReposPageQueryData>(
      firstQuery,
      { login: username },
      token,
      fetchFn
    );
    if (!data.user) {
      throw new Error(`GitHub user "${username}" not found`);
    }
    const nodes = await fetchAllRepoNodesGraphQL(
      username,
      token,
      data.user.repositories.nodes,
      data.user.repositories.pageInfo,
      fetchFn
    );
    return aggregateLanguages(
      nodes.map((n) => ({ name: n.primaryLanguage?.name ?? null, color: n.primaryLanguage?.color }))
    );
  }

  const repos = await fetchAllReposRest(username, undefined, fetchFn);
  return aggregateLanguages(repos.map((r) => ({ name: r.language ?? null })));
}

export async function fetchFullProfileMetrics(
  username: string,
  token: string | undefined,
  commitsScope: CommitsScope,
  offsetMinutes: number,
  fetchFn: typeof fetch = fetch,
  now: Date = new Date()
): Promise<FullProfileMetrics> {
  const todayIso = getTodayIsoInOffset(offsetMinutes, now);

  if (token) {
    const query = `
      query($login: String!) {
        user(login: $login) {
          name
          login
          pronouns
          followers { totalCount }
          starredRepositories { totalCount }
          repositories(ownerAffiliations: OWNER, privacy: PUBLIC, first: 100, orderBy: { field: STARGAZERS, direction: DESC }) {
            totalCount
            pageInfo { hasNextPage endCursor }
            nodes {
              stargazerCount
              primaryLanguage { name color }
            }
          }
          contributionsCollection {
            totalCommitContributions
            restrictedContributionsCount
            contributionYears
            contributionCalendar {
              totalContributions
              weeks {
                contributionDays {
                  date
                  contributionCount
                }
              }
            }
          }
        }
      }
    `;

    const data = await fetchGraphQL<FullUserQueryData>(query, { login: username }, token, fetchFn);
    if (!data.user) {
      throw new Error(`GitHub user "${username}" not found`);
    }

    const user = data.user;
    const allRepoNodes = await fetchAllRepoNodesGraphQL(
      username,
      token,
      user.repositories.nodes,
      user.repositories.pageInfo,
      fetchFn
    );

    const years = user.contributionsCollection.contributionYears ?? [];
    const currentYear = Number(todayIso.slice(0, 4));
    const needsMultiYearQuery = years.some((y) => y < currentYear);
    const lastYearCommits =
      (user.contributionsCollection.totalCommitContributions ?? 0) +
      (user.contributionsCollection.restrictedContributionsCount ?? 0);

    const multiYear = needsMultiYearQuery
      ? await fetchContributionsByYearsGraphQL(username, years, token, fetchFn)
      : {
          totalCommitsAllYears: lastYearCommits,
          days: [] as ContributionDay[],
        };

    const allDays = [...extractDays(user.contributionsCollection), ...multiYear.days];
    const streak = computeStreakStats(allDays, todayIso);
    const recentDays = getLastNDays(allDays, todayIso, 31);

    return {
      name: (user.name || user.login || username).trim(),
      login: (user.login || username).trim(),
      pronouns: (user.pronouns || "he/him").trim(),
      publicRepos: user.repositories.totalCount,
      starredRepos: user.starredRepositories.totalCount,
      repoStarsReceived: allRepoNodes.reduce((sum, n) => sum + (n.stargazerCount ?? 0), 0),
      followers: user.followers.totalCount,
      totalCommits: commitsScope === "all_time" ? multiYear.totalCommitsAllYears : lastYearCommits,
      streak,
      languages: aggregateLanguages(
        allRepoNodes.map((n) => ({
          name: n.primaryLanguage?.name ?? null,
          color: n.primaryLanguage?.color,
        }))
      ),
      recentDays,
      source: "graphql",
    };
  }

  // Fallback path when GH_TOKEN is not configured yet.
  const [{ data: userRest }, starredRepos, reposRest, calendarDays] = await Promise.all([
    fetchRestJson<{
      name?: string | null;
      login?: string;
      public_repos?: number;
      followers?: number;
    }>(`${GITHUB_REST_URL}/users/${encodeURIComponent(username)}`, undefined, fetchFn),
    countStarredRest(username, undefined, fetchFn),
    fetchAllReposRest(username, undefined, fetchFn),
    fetchPublicContributionsHtml(username, fetchFn),
  ]);

  const streak = computeStreakStats(calendarDays, todayIso);
  const recentDays = getLastNDays(calendarDays, todayIso, 31);

  return {
    name: (userRest.name || userRest.login || username).trim(),
    login: (userRest.login || username).trim(),
    pronouns: "he/him",
    publicRepos: userRest.public_repos ?? reposRest.length,
    starredRepos,
    repoStarsReceived: reposRest.reduce((sum, r) => sum + (r.stargazers_count ?? 0), 0),
    followers: userRest.followers ?? 0,
    totalCommits: streak.totalContributions,
    streak,
    languages: aggregateLanguages(reposRest.map((r) => ({ name: r.language ?? null }))),
    recentDays,
    source: "rest_fallback",
  };
}

interface RestRepo {
  stargazers_count?: number;
  language?: string | null;
}

async function fetchAllReposRest(
  username: string,
  token: string | undefined,
  fetchFn: typeof fetch
): Promise<RestRepo[]> {
  const allRepos: RestRepo[] = [];
  let page = 1;
  while (true) {
    const url = `${GITHUB_REST_URL}/users/${encodeURIComponent(username)}/repos?per_page=100&type=owner&page=${page}`;
    const { data } = await fetchRestJson<RestRepo[]>(url, token, fetchFn);
    if (!Array.isArray(data) || data.length === 0) break;
    allRepos.push(...data);
    if (data.length < 100) break;
    page += 1;
  }
  return allRepos;
}

async function countStarredRest(
  username: string,
  token: string | undefined,
  fetchFn: typeof fetch
): Promise<number> {
  const url = `${GITHUB_REST_URL}/users/${encodeURIComponent(username)}/starred?per_page=1`;
  const { data, headers } = await fetchRestJson<unknown[]>(url, token, fetchFn);
  const link = headers.get("link") ?? "";
  const match = link.match(/[?&]page=(\d+)>;\s*rel="last"/);
  if (match) {
    return Number(match[1]);
  }
  return Array.isArray(data) ? data.length : 0;
}

/**
 * Parse GitHub's public contributions calendar HTML fragment as a zero-token fallback.
 */
export function parsePublicContributionsHtml(html: string): ContributionDay[] {
  const idToDate = new Map<string, string>();
  const cellRegex = /<td[^>]*\bid="([^"]+)"[^>]*\bdata-date="(\d{4}-\d{2}-\d{2})"|<td[^>]*\bdata-date="(\d{4}-\d{2}-\d{2})"[^>]*\bid="([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = cellRegex.exec(html)) !== null) {
    const id = match[1] ?? match[4];
    const date = match[2] ?? match[3];
    if (id && date) {
      idToDate.set(id, date);
    }
  }

  const days: ContributionDay[] = [];
  const tipRegex = /<tool-tip[^>]*\bfor="([^"]+)"[^>]*>([^<]+)<\/tool-tip>/g;
  while ((match = tipRegex.exec(html)) !== null) {
    const cellId = match[1];
    const text = match[2].trim();
    const date = idToDate.get(cellId);
    if (!date) continue;

    if (text.startsWith("No contributions")) {
      days.push({ date, count: 0 });
    } else {
      const numMatch = text.match(/^(\d+)\s+contribution/);
      days.push({ date, count: numMatch ? Number(numMatch[1]) : 0 });
    }
  }
  return days;
}

async function fetchPublicContributionsHtml(
  username: string,
  fetchFn: typeof fetch
): Promise<ContributionDay[]> {
  try {
    const response = await fetchFn(
      `https://github.com/users/${encodeURIComponent(username)}/contributions`,
      {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html",
        },
      }
    );
    if (!response.ok) return [];
    const html = await response.text();
    return parsePublicContributionsHtml(html);
  } catch {
    return [];
  }
}
