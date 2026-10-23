/**
 * Only allow same-site relative paths after login. Anything else
 * (absolute URLs, protocol-relative "//evil.com", "/\evil.com") falls back to `fallback`.
 */
export function safeNextPath(next: string | null | undefined, fallback = "/"): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
