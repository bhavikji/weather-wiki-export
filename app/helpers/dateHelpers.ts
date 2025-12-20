export function isIsoDate(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export function cmpIso(a: string, b: string) {
  // YYYY-MM-DD strings compare lexicographically
  return a.localeCompare(b);
}
