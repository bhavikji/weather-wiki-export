export type NavKey = "daily" | "imd" | "climatology" | "template" | "export";

export type NavItem = {
  key: NavKey;
  label: string;
  href: string;
  badge?: string;
  description: string;
};

export const NAV: readonly NavItem[] = [
  {
    key: "daily",
    label: "Daily Weather Record",
    href: "/",
    description: "Fetch daily records by Lat/Long, Sheet ID, date range.",
  },
  {
    key: "imd",
    label: "Daily Weather Record (IMD)",
    href: "/imd",
    badge: "TBD",
    description: "IMD-based daily records (work in progress).",
  },
  {
    key: "climatology",
    label: "Generate Climatology Data",
    href: "/climatology",
    description: "Compute climatology by Sheet ID and year range.",
  },
  {
    key: "template",
    label: "Create Sheet Template",
    href: "/template",
    description: "Generate a full-year template for a selected city/year.",
  },
  {
    key: "export",
    label: "Export Bulk Records",
    href: "/export",
    description: "Export bulk records (month/year) in one go.",
  },
] as const;

export const KEY_TO_ITEM: Readonly<Record<NavKey, NavItem>> = {
  daily: NAV[0],
  imd: NAV[1],
  climatology: NAV[2],
  template: NAV[3],
  export: NAV[4],
} as const;

/**
 * Exact pathname matches (fast path).
 * Keep only "root" pages here. Nested handled by prefix checks.
 */
export const PATH_TO_KEY: Readonly<Record<string, NavKey>> = {
  "/": "daily",
  "/imd": "imd",
  "/climatology": "climatology",
  "/template": "template",
  "/export": "export",
} as const;

/**
 * Strict, O(1) routing resolution:
 * - exact match lookup
 * - small fixed prefix checks for nested routes
 */
export function getActiveKey(pathname: string | null | undefined): NavKey {
  const p = pathname || "/";

  const exact = PATH_TO_KEY[p];
  if (exact) return exact;

  // Prefix checks (fixed count => O(1))
  // Order matters: more specific first if you ever add overlaps.
  if (p.startsWith("/climatology")) return "climatology";
  if (p.startsWith("/template")) return "template";
  if (p.startsWith("/export")) return "export";
  if (p.startsWith("/imd")) return "imd";

  return "daily";
}

export const INPUT_HINT: Readonly<Record<NavKey, string>> = {
  daily: "Inputs: Lat/Long, Sheet ID, Start/End Date",
  imd: "Inputs: TBD",
  climatology: "Inputs: Sheet ID, Start/End Year",
  template: "Inputs: Sheet ID, Year (no range)",
  export: "Inputs: Sheet ID, Month/Year options",
} as const;
