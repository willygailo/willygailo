export type CommitsScope = "all_time" | "last_year";

export interface ContributionDay {
  readonly date: string; // YYYY-MM-DD
  readonly count: number;
}

export interface LanguageStat {
  readonly name: string;
  readonly color: string;
  readonly count: number;
  readonly percentage: number;
}

export interface StreakMetrics {
  readonly totalContributions: number;
  readonly firstContributionDate: string | null;
  readonly currentStreak: number;
  readonly currentStreakStart: string | null;
  readonly currentStreakEnd: string | null;
  readonly longestStreak: number;
  readonly longestStreakStart: string | null;
  readonly longestStreakEnd: string | null;
}

export interface ProfileOverview {
  readonly name: string;
  readonly login: string;
  readonly pronouns: string;
  readonly publicRepos: number;
  readonly starredRepos: number;
  readonly repoStarsReceived: number;
  readonly followers: number;
}

export interface FullProfileMetrics extends ProfileOverview {
  readonly totalCommits: number;
  readonly streak: StreakMetrics;
  readonly languages: readonly LanguageStat[];
  readonly recentDays: readonly ContributionDay[];
  readonly source: "graphql" | "rest_fallback";
}

export interface BadgeData {
  readonly label: string;
  readonly value: string;
  readonly color: string;
}
