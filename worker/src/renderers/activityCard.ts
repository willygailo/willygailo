import { escapeXml } from "../svgUtils.js";
import type { ContributionDay } from "../types.js";

function chooseYMax(maxValue: number): { yMax: number; step: number } {
  if (maxValue <= 5) return { yMax: 5, step: 1 };
  if (maxValue <= 10) return { yMax: 10, step: 2 };
  if (maxValue <= 25) return { yMax: 25, step: 5 };
  if (maxValue <= 50) return { yMax: 50, step: 10 };
  const step = Math.ceil(maxValue / 5 / 5) * 5;
  return { yMax: step * 5, step };
}

/**
 * Build a smooth cubic Bezier SVG path through points while clamping to the baseline.
 */
function buildSmoothPath(points: readonly { x: number; y: number }[], baselineY: number): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;

  const parts: string[] = [`M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`];
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = Math.min(baselineY, p1.y + (p2.y - p0.y) / 6);
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = Math.min(baselineY, p2.y - (p3.y - p1.y) / 6);

    parts.push(
      `C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
    );
  }
  return parts.join(" ");
}

/**
 * Render the react-dark style Contribution Graph card (1200x420).
 */
export function renderActivityCardSvg(
  displayName: string,
  days: readonly ContributionDay[]
): string {
  const safeTitle = escapeXml(`${displayName}'s Contribution Graph`);

  const plotLeft = 104;
  const plotRight = 1136;
  const plotTop = 82;
  const plotBottom = 342;
  const plotWidth = plotRight - plotLeft;
  const plotHeight = plotBottom - plotTop;

  const maxCount = days.reduce((m, d) => Math.max(m, d.count), 0);
  const { yMax, step } = chooseYMax(maxCount);

  const yTicks: number[] = [];
  for (let v = 0; v <= yMax; v += step) {
    yTicks.push(v);
  }

  const xStep = days.length > 1 ? plotWidth / (days.length - 1) : 0;
  const coords = days.map((d, idx) => {
    const x = plotLeft + idx * xStep;
    const ratio = yMax > 0 ? d.count / yMax : 0;
    const y = plotBottom - ratio * plotHeight;
    return { x, y, dayNum: String(Number(d.date.slice(8, 10))), count: d.count };
  });

  const horizontalGrid = yTicks
    .map((tick) => {
      const y = plotBottom - (tick / yMax) * plotHeight;
      return `  <line x1="${plotLeft}" y1="${y.toFixed(1)}" x2="${plotRight}" y2="${y.toFixed(1)}" stroke="#4e4e52" stroke-width="1" stroke-dasharray="2,3"/>
  <text x="${plotLeft - 14}" y="${(y + 4).toFixed(1)}" fill="#70c7f5" font-size="12" font-weight="600" text-anchor="end">${tick}</text>`;
    })
    .join("\n");

  const verticalGrid = coords
    .map(
      (pt) =>
        `  <line x1="${pt.x.toFixed(1)}" y1="${plotTop}" x2="${pt.x.toFixed(1)}" y2="${plotBottom}" stroke="#4e4e52" stroke-width="1" stroke-dasharray="2,3"/>
  <text x="${pt.x.toFixed(1)}" y="${plotBottom + 24}" fill="#70c7f5" font-size="12" font-weight="600" text-anchor="middle">${pt.dayNum}</text>`
    )
    .join("\n");

  const linePath = buildSmoothPath(coords, plotBottom);
  const areaPath =
    coords.length > 0
      ? `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${plotBottom} L ${coords[0].x.toFixed(1)} ${plotBottom} Z`
      : "";

  const dots = coords
    .map(
      (pt) =>
        `  <circle cx="${pt.x.toFixed(1)}" cy="${pt.y.toFixed(1)}" r="4.5" fill="#ffffff" stroke="#70c7f5" stroke-width="2"/>`
    )
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="420" viewBox="0 0 1200 420" fill="none" role="img" aria-label="${safeTitle}">
  <defs>
    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#70c7f5" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#70c7f5" stop-opacity="0.02"/>
    </linearGradient>
  </defs>
  <style>
    * {
      font-family: 'Segoe UI', Ubuntu, 'Helvetica Neue', Sans-Serif;
    }
  </style>
  <rect x="0.5" y="0.5" width="1199" height="419" fill="#0d1117" stroke="#ffffff" stroke-opacity="0.7" stroke-width="1"/>
  <text x="600" y="42" fill="#70c7f5" font-size="22" font-weight="700" text-anchor="middle">${safeTitle}</text>
  <text x="34" y="212" fill="#70c7f5" font-size="14" font-weight="600" text-anchor="middle" transform="rotate(-90 34 212)">Contributions</text>
  <text x="620" y="394" fill="#70c7f5" font-size="14" font-weight="600" text-anchor="middle">Days</text>
${horizontalGrid}
${verticalGrid}
  ${areaPath ? `<path d="${areaPath}" fill="url(#areaGrad)"/>` : ""}
  ${linePath ? `<path d="${linePath}" fill="none" stroke="#70c7f5" stroke-width="3.5" stroke-linecap="round"/>` : ""}
${dots}
</svg>`;
}
