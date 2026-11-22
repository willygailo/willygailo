import { escapeXml } from "../svgUtils.js";
import type { FullProfileMetrics } from "../types.js";

interface StatRow {
  readonly label: string;
  readonly value: string;
  readonly iconPath: string;
}

/**
 * Render the main Dracula-themed PENTESTER GitHub stats card (380x200).
 */
export function renderStatsCardSvg(stats: FullProfileMetrics): string {
  const title = escapeXml(stats.name);
  const subtitle = escapeXml(`${stats.login} · ${stats.pronouns}`);

  const rows: readonly StatRow[] = [
    {
      label: "Stars (Starred):",
      value: String(stats.starredRepos),
      iconPath:
        "M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.791L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L.818 6.374a.75.75 0 01.416-1.28l4.21-.611L7.327.668A.75.75 0 018 .25z",
    },
    {
      label: "Repositories:",
      value: String(stats.publicRepos),
      iconPath:
        "M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 110-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1V9h-8c-.356 0-.694.074-1 .208V2.5a1 1 0 011-1h8z",
    },
    {
      label: "Repo Stars:",
      value: String(stats.repoStarsReceived),
      iconPath:
        "M8 1.5l1.95 3.95 4.36.63-3.15 3.07.74 4.34L8 11.44l-3.9 2.05.74-4.34L1.69 6.08l4.36-.63L8 1.5z",
    },
    {
      label: "Total Commits:",
      value: String(stats.totalCommits),
      iconPath:
        "M10.5 7.75a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zm1.43.75a4.002 4.002 0 01-7.86 0H.75a.75.75 0 110-1.5h3.32a4.001 4.001 0 017.86 0h3.32a.75.75 0 110 1.5h-3.32z",
    },
    {
      label: "Followers:",
      value: String(stats.followers),
      iconPath:
        "M5.5 3.5a2 2 0 100 4 2 2 0 000-4zM2 5.5a3.5 3.5 0 115.898 2.549 5.507 5.507 0 013.034 4.084.75.75 0 11-1.482.235 4.001 4.001 0 00-7.9 0 .75.75 0 01-1.482-.236A5.507 5.507 0 013.102 8.05 3.49 3.49 0 012 5.5zM11 4a.75.75 0 100 1.5 1.5 1.5 0 01.666 2.844.75.75 0 00-.416.672v.352a.75.75 0 00.574.73c1.2.289 2.162 1.2 2.522 2.372a.75.75 0 101.434-.44 5.01 5.01 0 00-2.56-3.012A3 3 0 0011 4z",
    },
  ];

  const rowsBlock = rows
    .map((row, idx) => {
      const yOffset = idx * 23;
      return `    <g transform="translate(0,${yOffset})">
      <g transform="translate(0,2)" fill="#6272a4"><path fill-rule="evenodd" d="${row.iconPath}"></path></g>
      <text x="23" y="14" fill="#ffb86c" font-size="13.5" font-weight="500">${escapeXml(row.label)}</text>
      <text x="195" y="14" fill="#f8f8f2" font-size="13.5" font-weight="700" text-anchor="end">${escapeXml(row.value)}</text>
    </g>`;
    })
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="380" height="200" viewBox="0 0 380 200" role="img" aria-label="${title} (${subtitle}) GitHub Stats">
  <style>
    * {
      font-family: 'Segoe UI', Ubuntu, 'Helvetica Neue', Sans-Serif;
    }
  </style>
  <rect x="1" y="1" rx="5" ry="5" width="378" height="198" fill="#282a36" stroke="#44475a" stroke-width="1"/>
  <text x="24" y="34" fill="#ff79c6" font-size="19" font-weight="700">${title}</text>
  <text x="24" y="54" fill="#8be9fd" font-size="12.5" font-weight="600">${subtitle}</text>
  <g transform="translate(24,72)">
${rowsBlock}
  </g>
  <g transform="translate(258,58)">
    <g transform="scale(5.8)" fill="#6272a4" opacity="0.85">
      <path fill-rule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
    </g>
  </g>
</svg>`;
}
