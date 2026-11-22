import { escapeXml } from "../svgUtils.js";
import type { BadgeData } from "../types.js";

const GITHUB_OCTOCAT_PATH =
  "M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z";

function estimateTextWidth(text: string, isBold: boolean): number {
  let width = 0;
  for (const ch of text) {
    if ("IL1.:|!".includes(ch)) {
      width += 4.5;
    } else if ("MWQG@".includes(ch)) {
      width += isBold ? 9.8 : 9.2;
    } else if (ch === " ") {
      width += 4.2;
    } else {
      width += isBold ? 8.1 : 7.4;
    }
  }
  return Math.ceil(width);
}

/**
 * Render a Shields.io-style `for-the-badge` SVG badge with GitHub Octocat icon.
 */
export function renderForTheBadgeSvg(badge: BadgeData): string {
  const labelUpper = badge.label.toUpperCase();
  const valueUpper = badge.value.toUpperCase();

  const iconWidth = 14;
  const iconLeftPad = 9;
  const iconGap = 6;
  const sidePad = 10;

  const labelTextWidth = estimateTextWidth(labelUpper, false);
  const valueTextWidth = estimateTextWidth(valueUpper, true);

  const leftWidth = iconLeftPad + iconWidth + iconGap + labelTextWidth + sidePad;
  const rightWidth = Math.max(36, valueTextWidth + sidePad * 2);
  const totalWidth = leftWidth + rightWidth;

  const labelCenterX = Math.round((iconLeftPad + iconWidth + iconGap + (leftWidth - sidePad)) * 5);
  const valueCenterX = Math.round((leftWidth + rightWidth / 2) * 10);
  const labelTextLen = labelTextWidth * 10;
  const valueTextLen = valueTextWidth * 10;

  const safeAria = escapeXml(`${labelUpper}: ${valueUpper}`);
  const safeLabel = escapeXml(labelUpper);
  const safeValue = escapeXml(valueUpper);
  const safeColor = escapeXml(badge.color.startsWith("#") ? badge.color : `#${badge.color}`);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="28" role="img" aria-label="${safeAria}">
  <title>${safeAria}</title>
  <g shape-rendering="crispEdges">
    <rect width="${leftWidth}" height="28" fill="#555555"/>
    <rect x="${leftWidth}" width="${rightWidth}" height="28" fill="${safeColor}"/>
  </g>
  <g transform="translate(${iconLeftPad},7) scale(0.875)" fill="#ffffff">
    <path fill-rule="evenodd" d="${GITHUB_OCTOCAT_PATH}"/>
  </g>
  <g fill="#ffffff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="100">
    <text x="${labelCenterX}" y="175" transform="scale(.1)" fill="#ffffff" textLength="${labelTextLen}">${safeLabel}</text>
    <text x="${valueCenterX}" y="175" transform="scale(.1)" fill="#ffffff" font-weight="bold" textLength="${valueTextLen}">${safeValue}</text>
  </g>
</svg>`;
}
