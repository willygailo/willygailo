#!/usr/bin/env python3
"""Fetch live GitHub profile metrics for willygailo and generate SVG/badge assets."""

from __future__ import annotations

import html
import json
import os
import re
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
ASSETS_DIR = ROOT_DIR / "assets"
GITHUB_API = "https://api.github.com"
GRAPHQL_URL = "https://api.github.com/graphql"


@dataclass(frozen=True)
class ProfileStats:
    """GitHub profile stats rendered in the Dracula SVG card and badges."""

    name: str
    login: str
    pronouns: str
    public_repos: int
    starred_repos: int
    repo_stars_received: int
    total_commits: int
    followers: int


def _request_json(
    url: str,
    token: str,
    payload: dict | None = None,
) -> tuple[dict | list, dict[str, str]]:
    """Send an authenticated GitHub API request and return parsed JSON + headers."""
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "willygailo-profile-stats",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"

    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    if data is not None:
        headers["Content-Type"] = "application/json"

    req = urllib.request.Request(url, data=data, headers=headers)
    with urllib.request.urlopen(req, timeout=20) as resp:
        raw = resp.read().decode("utf-8")
        resp_headers = {k.lower(): v for k, v in resp.headers.items()}
        return json.loads(raw), resp_headers


def _count_starred_rest(username: str, token: str) -> int:
    """Count public repositories starred by username via Link header pagination."""
    url = f"{GITHUB_API}/users/{username}/starred?per_page=1"
    items, headers = _request_json(url, token)
    link = headers.get("link", "")
    match = re.search(r'[?&]page=(\d+)>;\s*rel="last"', link)
    if match:
        return int(match.group(1))
    return len(items) if isinstance(items, list) else 0


def _sum_repo_stars_rest(username: str, token: str) -> int:
    """Sum stargazers_count across all public owned repositories."""
    total = 0
    page = 1
    while True:
        url = f"{GITHUB_API}/users/{username}/repos?per_page=100&type=owner&page={page}"
        repos, _ = _request_json(url, token)
        if not isinstance(repos, list) or not repos:
            break
        total += sum(int(repo.get("stargazers_count", 0)) for repo in repos)
        if len(repos) < 100:
            break
        page += 1
    return total


def _fetch_graphql_user(username: str, token: str) -> dict | None:
    """Query GitHub GraphQL API for profile pronouns, repos, stars, and commits."""
    if not token:
        return None
    query = """
    query($login: String!) {
      user(login: $login) {
        name
        login
        pronouns
        followers { totalCount }
        repositories(privacy: PUBLIC) { totalCount }
        starredRepositories { totalCount }
        contributionsCollection {
          totalCommitContributions
          restrictedContributionsCount
        }
      }
    }
    """
    try:
        resp, _ = _request_json(
            GRAPHQL_URL,
            token,
            payload={"query": query, "variables": {"login": username}},
        )
    except (urllib.error.URLError, urllib.error.HTTPError, ValueError):
        return None

    if not isinstance(resp, dict) or resp.get("errors"):
        return None
    return (resp.get("data") or {}).get("user")


def fetch_profile_stats(username: str, token: str) -> ProfileStats:
    """Collect profile statistics via GraphQL with REST fallback."""
    user_rest, _ = _request_json(f"{GITHUB_API}/users/{username}", token)
    if not isinstance(user_rest, dict):
        raise RuntimeError(f"Unexpected REST response for user {username}")

    gql_user = _fetch_graphql_user(username, token) or {}
    contribs = gql_user.get("contributionsCollection") or {}

    name = (gql_user.get("name") or user_rest.get("name") or username).strip()
    login = (gql_user.get("login") or user_rest.get("login") or username).strip()
    pronouns = (gql_user.get("pronouns") or "he/him").strip()

    public_repos = int(
        (gql_user.get("repositories") or {}).get("totalCount")
        if gql_user.get("repositories") is not None
        else user_rest.get("public_repos", 0)
    )
    followers = int(
        (gql_user.get("followers") or {}).get("totalCount")
        if gql_user.get("followers") is not None
        else user_rest.get("followers", 0)
    )
    starred_repos = int(
        (gql_user.get("starredRepositories") or {}).get("totalCount")
        if gql_user.get("starredRepositories") is not None
        else _count_starred_rest(username, token)
    )
    repo_stars_received = _sum_repo_stars_rest(username, token)

    total_commits = int(contribs.get("totalCommitContributions", 0)) + int(
        contribs.get("restrictedContributionsCount", 0)
    )
    if total_commits == 0:
        try:
            search_res, _ = _request_json(
                f"{GITHUB_API}/search/commits?q=author:{username}",
                token,
            )
            if isinstance(search_res, dict):
                total_commits = int(search_res.get("total_count", 0))
        except (urllib.error.URLError, urllib.error.HTTPError, ValueError):
            total_commits = 0

    return ProfileStats(
        name=name,
        login=login,
        pronouns=pronouns,
        public_repos=public_repos,
        starred_repos=starred_repos,
        repo_stars_received=repo_stars_received,
        total_commits=total_commits,
        followers=followers,
    )


def render_stats_svg(stats: ProfileStats) -> str:
    """Render a Dracula-themed SVG card matching the GitHub profile README cards."""
    title = html.escape(stats.name)
    subtitle = html.escape(f"{stats.login} · {stats.pronouns}")

    rows = [
        (
            "Stars (Starred):",
            str(stats.starred_repos),
            "M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.791L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L.818 6.374a.75.75 0 01.416-1.28l4.21-.611L7.327.668A.75.75 0 018 .25z",
        ),
        (
            "Repositories:",
            str(stats.public_repos),
            "M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 110-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1V9h-8c-.356 0-.694.074-1 .208V2.5a1 1 0 011-1h8z",
        ),
        (
            "Repo Stars:",
            str(stats.repo_stars_received),
            "M8 1.5l1.95 3.95 4.36.63-3.15 3.07.74 4.34L8 11.44l-3.9 2.05.74-4.34L1.69 6.08l4.36-.63L8 1.5z",
        ),
        (
            "Total Commits:",
            str(stats.total_commits),
            "M10.5 7.75a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zm1.43.75a4.002 4.002 0 01-7.86 0H.75a.75.75 0 110-1.5h3.32a4.001 4.001 0 017.86 0h3.32a.75.75 0 110 1.5h-3.32z",
        ),
        (
            "Followers:",
            str(stats.followers),
            "M5.5 3.5a2 2 0 100 4 2 2 0 000-4zM2 5.5a3.5 3.5 0 115.898 2.549 5.507 5.507 0 013.034 4.084.75.75 0 11-1.482.235 4.001 4.001 0 00-7.9 0 .75.75 0 01-1.482-.236A5.507 5.507 0 013.102 8.05 3.49 3.49 0 012 5.5zM11 4a.75.75 0 100 1.5 1.5 1.5 0 01.666 2.844.75.75 0 00-.416.672v.352a.75.75 0 00.574.73c1.2.289 2.162 1.2 2.522 2.372a.75.75 0 101.434-.44 5.01 5.01 0 00-2.56-3.012A3 3 0 0011 4z",
        ),
    ]

    row_svg: list[str] = []
    for idx, (label, value, icon_path) in enumerate(rows):
        y_offset = idx * 23
        row_svg.append(
            f'    <g transform="translate(0,{y_offset})">\n'
            f'      <g transform="translate(0,2)" fill="#6272a4"><path fill-rule="evenodd" d="{icon_path}"></path></g>\n'
            f'      <text x="23" y="14" fill="#ffb86c" font-size="13.5" font-weight="500">{html.escape(label)}</text>\n'
            f'      <text x="195" y="14" fill="#f8f8f2" font-size="13.5" font-weight="700" text-anchor="end">{html.escape(value)}</text>\n'
            f"    </g>"
        )

    rows_block = "\n".join(row_svg)
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="380" height="200" viewBox="0 0 380 200" role="img" aria-label="{title} ({subtitle}) GitHub Stats">
  <style>
    * {{
      font-family: 'Segoe UI', Ubuntu, 'Helvetica Neue', Sans-Serif;
    }}
  </style>
  <rect x="1" y="1" rx="5" ry="5" width="378" height="198" fill="#282a36" stroke="#44475a" stroke-width="1"/>
  <text x="24" y="34" fill="#ff79c6" font-size="19" font-weight="700">{title}</text>
  <text x="24" y="54" fill="#8be9fd" font-size="12.5" font-weight="600">{subtitle}</text>
  <g transform="translate(24,72)">
{rows_block}
  </g>
  <g transform="translate(258,58)">
    <g transform="scale(5.8)" fill="#6272a4" opacity="0.85">
      <path fill-rule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
    </g>
  </g>
</svg>
"""


def write_badge_json(path: Path, label: str, message: str, color: str = "0e75b6") -> None:
    """Write a Shields.io endpoint JSON payload."""
    payload = {
        "schemaVersion": 1,
        "label": label,
        "message": message,
        "color": color,
    }
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    username = os.environ.get("GITHUB_USERNAME", "willygailo")
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN", "")

    stats = fetch_profile_stats(username, token)
    ASSETS_DIR.mkdir(parents=True, exist_ok=True)

    (ASSETS_DIR / "stats.svg").write_text(render_stats_svg(stats), encoding="utf-8")
    write_badge_json(ASSETS_DIR / "repos-badge.json", "Repositories", str(stats.public_repos))
    write_badge_json(ASSETS_DIR / "starred-badge.json", "Stars", str(stats.starred_repos))

    print(
        f"Updated assets for {stats.name} ({stats.login} · {stats.pronouns}): "
        f"starred={stats.starred_repos}, repos={stats.public_repos}, "
        f"repo_stars={stats.repo_stars_received}, commits={stats.total_commits}, "
        f"followers={stats.followers}"
    )


if __name__ == "__main__":
    main()
