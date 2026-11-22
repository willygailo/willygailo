import { escapeXml } from "../svgUtils.js";
import type { LanguageStat } from "../types.js";

function polarToCartesian(cx: number, cy: number, radius: number, angleDeg: number): [number, number] {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return [cx + radius * Math.cos(rad), cy + radius * Math.sin(rad)];
}

function describeDonutArc(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startDeg: number,
  endDeg: number
): string {
  const sweep = endDeg - startDeg;
  if (sweep >= 359.99) {
    // Full ring rendered as two 180-degree arcs.
    return `${describeDonutArc(cx, cy, outerR, innerR, 0, 180)} ${describeDonutArc(cx, cy, outerR, innerR, 180, 359.99)}`;
  }
  const [x1, y1] = polarToCartesian(cx, cy, outerR, startDeg);
  const [x2, y2] = polarToCartesian(cx, cy, outerR, endDeg);
  const [x3, y3] = polarToCartesian(cx, cy, innerR, endDeg);
  const [x4, y4] = polarToCartesian(cx, cy, innerR, startDeg);
  const largeArc = sweep > 180 ? 1 : 0;

  return [
    `M ${x1.toFixed(2)} ${y1.toFixed(2)}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
    `L ${x3.toFixed(2)} ${y3.toFixed(2)}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4.toFixed(2)} ${y4.toFixed(2)}`,
    "Z",
  ].join(" ");
}

/**
 * Render the Dracula-themed "Top Languages by Repo" donut card (340x200).
 */
export function renderLanguagesCardSvg(languages: readonly LanguageStat[]): string {
  const top = languages.slice(0, 5);
  const totalCount = top.reduce((sum, item) => sum + item.count, 0);

  const legendItems = top
    .map((lang, idx) => {
      const y = idx * 23;
      const safeName = escapeXml(lang.name);
      const safeColor = escapeXml(lang.color || "#8be9fd");
      return `    <g transform="translate(0,${y})">
      <rect x="0" y="0" width="12" height="12" rx="2" fill="${safeColor}"/>
      <text x="18" y="10.5" fill="#f8f8f2" font-size="13">${safeName}</text>
    </g>`;
    })
    .join("\n");

  const cx = 246;
  const cy = 122;
  const outerR = 54;
  const innerR = 32;

  let currentAngle = 0;
  const slices =
    totalCount > 0
      ? top
          .map((lang) => {
            const angle = (lang.count / totalCount) * 360;
            const start = currentAngle;
            const end = currentAngle + angle;
            currentAngle = end;
            if (angle <= 0.1) {
              return "";
            }
            const pathD = describeDonutArc(cx, cy, outerR, innerR, start, end);
            const safeColor = escapeXml(lang.color || "#8be9fd");
            return `  <path d="${pathD}" fill="${safeColor}" stroke="#282a36" stroke-width="1.5"/>`;
          })
          .filter(Boolean)
          .join("\n")
      : `  <circle cx="${cx}" cy="${cy}" r="${(outerR + innerR) / 2}" fill="none" stroke="#44475a" stroke-width="${outerR - innerR}"/>`;

  const emptyNote =
    top.length === 0
      ? `<text x="30" y="100" fill="#6272a4" font-size="13">No language data yet</text>`
      : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="340" height="200" viewBox="0 0 340 200" role="img" aria-label="Top Languages by Repo">
  <style>
    * {
      font-family: 'Segoe UI', Ubuntu, 'Helvetica Neue', Sans-Serif;
    }
  </style>
  <rect x="1" y="1" rx="5" ry="5" width="338" height="198" fill="#282a36" stroke="#44475a" stroke-width="1"/>
  <text x="30" y="40" fill="#ff79c6" font-size="20" font-weight="500">Top Languages by Repo</text>
  <g transform="translate(36,68)">
${legendItems}
  </g>
${emptyNote}
${slices}
</svg>`;
}
