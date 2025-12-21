// app/lib/monthlyAggregates.ts
import moment from "moment-timezone";
import type { sheets_v4 } from "googleapis";
import type { OpenMeteoRow } from "@/app/types/open-meteo.type";
import type { MonthlyAggregateRow } from "@/app/types/monthly-aggregates.types";
import { idxOfDailyVar, round2, toNum } from "@/app/helpers/computeHelpers";
import { THRESHOLDS } from "@/app/lib/thresholds";
import { pickMaxWithDate, pickMinWithDate } from "@/app/helpers/dateHelpers";

// ---------- main builder ----------
/**
 * Monthly Aggregates columns (MUST match sheet header written in route.ts):
 * A Year
 * B Month
 * C Mean Tmax (°C)
 * D Mean Tmin (°C)
 * E Mean Dew Point (°C)
 * F Mean Relative Humidity (%)
 * G Total Rainfall (mm)
 * H Rainy Days (≥2.5 mm)
 * I Total Snowfall (cm)
 * J Snowy Days (≥0.254 cm)
 * K Total Precipitation (mm)
 * L Wet Days (≥0.1 mm)
 * M Total Sunshine (hours)
 * N Percent Possible Sunshine (%)  (0..1 stored)
 * O Valid Days
 * P Record High Tmax (°C)
 * Q Record High Tmax Date
 * R Record Low Tmin (°C)
 * S Record Low Tmin Date
 * T Record Max 24h Rainfall (mm)
 * U Record Max 24h Rainfall Date
 * V Record Max 24h Snow (cm)
 * W Record Max 24h Snow Date
 * X Record Max 24h Precipitation (mm)
 * Y Record Max 24h Precipitation Date
 */
export function buildMonthlyAggregates(
  year: number,
  rawRows: OpenMeteoRow[],
  timezone: string
): MonthlyAggregateRow[] {
  // Bucket daily rows by month (1..12)
  const buckets = new Map<number, OpenMeteoRow[]>();

  for (const r of rawRows) {
    const iso = String(r?.[0] ?? "");
    const m = Number(iso.slice(5, 7)); // 01..12
    if (!Number.isFinite(m) || m < 1 || m > 12) continue;

    const arr = buckets.get(m) ?? [];
    arr.push(r);
    buckets.set(m, arr);
  }

  const out: MonthlyAggregateRow[] = [];

  // Cache indexes once (vals[i] aligns with DAILY_VARS[i])
  const idxTmax = idxOfDailyVar("temperature_2m_max");
  const idxTmin = idxOfDailyVar("temperature_2m_min");
  const idxTmean = idxOfDailyVar("temperature_2m_mean");
  const idxDew = idxOfDailyVar("dew_point_2m_mean");
  const idxRh = idxOfDailyVar("relative_humidity_2m_mean");

  const idxPrecip = idxOfDailyVar("precipitation_sum");
  const idxRain = idxOfDailyVar("rain_sum");

  const idxSunSec = idxOfDailyVar("sunshine_duration");
  const idxDaySec = idxOfDailyVar("daylight_duration");
  const idxSnowfall = idxOfDailyVar("snowfall_sum");

  // Helpers that compute validity based on non-null numeric cells
  const countValidAt = (vals: unknown[][], i: number | null): number => {
    if (i == null) return 0;
    let c = 0;
    for (const v of vals) {
      const n = toNum(v[i]);
      if (n != null) c++;
    }
    return c;
  };

  const meanAt = (vals: unknown[][], i: number | null): number | null => {
    if (i == null) return null;
    const nums = vals
      .map((v) => toNum(v[i]))
      .filter((n): n is number => n != null);
    if (!nums.length) return null;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
  };

  const sumAt = (vals: unknown[][], i: number | null): number | null => {
    if (i == null) return null;
    const nums = vals
      .map((v) => toNum(v[i]))
      .filter((n): n is number => n != null);
    if (!nums.length) return null;
    return nums.reduce((a, b) => a + b, 0);
  };

  // Ensure deterministic month order (Jan..Dec)
  for (let month = 1; month <= 12; month++) {
    const rows = buckets.get(month) ?? [];
    if (!rows.length) continue;

    // Remove the date column: vals[i] aligns with DAILY_VARS[i]
    const vals = rows.map((r) => r.slice(1));

    // ✅ Valid days should reflect how many days actually have core values
    // Choose precipitation_sum as the most robust "core" daily numeric signal,
    // else fallback to temperature_2m_max, else fallback to row count.
    const validDays =
      idxPrecip != null
        ? countValidAt(vals, idxPrecip)
        : idxTmax != null
        ? countValidAt(vals, idxTmax)
        : rows.length;

    // Rainy days (>= configured threshold in mm)
    const rainyDays =
      idxRain == null
        ? 0
        : vals.filter((v) => {
            const n = toNum(v[idxRain]);
            return n != null && n >= THRESHOLDS.RAIN_MM;
          }).length;

    // Sunshine totals (seconds -> hours)
    const sunshineSeconds = sumAt(vals, idxSunSec);
    const sunshineHours =
      sunshineSeconds != null ? sunshineSeconds / 3600 : null;

    // Daylight totals (seconds)
    const daylightSeconds = sumAt(vals, idxDaySec);

    // ✅ Percent possible sunshine as fraction (0..1) for Sheets % format
    // NOTE: This is the key fix for "Mean Percent Possible Sunshine (%)" being empty downstream.
    const possibleSunshineFrac =
      sunshineSeconds != null && daylightSeconds != null && daylightSeconds > 0
        ? sunshineSeconds / daylightSeconds
        : null;

    // Totals
    const totalRainfallMm = sumAt(vals, idxRain);
    const totalPrecipMm = sumAt(vals, idxPrecip);
    const totalSnowfallCm = sumAt(vals, idxSnowfall);

    // Snowy days (>= configured threshold in cm)
    const snowyDays =
      idxSnowfall == null
        ? 0
        : vals.filter((v) => {
            const n = toNum(v[idxSnowfall]);
            return n != null && n >= THRESHOLDS.SNOW_CM;
          }).length;

    // Wet days (precipitation >= PRECIP_MM)
    const wetDays =
      idxPrecip == null
        ? 0
        : vals.filter((v) => {
            const n = toNum(v[idxPrecip]);
            return n != null && n >= THRESHOLDS.PRECIP_MM;
          }).length;

    // Means
    const meanTmax = meanAt(vals, idxTmax);
    const meanTmin = meanAt(vals, idxTmin);
    const meanTmean = meanAt(vals, idxTmean);
    const meanDew = meanAt(vals, idxDew);
    const meanRh = meanAt(vals, idxRh);

    // Record Extremes

    const recHighTmax = pickMaxWithDate({
      rows,
      timezone,
      idx: idxTmax,
    });

    const recLowTmin = pickMinWithDate({
      rows,
      timezone,
      idx: idxTmin,
    });

    const recMaxRain = pickMaxWithDate({
      rows,
      timezone,
      idx: idxRain,
      requirePositive: true,
    });

    const recMaxSnow = pickMaxWithDate({
      rows,
      timezone,
      idx: idxSnowfall,
      requirePositive: true,
    });

    const recMaxPrecip = pickMaxWithDate({
      rows,
      timezone,
      idx: idxPrecip,
      requirePositive: true,
    });

    out.push([
      year,
      moment
        .tz(`${year}-${String(month).padStart(2, "0")}-01`, timezone)
        .format("MMMM"),

      round2(meanTmax),
      round2(meanTmin),
      // Mean Temperature (°C)
      round2(meanTmean),

      // Mean Dew Point (°C)
      round2(meanDew),

      // Mean RH (%) (Open-Meteo gives %; keep numeric as-is)
      round2(meanRh),

      // Total Rainfall (mm)
      round2(totalRainfallMm),

      // Rainy Days
      rainyDays,

      // Total Snowfall (cm)
      round2(totalSnowfallCm),

      // Snowy Days
      snowyDays,

      // Total Precipitation (mm)
      round2(totalPrecipMm),

      // Wet Days
      wetDays,

      // Total Sunshine (hours)
      round2(sunshineHours),

      // Percent Possible Sunshine (0..1)
      round2(possibleSunshineFrac),

      // Valid Days
      validDays,
      round2(recHighTmax.value),
      recHighTmax.date,
      round2(recLowTmin.value),
      recLowTmin.date,
      round2(recMaxRain.value),
      recMaxRain.date,
      round2(recMaxSnow.value),
      recMaxSnow.date,
      round2(recMaxPrecip.value),
      recMaxPrecip.date,
    ] as unknown as MonthlyAggregateRow);
  }

  return out;
}

// --------------------------
// De-dupe helpers (Year + Month)
// --------------------------
export function monthlyAggKey(year: number, monthName: string): string {
  return `${year}|${monthName.trim().toLowerCase()}`;
}

function normalizeMonthName(x: unknown): string {
  return String(x ?? "").trim();
}

function asInt(x: unknown): number | null {
  const n = typeof x === "number" ? x : Number(String(x ?? "").trim());
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export async function getMonthlyAggExistingKeys(args: {
  sheets: sheets_v4.Sheets;
  spreadsheetId: string;
  sheetName: string; // "Monthly Aggregates"
}): Promise<Set<string>> {
  const { sheets, spreadsheetId, sheetName } = args;

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A4:B`,
  });

  const values = (res.data.values ?? []) as unknown[][];
  const keys = new Set<string>();

  for (const row of values) {
    const y = asInt(row?.[0]);
    const m = normalizeMonthName(row?.[1]);
    if (!y || !m) continue;
    keys.add(monthlyAggKey(y, m));
  }

  return keys;
}

export function filterOutExistingMonthlyAgg(args: {
  rows: MonthlyAggregateRow[];
  existingKeys: Set<string>;
}): MonthlyAggregateRow[] {
  const { rows, existingKeys } = args;
  return rows.filter((r) => !existingKeys.has(monthlyAggKey(r[0], r[1])));
}
