// app/lib/logger.ts
export type LogLevel = "debug" | "info" | "warn" | "error";

export function safeJsonStringify(v: unknown, maxLen = 8000) {
  try {
    const s = JSON.stringify(v);
    if (s.length <= maxLen) return s;
    return s.slice(0, maxLen) + `...<truncated ${s.length - maxLen} chars>`;
  } catch {
    return "[unstringifiable]";
  }
}

function nowIso() {
  return new Date().toISOString();
}

export function createLogger(scope: string) {
  const envLevel = (process.env.LOG_LEVEL || "info").toLowerCase() as LogLevel;

  const order: Record<LogLevel, number> = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
  };

  const enabled = (lvl: LogLevel) => order[lvl] >= order[envLevel];

  const log =
    (lvl: LogLevel) => (msg: string, meta?: Record<string, unknown>) => {
      if (!enabled(lvl)) return;

      const base = `[${nowIso()}] [${lvl.toUpperCase()}] [${scope}] ${msg}`;
      if (!meta || Object.keys(meta).length === 0) {
        // eslint-disable-next-line no-console
        console[lvl === "debug" ? "log" : lvl](base);
        return;
      }

      // eslint-disable-next-line no-console
      console[lvl === "debug" ? "log" : lvl](
        `${base} :: ${safeJsonStringify(meta)}`
      );
    };

  return {
    debug: log("debug"),
    info: log("info"),
    warn: log("warn"),
    error: log("error"),
  };
}

export const daySuffix = (d: number) => {
  // 1st, 2nd, 3rd, 4th...
  const mod10 = d % 10;
  const mod100 = d % 100;
  if (mod100 >= 11 && mod100 <= 13) return "th";
  if (mod10 === 1) return "st";
  if (mod10 === 2) return "nd";
  if (mod10 === 3) return "rd";
  return "th";
};

export const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export const isoToSheetDateLabel = (isoDate: string) => {
  // isoDate is YYYY-MM-DD validated already
  const y = Number(isoDate.slice(0, 4));
  const m = Number(isoDate.slice(5, 7)); // 1..12
  const d = Number(isoDate.slice(8, 10)); // 1..31

  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d))
    return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;

  const mon = MONTHS_SHORT[m - 1];
  return `${d}${daySuffix(d)} ${mon} ${y}`; // e.g., 31st Dec 2025
};

export const normalizeCellDate = (s: unknown) => {
  // Normalize for robust matching:
  // - trim
  // - collapse whitespace
  // - lower-case
  return String(s ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
};

export const colToA1 = (col1Based: number) => {
  let n = col1Based;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

export const formatHumidity = (v: unknown): string | null => {
  if (v == null) return null;
  const s = String(v).trim();
  if (s === "" || s.toLowerCase() === "na" || s.toLowerCase() === "null")
    return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  // If value looks like a fraction 0..1, convert to 0..100
  const pct = n >= 0 && n <= 1 ? n * 100 : n;
  return pct.toFixed(2) + "%";
};

import moment from "moment-timezone";

/**
 * Normalize various time string formats to 12-hour format with AM/PM, e.g. "06:02 AM".
 * Accepts IMD 'HH:mm' (24-hour), Open-Meteo ISO datetimes (with 'T' and optional offset),
 * or already-formatted times. Returns null when input cannot be parsed.
 */
export const formatTimeTo12h = (
  v: unknown,
  timezone = "Asia/Kolkata"
): string | null => {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;

  // If ISO datetime or contains 'T', parse with timezone
  if (s.includes("T")) {
    const m = moment.tz(s, timezone);
    if (m.isValid()) return m.format("hh:mm A");
  }

  // Try parsing with common time formats (24h and 12h)
  const m2 = moment(
    s,
    ["H:mm", "HH:mm", "H:mm:ss", "HH:mm:ss", "h:mm A", "hh:mm A"],
    true
  );
  if (m2.isValid()) return m2.format("hh:mm A");

  // As a last resort, try a lax parse
  const m3 = moment(s);
  if (m3.isValid()) return m3.format("hh:mm A");

  return null;
};
