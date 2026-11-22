export function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export const NO_CACHE_HEADERS: Record<string, string> = {
  "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
  "CDN-Cache-Control": "no-store",
  Pragma: "no-cache",
  Expires: "0",
};

export function svgResponse(svg: string, status = 200): Response {
  return new Response(svg, {
    status,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      ...NO_CACHE_HEADERS,
    },
  });
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      ...NO_CACHE_HEADERS,
    },
  });
}

export function renderErrorCard(title: string, detail: string): string {
  const safeTitle = escapeXml(title);
  const safeDetail = escapeXml(detail.slice(0, 72));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="380" height="120" viewBox="0 0 380 120" role="img" aria-label="${safeTitle}">
  <rect x="1" y="1" rx="5" ry="5" width="378" height="118" fill="#282a36" stroke="#ff5555" stroke-width="1"/>
  <text x="24" y="44" fill="#ff5555" font-family="'Segoe UI', Ubuntu, Sans-Serif" font-size="16" font-weight="700">${safeTitle}</text>
  <text x="24" y="74" fill="#f8f8f2" font-family="'Segoe UI', Ubuntu, Sans-Serif" font-size="12.5">${safeDetail}</text>
</svg>`;
}
