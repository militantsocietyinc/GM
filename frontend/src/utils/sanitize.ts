const ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch] || ch);
}

export function escapeAttr(str: string): string {
  return str.replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch] || ch);
}

const SAFE_URL_PATTERN = /^(?:https?|mailto):/i;

export function sanitizeUrl(url: string): string {
  if (SAFE_URL_PATTERN.test(url)) return url;
  return "#";
}
