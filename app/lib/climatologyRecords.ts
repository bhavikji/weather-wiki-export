// app/lib/climatologyRecords.ts
import moment from "moment-timezone";
import { DAILY_VARS } from "@/app/lib/openMeteo";
import type {
  DailyRecordPoint,
  MonthlyDailyRecordBucket,
  MonthlyDailyRecordsByMonth,
} from "@/app/types/climatology-records.types";
import type { DailyVar, OpenMeteoRow } from "@/app/types/open-meteo.type";

function asFiniteNumber(x: unknown): number | null {
  const n = typeof x === "number" ? x : Number(String(x ?? "").trim());
  return Number.isFinite(n) ? n : null;
}

function getMonthIdxFromIso(isoDate: string, timezone: string): number | null {
  const m = moment.tz(isoDate, "YYYY-MM-DD", true, timezone);
  return m.isValid() ? m.month() + 1 : null; // 1..12
}

// Guard: avoid indexOf(...) = -1 bugs when DAILY_VARS changes
function idxOfDailyVar(v: DailyVar | string): number | null {
  const i = DAILY_VARS.indexOf(v as DailyVar);
  return i >= 0 ? i : null;
}

function ensureBucket(
  acc: MonthlyDailyRecordsByMonth,
  monthIdx: number
): MonthlyDailyRecordBucket {
  const existing = acc[monthIdx];
  if (existing) return existing;

  const created: MonthlyDailyRecordBucket = {
    tmax: [],
    tmin: [],
    precip: [],
    snow: [],
  };

  acc[monthIdx] = created;
  return created;
}

function pushIfFinite(
  arr: DailyRecordPoint[],
  value: number | null,
  isoDate: string
) {
  if (value == null) return;
  arr.push({ value, isoDate });
}

/**
 * Accumulates daily points for record detection in climatology tables.
 * Record strictness + "ignore zero" are applied in climatology.ts pickers.
 */
export function accumulateMonthlyDailyRecords(args: {
  rawRows: OpenMeteoRow[];
  timezone: string;
  existing?: MonthlyDailyRecordsByMonth;
}): MonthlyDailyRecordsByMonth {
  const { rawRows, timezone, existing } = args;
  const acc: MonthlyDailyRecordsByMonth = existing ?? {};

  const idxTmax = idxOfDailyVar("temperature_2m_max");
  const idxTmin = idxOfDailyVar("temperature_2m_min");
  const idxPrecip = idxOfDailyVar("precipitation_sum");
  const idxSnow = idxOfDailyVar("snowfall_sum");

  for (const r of rawRows) {
    const isoDate = String(r?.[0] ?? "").trim();
    if (!isoDate) continue;

    const monthIdx = getMonthIdxFromIso(isoDate, timezone);
    if (!monthIdx) continue;

    const bucket = ensureBucket(acc, monthIdx);
    const vals = r.slice(1); // aligns with DAILY_VARS

    if (idxTmax != null)
      pushIfFinite(bucket.tmax, asFiniteNumber(vals[idxTmax]), isoDate);

    if (idxTmin != null)
      pushIfFinite(bucket.tmin, asFiniteNumber(vals[idxTmin]), isoDate);

    if (idxPrecip != null)
      pushIfFinite(bucket.precip, asFiniteNumber(vals[idxPrecip]), isoDate);

    if (idxSnow != null)
      pushIfFinite(bucket.snow, asFiniteNumber(vals[idxSnow]), isoDate);
  }

  return acc;
}
