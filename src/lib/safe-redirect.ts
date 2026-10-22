/**
 * Only allow same-site relative paths after login. Anything else
 * (absolute URLs, protocol-relative "//evil.com", "/\evil.com") falls back to "/".
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next) return "/";
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}
