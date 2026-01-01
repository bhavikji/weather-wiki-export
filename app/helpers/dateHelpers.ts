import moment from "moment";
import { toNum } from "@/app/helpers/computeHelpers";
import { OpenMeteoRow } from "@/app/types/open-meteo.type";

export function isIsoDate(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export function cmpIso(a: string, b: string) {
  // YYYY-MM-DD strings compare lexicographically
  return a.localeCompare(b);
}

function fmtIsoToPrettyDate(isoDate: string, timezone: string): string | null {
  const m = moment.tz(isoDate, "YYYY-MM-DD", true, timezone);
  return m.isValid() ? m.format("Do MMM YYYY") : null;
}

export function pickMaxWithDate(args: {
  rows: OpenMeteoRow[]; // rows include [isoDate, ...daily vars]
  timezone: string;
  idx: number | null; // index in DAILY_VARS (aligned after slice(1))
  requirePositive?: boolean;
}): { value: number | null; date: string | null } {
  const { rows, timezone, idx, requirePositive } = args;
  if (idx == null) return { value: null, date: null };

  let bestVal: number | null = null;
  let bestDate: string | null = null;

  for (const r of rows) {
    const iso = String(r?.[0] ?? "").trim();
    if (!iso) continue;

    const vals = r.slice(1);
    const n = toNum(vals[idx]);
    if (n == null) continue;
    if (requirePositive && !(n > 0)) continue;

    if (bestVal == null || n > bestVal) {
      bestVal = n;
      bestDate = fmtIsoToPrettyDate(iso, timezone);
      continue;
    }

    // deterministic tie-break: earliest date
    if (n === bestVal && bestDate) {
      const cand = fmtIsoToPrettyDate(iso, timezone);
      if (
        cand &&
        moment(cand, "Do MMM YYYY").isBefore(moment(bestDate, "Do MMM YYYY"))
      ) {
        bestDate = cand;
      }
    }
  }

  return { value: bestVal, date: bestDate };
}

export function pickMinWithDate(args: {
  rows: OpenMeteoRow[];
  timezone: string;
  idx: number | null;
}): { value: number | null; date: string | null } {
  const { rows, timezone, idx } = args;
  if (idx == null) return { value: null, date: null };

  let bestVal: number | null = null;
  let bestDate: string | null = null;

  for (const r of rows) {
    const iso = String(r?.[0] ?? "").trim();
    if (!iso) continue;

    const vals = r.slice(1);
    const n = toNum(vals[idx]);
    if (n == null) continue;

    if (bestVal == null || n < bestVal) {
      bestVal = n;
      bestDate = fmtIsoToPrettyDate(iso, timezone);
      continue;
    }

    // deterministic tie-break: earliest date
    if (n === bestVal && bestDate) {
      const cand = fmtIsoToPrettyDate(iso, timezone);
      if (
        cand &&
        moment(cand, "Do MMM YYYY").isBefore(moment(bestDate, "Do MMM YYYY"))
      ) {
        bestDate = cand;
      }
    }
  }

  return { value: bestVal, date: bestDate };
}

export const toHoursFromSeconds = (v: number | null): number | null => {
  if (v == null) return null;
  return Math.round((v / 3600) * 100) / 100;
};

export const timeToHHmm = (v: string | null): string | null => {
  if (!v) return null;
  const s = String(v).trim();
  const idx = s.indexOf("T");
  if (idx === -1) return s;
  return s.slice(idx + 1);
};
