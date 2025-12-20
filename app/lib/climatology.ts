// app/lib/climatology.ts
import moment from "moment-timezone";
import type { sheets_v4 } from "googleapis";
import {
  asNum,
  max,
  mean,
  min,
  round2,
  sum,
} from "@/app/helpers/computeHelpers";
import { COLOR_MEAN_ROW } from "@/app/lib/sheetsFormatting";
import type { MonthlyDailyRecordsByMonth } from "@/app/types/climatology-records.types";
import type {
  ClimoMonthRow,
  DailyRecord,
  ExistingMonthlyRecords,
  RecordPair,
  YearMonthAgg,
} from "@/app/types/climatology.types";

export const MONTHLY_AGG_SHEET = "Monthly Aggregates";
export const CLIMO_MASTER_SHEET = "Climatology Master";
export const DEFAULT_BASE_START = 1961;
export const DEFAULT_WINDOW_YEARS = 30;
export const DEFAULT_STEP_YEARS = 30;

/**
 * Monthly Aggregates columns:
 * A Year
 * B Month
 * C Mean Tmax
 * D Mean Tmin
 * E Mean Dew Point
 * F Mean RH
 * G Total Precip
 * H Rainy Days
 * I Total Sunshine (hours)
 * J Percent Possible Sunshine (0..1)
 * K Valid Days
 */

export function monthIndexFromName(
  monthName: string,
  tz: string
): number | null {
  const m = moment.tz(`2000-${monthName}-01`, "YYYY-MMMM-DD", true, tz);
  return m.isValid() ? m.month() + 1 : null;
}

export function monthNameFromIndex(idx: number, tz: string): string {
  return moment
    .tz(`2000-${String(idx).padStart(2, "0")}-01`, "YYYY-MM-DD", true, tz)
    .format("MMMM");
}

export function computeAvailableYearRange(records: YearMonthAgg[]) {
  const ys = records.map((r) => r.year);
  if (!ys.length) return null;
  return { minYear: Math.min(...ys), maxYear: Math.max(...ys) };
}

export function buildWindows(args: {
  minYear: number;
  maxYear: number;
  baseStartYear: number;
  windowYears: number;
  stepYears: number;
}): Array<{ start: number; end: number }> {
  const { minYear, maxYear, baseStartYear, windowYears, stepYears } = args;

  const out: Array<{ start: number; end: number }> = [];
  let k = Math.ceil((minYear - baseStartYear) / stepYears);
  if (!Number.isFinite(k)) k = 0;

  for (;;) {
    const start = baseStartYear + k * stepYears;
    const end = start + (windowYears - 1);

    if (start > maxYear) break;
    if (end <= maxYear) out.push({ start, end });

    k++;
    if (out.length > 50) break;
  }

  return out;
}

// --------------------------
// Daily record helpers
// --------------------------

function yearFromIso(isoDate: string): number | null {
  const y = Number(String(isoDate ?? "").slice(0, 4));
  return Number.isFinite(y) ? y : null;
}

function fmtRecordDate(isoDate: string, tz: string): string {
  return moment.tz(isoDate, "YYYY-MM-DD", true, tz).format("Do MMM YYYY");
}

function pickMaxStrict(args: {
  recs?: DailyRecord[];
  tz: string;
  startYear?: number;
  endYear?: number;
  requirePositive?: boolean;
}): RecordPair {
  const { recs, tz, startYear, endYear, requirePositive } = args;
  if (!recs?.length) return [null, null];

  let best: DailyRecord | null = null;

  for (const r of recs) {
    if (!Number.isFinite(r?.value)) continue;
    if (requirePositive && !(r.value > 0)) continue;

    const y = yearFromIso(r.isoDate);
    if (startYear != null && y != null && y < startYear) continue;
    if (endYear != null && y != null && y > endYear) continue;

    if (!best || r.value > best.value) best = r;
  }

  return best
    ? [round2(best.value), fmtRecordDate(best.isoDate, tz)]
    : [null, null];
}

function pickMinStrict(args: {
  recs?: DailyRecord[];
  tz: string;
  startYear?: number;
  endYear?: number;
}): RecordPair {
  const { recs, tz, startYear, endYear } = args;
  if (!recs?.length) return [null, null];

  let best: DailyRecord | null = null;

  for (const r of recs) {
    if (!Number.isFinite(r?.value)) continue;

    const y = yearFromIso(r.isoDate);
    if (startYear != null && y != null && y < startYear) continue;
    if (endYear != null && y != null && y > endYear) continue;

    if (!best || r.value < best.value) best = r;
  }

  return best
    ? [round2(best.value), fmtRecordDate(best.isoDate, tz)]
    : [null, null];
}

function getMonthlyRecordBundle(args: {
  dailyRecordsByMonth?: MonthlyDailyRecordsByMonth;
  monthIdx: number;
  timezone: string;
  startYear?: number;
  endYear?: number;
}): {
  recHighTmax: RecordPair;
  recLowTmin: RecordPair;
  recMaxPrecip: RecordPair;
  recMaxSnow: RecordPair;
} {
  const { dailyRecordsByMonth, monthIdx, timezone, startYear, endYear } = args;
  const m = dailyRecordsByMonth?.[monthIdx];

  const recHighTmax = pickMaxStrict({
    recs: m?.tmax,
    tz: timezone,
    startYear,
    endYear,
  });

  const recLowTmin = pickMinStrict({
    recs: m?.tmin,
    tz: timezone,
    startYear,
    endYear,
  });

  const recMaxPrecip = pickMaxStrict({
    recs: m?.precip,
    tz: timezone,
    startYear,
    endYear,
    requirePositive: true,
  });

  const recMaxSnow = pickMaxStrict({
    recs: m?.snow,
    tz: timezone,
    startYear,
    endYear,
    requirePositive: true,
  });

  return { recHighTmax, recLowTmin, recMaxPrecip, recMaxSnow };
}

// --------------------------
// Wettest monthly total year helper
// --------------------------

function pickYearOfMaxMonthlyTotal(args: {
  bucket: YearMonthAgg[];
}): number | null {
  const { bucket } = args;
  if (!bucket?.length) return null;

  let bestVal: number | null = null;
  let bestYear: number | null = null;

  for (const r of bucket) {
    const p = r?.precip;
    if (p == null || !Number.isFinite(p)) continue;

    if (bestVal == null || p > bestVal) {
      bestVal = p;
      bestYear = r.year;
      continue;
    }

    // deterministic tie-break: earliest year
    if (p === bestVal && bestYear != null && r.year < bestYear) {
      bestYear = r.year;
    }
  }

  return bestYear;
}

// --------------------------
// Persisted record merge (strictly broken only)
// --------------------------

function mergeMax(existing: RecordPair, incoming: RecordPair): RecordPair {
  const [eVal, eDate] = existing;
  const [iVal, iDate] = incoming;

  if (iVal == null) return [eVal ?? null, eDate ?? null];
  if (eVal == null) return [iVal, iDate];

  // If values differ, choose the larger (max) as before
  if (iVal > eVal) return [iVal, iDate];
  if (iVal < eVal) return [eVal, eDate];

  // Tie-breaker when values equal: prefer the incoming date if it appears
  // more complete than the existing one. Historically some sheets stored
  // only the year (e.g. "2001") which is less precise than a full
  // formatted date (e.g. "4th Jan 2001"). Detect year-only strings and
  // prefer the incoming non-year-only date when available.
  const looksLikeYearOnly = (d: unknown) =>
    typeof d === "string" && /^\s*\d{4}\s*$/.test(d);

  if (iDate != null && (!eDate || looksLikeYearOnly(eDate)))
    return [iVal, iDate];

  return [eVal, eDate];
}

function mergeMin(existing: RecordPair, incoming: RecordPair): RecordPair {
  const [eVal, eDate] = existing;
  const [iVal, iDate] = incoming;

  if (iVal == null) return [eVal ?? null, eDate ?? null];
  if (eVal == null) return [iVal, iDate];

  // If values differ, choose the smaller (min) as before
  if (iVal < eVal) return [iVal, iDate];
  if (iVal > eVal) return [eVal, eDate];

  // Tie-breaker when values equal: prefer incoming date if it's more
  // complete (not just a 4-digit year).
  const looksLikeYearOnly = (d: unknown) =>
    typeof d === "string" && /^\s*\d{4}\s*$/.test(d);

  if (iDate != null && (!eDate || looksLikeYearOnly(eDate)))
    return [iVal, iDate];

  return [eVal, eDate];
}

function mergeMonthlyRecordsStrict(
  existing: ExistingMonthlyRecords | null,
  incoming: ExistingMonthlyRecords
) {
  if (!existing) return incoming;

  return {
    recHighTmax: mergeMax(existing.recHighTmax, incoming.recHighTmax),
    recLowTmin: mergeMin(existing.recLowTmin, incoming.recLowTmin),
    recMaxPrecip: mergeMax(existing.recMaxPrecip, incoming.recMaxPrecip),
    recMaxSnow: mergeMax(existing.recMaxSnow, incoming.recMaxSnow),
  } as ExistingMonthlyRecords;
}

// Percent parser: accepts numbers (0..1), whole percentages (12 -> 0.12),
// or strings like "12%" and returns a normalized fraction 0..1 or null.
function parsePercent(x: unknown): number | null {
  if (x == null) return null;
  if (typeof x === "string") {
    const s = x.trim();
    if (s.endsWith("%")) {
      const raw = s.slice(0, -1).replace(/,/g, "");
      const n = Number(raw);
      return Number.isFinite(n) ? n / 100 : null;
    }
    // Fallthrough to numeric parse
    const n = Number(s.replace(/,/g, ""));
    if (Number.isFinite(n)) return n > 1 && n <= 100 ? n / 100 : n;
    return null;
  }
  const n = asNum(x);
  if (n == null) return null;
  return n > 1 && n <= 100 ? n / 100 : n;
}

async function readExistingClimoRecords(args: {
  sheets: sheets_v4.Sheets;
  spreadsheetId: string;
  timezone: string;
}): Promise<Partial<Record<number, ExistingMonthlyRecords>>> {
  const { sheets, spreadsheetId, timezone } = args;

  /**
   * Climatology Master columns (A..AA) = 27 cols:
   * A  Month                         idx 1
   * B  Mean Tmax (°C)                idx 2
   * C  Mean Tmin (°C)                idx 3
   * D  Mean Temp (°C)                idx 4
   * E  Mean Dew Point (°C)           idx 5
   * F  Mean Relative Humidity (%)    idx 6
   * G  Mean Rainfall (mm)            idx 7
   * H  Mean Rainy Days (days)        idx 8
   * I  Mean Snowfall (cm)            idx 9
   * J  Mean Snowy Days (days)        idx 10
   * K  Mean Monthly Precipitation (mm) idx 11
   * L  Mean Wet Days (days)          idx 12
   * M  Mean Sunshine (hours)        idx 13
   * N  Mean Percent Possible Sunshine (%)  (0..1 stored) idx 14
   * O  N (years)                     idx 15
   * P  Warmest Monthly Mean Tmax (°C)  idx 16
   * Q  Coldest Monthly Mean Tmin (°C)  idx 17
   * R  Wettest Monthly Total (mm)  idx 18
   * S  Wettest Monthly Total Year  idx 19
   * T  Record High Tmax (°C)        idx 20
   * U  Record High Tmax Date      idx 21
   * V  Record Low Tmin (°C)       idx 22
   * W  Record Low Tmin Date     idx 23
   * X  Record Max 24h Precipitation (mm) idx 24
   * Y  Record Max 24h Precipitation Date idx 25
   * Z  Record Max 24h Snow (mm)       idx 26
   * AA Record Max 24h Snow Date  idx 27
   */
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${CLIMO_MASTER_SHEET}!A4:AA15`,
  });

  const values = (res.data.values ?? []) as unknown[][];
  const out: Partial<Record<number, ExistingMonthlyRecords>> = {};

  for (const row of values) {
    const monthName = String(row?.[0] ?? "").trim();
    const mIdx = monthIndexFromName(monthName, timezone);
    if (!mIdx) continue;

    const existing: ExistingMonthlyRecords = {
      // NOTE: columns are 0-based here. Map to Climatology Master layout:
      // T (Record High Tmax) -> index 19, U (date) -> 20
      // V (Record Low Tmin)  -> index 21, W (date) -> 22
      // X (Record Max 24h Precip) -> index 23, Y (date) -> 24
      // Z (Record Max 24h Snow) -> index 25, AA (date) -> 26
      recHighTmax: [asNum(row?.[19]), row?.[20] ? String(row[20]) : null],
      recLowTmin: [asNum(row?.[21]), row?.[22] ? String(row[22]) : null],
      recMaxPrecip: [asNum(row?.[23]), row?.[24] ? String(row[24]) : null],
      recMaxSnow: [asNum(row?.[25]), row?.[26] ? String(row[26]) : null],
    };

    out[mIdx] = existing;
  }

  return out;
}

// --------------------------
// Window computations
// --------------------------

export function computeWindowClimo(args: {
  records: YearMonthAgg[];
  startYear: number;
  endYear: number;
  timezone: string;
  dailyRecordsByMonth?: MonthlyDailyRecordsByMonth;
}): { climoRows: ClimoMonthRow[]; annualRow: ClimoMonthRow } {
  const { records, startYear, endYear, timezone, dailyRecordsByMonth } = args;

  const window = records.filter(
    (r) => r.year >= startYear && r.year <= endYear
  );

  const monthBuckets = new Map<number, YearMonthAgg[]>();
  for (const v of window) {
    const arr = monthBuckets.get(v.monthIdx) ?? [];
    arr.push(v);
    monthBuckets.set(v.monthIdx, arr);
  }

  const climoRows: ClimoMonthRow[] = [];
  for (let m = 1; m <= 12; m++) {
    const bucket = monthBuckets.get(m) ?? [];

    const tmaxs = bucket.map((x) => x.tmax);
    const tmins = bucket.map((x) => x.tmin);
    const tmeans = bucket.map((x) => x.tmean);
    const dews = bucket.map(
      (x) => (x as YearMonthAgg & { dew?: number | null }).dew ?? null
    );
    const rhs = bucket.map((x) => x.rh);
    const precs = bucket.map((x) => x.precip);
    const rainy = bucket.map((x) => x.rainyDays);
    const rains = bucket.map(
      (x) => (x as YearMonthAgg & { rain?: number | null }).rain ?? null
    );
    const wetDaysArr = bucket.map(
      (x) => (x as YearMonthAgg & { wetDays?: number | null }).wetDays ?? null
    );
    const sun = bucket.map((x) => x.sunshine);

    // Percent possible sunshine stored as 0..1
    const sunPct = bucket.map(
      (x) =>
        (x as YearMonthAgg & { sunshinePct?: number | null }).sunshinePct ??
        null
    );
    const snowfalls = bucket.map(
      (x) => (x as YearMonthAgg & { snowfall?: number | null }).snowfall ?? null
    );
    const snowydays = bucket.map(
      (x) =>
        (x as YearMonthAgg & { snowyDays?: number | null }).snowyDays ?? null
    );
    console.log("sunPct", sunPct);
    const wettestYear = pickYearOfMaxMonthlyTotal({ bucket });

    const { recHighTmax, recLowTmin, recMaxPrecip, recMaxSnow } =
      getMonthlyRecordBundle({
        dailyRecordsByMonth,
        monthIdx: m,
        timezone,
        startYear,
        endYear,
      });

    // Climatology row order MUST match headers in writeWindowSheet/generateClimatologyMaster:
    // Month, Mean..., Mean Snowfall, Mean SnowyDays, Mean Sunshine, Mean %Sun, N, Warmest, Coldest, Wettest total, Wettest year, Records...
    climoRows.push([
      monthNameFromIndex(m, timezone),
      round2(mean(tmaxs)),
      round2(mean(tmins)),
      round2(mean(tmeans)),
      round2(mean(dews)),
      round2(mean(rhs)),
      // G Mean Rainfall (mm)
      round2(mean(rains)),
      // H Mean Rainy Days (days)
      round2(mean(rainy)),
      // I Mean Snowfall (cm)
      round2(mean(snowfalls)),
      // J Mean Snowy Days (days)
      round2(mean(snowydays)),
      // K Mean Monthly Precipitation (mm)
      round2(mean(precs)),
      // L Mean Wet Days (days)
      round2(mean(wetDaysArr)),
      // M Mean Sunshine (hours)
      round2(mean(sun)),
      // N Mean Percent Possible Sunshine (0..1)
      // Normalize percent-like values (whole percentages) before averaging.
      (() => {
        const mapped = sunPct.map((v) =>
          v == null ? null : v > 1 && v <= 100 ? v / 100 : v
        );
        return round2(mean(mapped as Array<number | null>));
      })(), // 0..1 -> format as PERCENT in sheet
      // O N (years)
      bucket.length || null,
      // P Warmest
      round2(max(tmaxs)),
      // Q Coldest
      round2(min(tmins)),
      // R Wettest Monthly Total
      round2(max(precs)),
      // S Wettest Monthly Total Year
      wettestYear,

      // Records
      recHighTmax[0],
      recHighTmax[1],
      recLowTmin[0],
      recLowTmin[1],
      recMaxPrecip[0],
      recMaxPrecip[1],
      recMaxSnow[0],
      recMaxSnow[1],
    ] as unknown as ClimoMonthRow);
  }

  const annualRow: ClimoMonthRow = [
    "Annual (from monthly means)",
    round2(mean(climoRows.map((r) => r[1]))), // B Mean Tmax
    round2(mean(climoRows.map((r) => r[2]))), // C Mean Tmin
    round2(mean(climoRows.map((r) => r[3]))), // D Mean Temp
    round2(mean(climoRows.map((r) => r[4]))), // E Mean Dew
    round2(mean(climoRows.map((r) => r[5]))), // F Mean RH
    round2(sum(climoRows.map((r) => r[6]))), // G Sum Mean Rainfall (annual total)
    round2(sum(climoRows.map((r) => r[7]))), // H Sum Mean Rainy Days
    round2(sum(climoRows.map((r) => r[8]))), // I Sum Mean Snowfall (annual total)
    round2(sum(climoRows.map((r) => r[9]))), // J Sum Mean Snowy Days (annual)
    round2(sum(climoRows.map((r) => r[10]))), // K Sum Mean Monthly Precipitation (annual total)
    round2(sum(climoRows.map((r) => r[11]))), // L Sum Mean Wet Days (annual total)
    round2(mean(climoRows.map((r) => r[12]))), // M Mean Sunshine
    round2(mean(climoRows.map((r) => r[13]))), // N Mean Percent Possible Sunshine (0..1)
    max(climoRows.map((r) => r[14])), // O N (years)
    round2(max(climoRows.map((r) => r[15]))), // P Warmest
    round2(min(climoRows.map((r) => r[16]))), // Q Coldest
    round2(max(climoRows.map((r) => r[17]))), // R Wettest Monthly Total
    null, // S Wettest year

    null,
    null, // T,U Record High Tmax + Date
    null,
    null, // V,W Record Low Tmin + Date
    null,
    null, // X,Y Record Max 24h Precip + Date
    null,
    null, // Z,AA Record Max 24h Snow + Date
  ] as unknown as ClimoMonthRow;

  return { climoRows, annualRow };
}

export async function writeWindowSheet(args: {
  sheets: sheets_v4.Sheets;
  spreadsheetId: string;
  title: string;
  timezone: string;
  startYear: number;
  endYear: number;
  climoRows: ClimoMonthRow[];
  annualRow: ClimoMonthRow;
  getOrCreateSheetId: (
    sheets: sheets_v4.Sheets,
    spreadsheetId: string,
    title: string
  ) => Promise<number>;
}) {
  const {
    sheets,
    spreadsheetId,
    title,
    timezone,
    startYear,
    endYear,
    climoRows,
    annualRow,
    getOrCreateSheetId,
  } = args;

  const tabId = await getOrCreateSheetId(sheets, spreadsheetId, title);
  const nowStr = moment.tz(timezone).format("Do MMM YYYY, hh:mm A");

  const values: (string | number | null)[][] = [
    [`${title} (computed from Monthly Aggregates)`],
    [
      "Period",
      `${startYear}-${endYear}`,
      "Timezone",
      timezone,
      "Last Updated",
      nowStr,
    ],
    [
      "Month",
      "Mean Tmax (°C)",
      "Mean Tmin (°C)",
      "Mean Temp (°C)",
      "Mean Dew Point (°C)",
      "Mean Relative Humidity (%)",
      "Mean Rainfall (mm)",
      "Mean Rainy Days (days)",
      "Mean Snowfall (cm)",
      "Mean Snowy Days (days)",
      "Mean Monthly Precipitation (mm)",
      "Mean Wet Days (days)",
      "Mean Sunshine (hours)",
      "Mean Percent Possible Sunshine (%)",
      "N (years)",
      "Warmest Monthly Mean Tmax (°C)",
      "Coldest Monthly Mean Tmin (°C)",
      "Wettest Monthly Total (mm)",
      "Wettest Monthly Total Year",
      "Record High Tmax (°C)",
      "Record High Tmax Date",
      "Record Low Tmin (°C)",
      "Record Low Tmin Date",
      "Record Max 24h Precipitation (mm)",
      "Record Max 24h Precipitation Date",
      "Record Max 24h Snow (mm)",
      "Record Max 24h Snow Date",
    ],
    ...(climoRows as unknown as (string | number | null)[][]),
    annualRow as unknown as (string | number | null)[],
  ];

  // A..AA now (27 columns)
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${title}!A:AA`,
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${title}!A1`,
    valueInputOption: "RAW",
    requestBody: { values },
  });

  const endRowIndex = values.length;
  const BIG_END_ROW = 200000;

  // Column indexes are 0-based for formatting ranges.
  // A0 Month
  // B1..I8 numeric 2-dec (except I is %)
  // J9 UV mean numeric 2-dec
  // K10 N integer
  // L11..N13 numeric 2-dec
  // O14 wettest year integer
  // P15 recHigh numeric, Q16 date, R17 numeric, S18 date, T19 numeric, U20 date, V21 numeric, W22 date, X23 numeric, Y24 date
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          updateSheetProperties: {
            properties: {
              sheetId: tabId,
              gridProperties: { frozenRowCount: 3 },
            },
            fields: "gridProperties.frozenRowCount",
          },
        },

        // Title row bold
        {
          repeatCell: {
            range: {
              sheetId: tabId,
              startRowIndex: 0,
              endRowIndex: 1,
              startColumnIndex: 0,
              endColumnIndex: 27,
            },
            cell: {
              userEnteredFormat: { textFormat: { bold: true, fontSize: 12 } },
            },
            fields: "userEnteredFormat.textFormat",
          },
        },

        // Header row bold
        {
          repeatCell: {
            range: {
              sheetId: tabId,
              startRowIndex: 2,
              endRowIndex: 3,
              startColumnIndex: 0,
              endColumnIndex: 27,
            },
            cell: { userEnteredFormat: { textFormat: { bold: true } } },
            fields: "userEnteredFormat.textFormat",
          },
        },

        // Data rows not bold
        {
          repeatCell: {
            range: {
              sheetId: tabId,
              startRowIndex: 3,
              endRowIndex: BIG_END_ROW,
              startColumnIndex: 0,
              endColumnIndex: 27,
            },
            cell: { userEnteredFormat: { textFormat: { bold: false } } },
            fields: "userEnteredFormat.textFormat",
          },
        },

        // B..M => 2 decimals (Mean Tmax .. Mean Sunshine)
        {
          repeatCell: {
            range: {
              sheetId: tabId,
              startRowIndex: 3,
              endRowIndex,
              startColumnIndex: 1,
              endColumnIndex: 13,
            },
            cell: {
              userEnteredFormat: {
                numberFormat: { type: "NUMBER", pattern: "0.00" },
              },
            },
            fields: "userEnteredFormat.numberFormat",
          },
        },

        // N => percent (Mean Percent Possible Sunshine) (0..1 stored)
        {
          repeatCell: {
            range: {
              sheetId: tabId,
              startRowIndex: 3,
              endRowIndex,
              startColumnIndex: 13,
              endColumnIndex: 14,
            },
            cell: {
              userEnteredFormat: {
                numberFormat: { type: "PERCENT", pattern: "0.00%" },
              },
            },
            fields: "userEnteredFormat.numberFormat",
          },
        },

        // O => integer (N years)
        {
          repeatCell: {
            range: {
              sheetId: tabId,
              startRowIndex: 3,
              endRowIndex,
              startColumnIndex: 14,
              endColumnIndex: 15,
            },
            cell: {
              userEnteredFormat: {
                numberFormat: { type: "NUMBER", pattern: "0" },
              },
            },
            fields: "userEnteredFormat.numberFormat",
          },
        },

        // Integer columns: Mean Rainy Days (H), Mean Snowy Days (J), Mean Wet Days (L)
        ...([7, 9, 11].map((col) => ({
          repeatCell: {
            range: {
              sheetId: tabId,
              startRowIndex: 3,
              endRowIndex,
              startColumnIndex: col,
              endColumnIndex: col + 1,
            },
            cell: {
              userEnteredFormat: {
                numberFormat: { type: "NUMBER", pattern: "0" },
              },
            },
            fields: "userEnteredFormat.numberFormat",
          },
        })) as sheets_v4.Schema$Request[]),

        // P..R => 2 decimals (Warmest, Coldest, Wettest Monthly Total)
        {
          repeatCell: {
            range: {
              sheetId: tabId,
              startRowIndex: 3,
              endRowIndex,
              startColumnIndex: 15,
              endColumnIndex: 18,
            },
            cell: {
              userEnteredFormat: {
                numberFormat: { type: "NUMBER", pattern: "0.00" },
              },
            },
            fields: "userEnteredFormat.numberFormat",
          },
        },

        // S => integer (Wettest year)
        {
          repeatCell: {
            range: {
              sheetId: tabId,
              startRowIndex: 3,
              endRowIndex,
              startColumnIndex: 18,
              endColumnIndex: 19,
            },
            cell: {
              userEnteredFormat: {
                numberFormat: { type: "NUMBER", pattern: "0" },
              },
            },
            fields: "userEnteredFormat.numberFormat",
          },
        },

        // Record numeric columns: T, V, X, Z => 2 decimals (shifted after layout changes)
        ...([19, 21, 23, 25].map((startCol) => ({
          repeatCell: {
            range: {
              sheetId: tabId,
              startRowIndex: 3,
              endRowIndex,
              startColumnIndex: startCol,
              endColumnIndex: startCol + 1,
            },
            cell: {
              userEnteredFormat: {
                numberFormat: { type: "NUMBER", pattern: "0.00" },
              },
            },
            fields: "userEnteredFormat.numberFormat",
          },
        })) as sheets_v4.Schema$Request[]),
      ],
    },
  });
}

export async function generateClimatologyMaster(args: {
  sheets: sheets_v4.Sheets;
  spreadsheetId: string;
  latitude: number;
  longitude: number;
  timezone: string;
  getOrCreateSheetId: (
    sheets: sheets_v4.Sheets,
    spreadsheetId: string,
    title: string
  ) => Promise<number>;
  monthlyDailyRecords?: MonthlyDailyRecordsByMonth;
}) {
  const {
    sheets,
    spreadsheetId,
    latitude,
    longitude,
    timezone,
    getOrCreateSheetId,
    monthlyDailyRecords,
  } = args;

  const climoTabId = await getOrCreateSheetId(
    sheets,
    spreadsheetId,
    CLIMO_MASTER_SHEET
  );

  // Read existing record extremes so records persist across runs
  const existingRecordMap = await readExistingClimoRecords({
    sheets,
    spreadsheetId,
    timezone,
  });

  // Read header first so we can be resilient to older sheet layouts
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${MONTHLY_AGG_SHEET}!A3:O3`,
  });

  const headerRow = (headerRes.data.values ?? [])[0] ?? ([] as unknown[]);

  // Simple findCol implementation (original behavior) — exact substring match
  const simpleFindCol = (keywords: string | string[], fallback: number) => {
    const ks = Array.isArray(keywords) ? keywords : [keywords];
    const found = ks
      .map((k) => {
        const idx = headerRow.findIndex((h) =>
          String(h ?? "")
            .toLowerCase()
            .includes(k.toLowerCase())
        );
        return idx >= 0 ? idx : -1;
      })
      .filter((i) => i >= 0);
    return found.length ? found[0] : fallback;
  };

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${MONTHLY_AGG_SHEET}!A4:O`,
  });

  const rows = (res.data.values ?? []) as unknown[][];

  // Default (current) layout indices
  const idxDefaults = {
    year: 0,
    month: 1,
    tmax: 2,
    tmin: 3,
    tmean: 4,
    dew: 5,
    rh: 6,
    totalRain: 7,
    rainyDays: 8,
    totalSnowfall: 9,
    snowyDays: 10,
    totalPrecip: 11,
    wetDays: 12,
    sunshine: 13,
    sunshinePct: 14,
    validDays: 15,
  } as const;

  const idxMap = {
    year: simpleFindCol(["year"], idxDefaults.year),
    month: simpleFindCol(["month"], idxDefaults.month),
    tmax: simpleFindCol(["tmax", "mean tmax"], idxDefaults.tmax),
    tmin: simpleFindCol(["tmin"], idxDefaults.tmin),
    tmean: simpleFindCol(["mean temp", "mean tmean"], idxDefaults.tmean),
    dew: simpleFindCol(["dew"], idxDefaults.dew),
    rh: simpleFindCol(["relative humidity", "rh"], idxDefaults.rh),
    totalRain: simpleFindCol(
      ["total rainfall", "total rain", "rainfall", "rain (sum)"],
      idxDefaults.totalRain
    ),
    rainyDays: simpleFindCol(["rainy days", "rainy"], idxDefaults.rainyDays),
    totalSnowfall: simpleFindCol(
      ["total snowfall", "snowfall"],
      idxDefaults.totalSnowfall
    ),
    snowyDays: simpleFindCol(
      ["snowy days", "snowydays"],
      idxDefaults.snowyDays
    ),
    totalPrecip: simpleFindCol(
      ["total precipitation", "total precip", "precipitation"],
      idxDefaults.totalPrecip
    ),
    wetDays: simpleFindCol(["wet days", "wetdays"], idxDefaults.wetDays),
    sunshine: simpleFindCol(
      ["total sunshine", "sunshine"],
      idxDefaults.sunshine
    ),
    sunshinePct: simpleFindCol(
      ["percent possible sunshine", "percent possible", "possible sunshine"],
      idxDefaults.sunshinePct
    ),
    validDays: simpleFindCol(["valid days", "valid"], idxDefaults.validDays),
  } as const;
  const byYearMonth = new Map<string, YearMonthAgg>();

  for (const r of rows) {
    const year = asNum(r[idxMap.year]);
    const monthName = String(r[idxMap.month] ?? "").trim();
    if (!year || !monthName) continue;

    const monthIdx = monthIndexFromName(monthName, timezone);
    if (!monthIdx) continue;

    const key = `${year}-${String(monthIdx).padStart(2, "0")}`;

    byYearMonth.set(key, {
      year,
      monthIdx,
      tmax: asNum(r[idxMap.tmax]),
      tmin: asNum(r[idxMap.tmin]),
      tmean: asNum(r[idxMap.tmean]),
      dew: asNum(r[idxMap.dew]),
      rh: asNum(r[idxMap.rh]),
      rain: asNum(r[idxMap.totalRain]),
      rainyDays: asNum(r[idxMap.rainyDays]),
      snowfall: asNum(r[idxMap.totalSnowfall]),
      snowyDays: asNum(r[idxMap.snowyDays]),
      precip: asNum(r[idxMap.totalPrecip]),
      wetDays: asNum(r[idxMap.wetDays]),
      sunshine: asNum(r[idxMap.sunshine]),
      sunshinePct: parsePercent(r[idxMap.sunshinePct]),
      validDays: asNum(r[idxMap.validDays]),
    });
  }

  const monthBuckets = new Map<number, YearMonthAgg[]>();
  for (const v of byYearMonth.values()) {
    const arr = monthBuckets.get(v.monthIdx) ?? [];
    arr.push(v);
    monthBuckets.set(v.monthIdx, arr);
  }

  const climoRows: ClimoMonthRow[] = [];
  for (let m = 1; m <= 12; m++) {
    const bucket = monthBuckets.get(m) ?? [];

    const tmaxs = bucket.map((x) => x.tmax);
    const tmins = bucket.map((x) => x.tmin);
    const tmeans = bucket.map((x) => x.tmean);
    const dews = bucket.map((x) => x.dew ?? null);
    const rhs = bucket.map((x) => x.rh);
    const precs = bucket.map((x) => x.precip);
    const rainy = bucket.map((x) => x.rainyDays);
    const sun = bucket.map((x) => x.sunshine);
    const sunPct = bucket.map((x) => x.sunshinePct ?? null);
    const snowfalls = bucket.map(
      (x) => (x as YearMonthAgg & { snowfall?: number | null }).snowfall ?? null
    );
    const snowydays = bucket.map(
      (x) =>
        (x as YearMonthAgg & { snowyDays?: number | null }).snowyDays ?? null
    );
    console.log("sunpct in master", sunPct);

    const wettestYear = pickYearOfMaxMonthlyTotal({ bucket });

    // incoming record candidates from current request's daily rows
    const incomingBundle = getMonthlyRecordBundle({
      dailyRecordsByMonth: monthlyDailyRecords,
      monthIdx: m,
      timezone,
    });

    const incomingRecords: ExistingMonthlyRecords = {
      recHighTmax: incomingBundle.recHighTmax,
      recLowTmin: incomingBundle.recLowTmin,
      recMaxPrecip: incomingBundle.recMaxPrecip,
      recMaxSnow: incomingBundle.recMaxSnow,
    };

    // Merge with existing sheet records (strictly broken only)
    const merged = mergeMonthlyRecordsStrict(
      existingRecordMap[m] ?? null,
      incomingRecords
    );

    // Exactly 25 columns (A..Y)
    const rains = bucket.map(
      (x) => (x as YearMonthAgg & { rain?: number | null }).rain ?? null
    );
    const wetDaysArr = bucket.map(
      (x) => (x as YearMonthAgg & { wetDays?: number | null }).wetDays ?? null
    );

    // Normalize percent-like values: if a value is >1 and <=100 it's likely a
    // whole-percentage (e.g. 84) instead of a fraction (0.84). Convert those to
    // 0..1 to make downstream means correct.
    const normMeanSunPct = (() => {
      const mapped = sunPct.map((v) =>
        v == null ? null : v > 1 && v <= 100 ? v / 100 : v
      );
      const m = mean(mapped as Array<number | null>);
      // Diagnostic logging: show per-month normalized mean percent possible sunshine
      // This helps detect when values are missing or parsed incorrectly.
      // Example output: "Climo mean percent (Jan): 0.84"
      console.log(
        `Climo mean percent for ${
          monthNameFromIndex(m as unknown as number, timezone) || m
        }:`,
        m
      );
      return m;
    })();

    climoRows.push([
      monthNameFromIndex(m, timezone),
      round2(mean(tmaxs)),
      round2(mean(tmins)),
      round2(mean(tmeans)),
      round2(mean(dews)),
      round2(mean(rhs)),
      // Mean Rainfall (mm)
      round2(mean(rains)),
      // Mean Rainy Days (days)
      round2(mean(rainy)),
      // Mean Snowfall (cm)
      round2(mean(snowfalls)),
      // Mean Snowy Days (days)
      round2(mean(snowydays)),
      // Mean Monthly Precipitation (mm)
      round2(mean(precs)),
      // Mean Wet Days (days)
      round2(mean(wetDaysArr)),
      // Mean Sunshine (hours)
      round2(mean(sun)),
      // Mean Percent Possible Sunshine (0..1)
      round2(normMeanSunPct), // 0..1
      bucket.length || null,
      round2(max(tmaxs)),
      round2(min(tmins)),
      round2(max(precs)),
      wettestYear,

      merged.recHighTmax?.[0] ?? null,
      merged.recHighTmax?.[1] ?? null,
      merged.recLowTmin?.[0] ?? null,
      merged.recLowTmin?.[1] ?? null,
      merged.recMaxPrecip?.[0] ?? null,
      merged.recMaxPrecip?.[1] ?? null,
      merged.recMaxSnow?.[0] ?? null,
      merged.recMaxSnow?.[1] ?? null,
    ] as unknown as ClimoMonthRow);
  }

  const values: (string | number | null)[][] = [
    ["Climatology Master (computed from Monthly Aggregates)"],
    [
      "Latitude",
      latitude,
      "Longitude",
      longitude,
      "Timezone",
      timezone,
      "Last Updated",
      moment.tz(timezone).format("Do MMM YYYY, hh:mm A"),
    ],
    [
      "Month",
      "Mean Tmax (°C)",
      "Mean Tmin (°C)",
      "Mean Temp (°C)",
      "Mean Dew Point (°C)",
      "Mean Relative Humidity (%)",
      "Mean Rainfall (mm)",
      "Mean Rainy Days (days)",
      "Mean Snowfall (cm)",
      "Mean Snowy Days (days)",
      "Mean Monthly Precipitation (mm)",
      "Mean Wet Days (days)",
      "Mean Sunshine (hours)",
      "Mean Percent Possible Sunshine (%)",
      "N (years)",
      "Warmest Monthly Mean Tmax (°C)",
      "Coldest Monthly Mean Tmin (°C)",
      "Wettest Monthly Total (mm)",
      "Wettest Monthly Total Year",
      "Record High Tmax (°C)",
      "Record High Tmax Date",
      "Record Low Tmin (°C)",
      "Record Low Tmin Date",
      "Record Max 24h Precipitation (mm)",
      "Record Max 24h Precipitation Date",
      "Record Max 24h Snow (mm)",
      "Record Max 24h Snow Date",
    ],
    ...(climoRows as unknown as (string | number | null)[][]),

    // Annual row trimmed to exactly 25 columns (A..Y), ending at Snow Date
    [
      "Annual (from monthly means)", // A
      round2(mean(climoRows.map((r) => r[1]))), // B Mean Tmax
      round2(mean(climoRows.map((r) => r[2]))), // C Mean Tmin
      round2(mean(climoRows.map((r) => r[3]))), // D Mean Temp
      round2(mean(climoRows.map((r) => r[4]))), // E Mean Dew
      round2(mean(climoRows.map((r) => r[5]))), // F Mean RH
      round2(sum(climoRows.map((r) => r[6]))), // G Sum Mean Rainfall (annual total)
      round2(sum(climoRows.map((r) => r[7]))), // H Sum Mean Rainy Days
      round2(sum(climoRows.map((r) => r[8]))), // I Sum Mean Snowfall (annual total)
      round2(sum(climoRows.map((r) => r[9]))), // J Sum Mean Snowy Days (annual)
      round2(sum(climoRows.map((r) => r[10]))), // K Sum Mean Monthly Precipitation (annual total)
      round2(sum(climoRows.map((r) => r[11]))), // L Sum Mean Wet Days (annual total)
      round2(mean(climoRows.map((r) => r[12]))), // M Mean Sunshine
      round2(mean(climoRows.map((r) => r[13]))), // N Mean Percent Possible Sunshine (0..1)
      max(climoRows.map((r) => r[14])), // O N (years)
      round2(max(climoRows.map((r) => r[15]))), // P Warmest
      round2(min(climoRows.map((r) => r[16]))), // Q Coldest
      round2(max(climoRows.map((r) => r[17]))), // R Wettest Monthly Total
      null, // Q Wettest year

      null,
      null, // R,S Record High Tmax + Date
      null,
      null, // T,U Record Low Tmin + Date
      null,
      null, // V,W Record Max 24h Precip + Date
      null,
      null, // X,Y Record Max 24h Snow + Date
    ],
  ];

  // Defensive normalization: ensure the "Mean Percent Possible Sunshine (%)"
  // column (index 13) contains a fraction 0..1. Some historical sheets or
  // unexpected inputs may contain whole percentages (e.g. 84) or strings like
  // "84%". Normalize these into numeric fractions so the PERCENT display
  // format shows the correct percent.
  const normalizePercentCell = (v: unknown): number | null => {
    if (v == null) return null;
    if (typeof v === "string") {
      const s = v.trim();
      if (s.endsWith("%")) {
        const raw = Number(s.slice(0, -1).replace(/,/g, ""));
        return Number.isFinite(raw) ? raw / 100 : null;
      }
      const n = Number(s.replace(/,/g, ""));
      if (Number.isFinite(n)) return n > 1 ? n / 100 : n;
      return null;
    }
    if (typeof v === "number") {
      return v > 1 ? v / 100 : v;
    }
    return null;
  };

  // Apply normalization to each data row (starting at index 3) and the annual row
  for (let ri = 3; ri < values.length; ri++) {
    const row = values[ri];
    // Only attempt if the row has at least 14 columns
    if (row && row.length > 13) {
      const norm = normalizePercentCell(row[13]);
      row[13] = norm;
    }
  }

  // A..AA (now 27 cols)
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${CLIMO_MASTER_SHEET}!A:AA`,
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${CLIMO_MASTER_SHEET}!A1`,
    valueInputOption: "RAW",
    requestBody: { values },
  });

  const BIG_END_ROW = 200000;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          updateSheetProperties: {
            properties: {
              sheetId: climoTabId,
              gridProperties: { frozenRowCount: 3 },
            },
            fields: "gridProperties.frozenRowCount",
          },
        },

        // Title row bold
        {
          repeatCell: {
            range: {
              sheetId: climoTabId,
              startRowIndex: 0,
              endRowIndex: 1,
              startColumnIndex: 0,
              endColumnIndex: 27,
            },
            cell: {
              userEnteredFormat: { textFormat: { bold: true, fontSize: 12 } },
            },
            fields: "userEnteredFormat.textFormat",
          },
        },

        // Header row bold
        {
          repeatCell: {
            range: {
              sheetId: climoTabId,
              startRowIndex: 2,
              endRowIndex: 3,
              startColumnIndex: 0,
              endColumnIndex: 27,
            },
            cell: { userEnteredFormat: { textFormat: { bold: true } } },
            fields: "userEnteredFormat.textFormat",
          },
        },

        // Data rows not bold
        {
          repeatCell: {
            range: {
              sheetId: climoTabId,
              startRowIndex: 3,
              endRowIndex: BIG_END_ROW,
              startColumnIndex: 0,
              endColumnIndex: 27,
            },
            cell: { userEnteredFormat: { textFormat: { bold: false } } },
            fields: "userEnteredFormat.textFormat",
          },
        },

        // B..M => 2 decimals (Mean Tmax .. Mean Sunshine)
        {
          repeatCell: {
            range: {
              sheetId: climoTabId,
              startRowIndex: 3,
              endRowIndex: values.length,
              startColumnIndex: 1,
              endColumnIndex: 13,
            },
            cell: {
              userEnteredFormat: {
                numberFormat: { type: "NUMBER", pattern: "0.00" },
              },
            },
            fields: "userEnteredFormat.numberFormat",
          },
        },

        // N => percent (Mean Percent Possible Sunshine) (0..1 stored)
        {
          repeatCell: {
            range: {
              sheetId: climoTabId,
              startRowIndex: 3,
              endRowIndex: values.length,
              startColumnIndex: 13,
              endColumnIndex: 14,
            },
            cell: {
              userEnteredFormat: {
                numberFormat: { type: "PERCENT", pattern: "0.00%" },
              },
            },
            fields: "userEnteredFormat.numberFormat",
          },
        },

        // O => integer (N years)
        {
          repeatCell: {
            range: {
              sheetId: climoTabId,
              startRowIndex: 3,
              endRowIndex: values.length,
              startColumnIndex: 14,
              endColumnIndex: 15,
            },
            cell: {
              userEnteredFormat: {
                numberFormat: { type: "NUMBER", pattern: "0" },
              },
            },
            fields: "userEnteredFormat.numberFormat",
          },
        },

        // P..R => 2 decimals (Warmest, Coldest, Wettest Monthly Total)
        {
          repeatCell: {
            range: {
              sheetId: climoTabId,
              startRowIndex: 3,
              endRowIndex: values.length,
              startColumnIndex: 15,
              endColumnIndex: 18,
            },
            cell: {
              userEnteredFormat: {
                numberFormat: { type: "NUMBER", pattern: "0.00" },
              },
            },
            fields: "userEnteredFormat.numberFormat",
          },
        },

        // S => integer (Wettest Monthly Total Year)
        {
          repeatCell: {
            range: {
              sheetId: climoTabId,
              startRowIndex: 3,
              endRowIndex: values.length,
              startColumnIndex: 18,
              endColumnIndex: 19,
            },
            cell: {
              userEnteredFormat: {
                numberFormat: { type: "NUMBER", pattern: "0" },
              },
            },
            fields: "userEnteredFormat.numberFormat",
          },
        },

        // Record numeric columns (T, V, X, Z) => 2 decimals (shifted after layout changes)
        ...([19, 21, 23, 25].map((startCol) => ({
          repeatCell: {
            range: {
              sheetId: climoTabId,
              startRowIndex: 3,
              endRowIndex: values.length,
              startColumnIndex: startCol,
              endColumnIndex: startCol + 1,
            },
            cell: {
              userEnteredFormat: {
                numberFormat: { type: "NUMBER", pattern: "0.00" },
              },
            },
            fields: "userEnteredFormat.numberFormat",
          },
        })) as sheets_v4.Schema$Request[]),
        // Annual row label (column A) bold to match the mean row label styling
        {
          repeatCell: {
            range: {
              sheetId: climoTabId,
              startRowIndex: values.length - 1,
              endRowIndex: values.length,
              startColumnIndex: 0,
              endColumnIndex: 1,
            },
            cell: { userEnteredFormat: { textFormat: { bold: true } } },
            fields: "userEnteredFormat.textFormat",
          },
        },

        // Annual row background to match the Mean row background color
        {
          repeatCell: {
            range: {
              sheetId: climoTabId,
              startRowIndex: values.length - 1,
              endRowIndex: values.length,
              startColumnIndex: 0,
              endColumnIndex: 25,
            },
            cell: { userEnteredFormat: { backgroundColor: COLOR_MEAN_ROW } },
            fields: "userEnteredFormat.backgroundColor",
          },
        },
      ],
    },
  });
}

export async function generate30YearClimatologyTabs(args: {
  sheets: sheets_v4.Sheets;
  spreadsheetId: string;
  timezone: string;
  getOrCreateSheetId: (
    sheets: sheets_v4.Sheets,
    spreadsheetId: string,
    title: string
  ) => Promise<number>;
  baseStartYear?: number;
  windowYears?: number;
  stepYears?: number;
  monthlyDailyRecords?: MonthlyDailyRecordsByMonth;
}) {
  const {
    sheets,
    spreadsheetId,
    timezone,
    getOrCreateSheetId,
    baseStartYear = DEFAULT_BASE_START,
    windowYears = DEFAULT_WINDOW_YEARS,
    stepYears = DEFAULT_STEP_YEARS,
    monthlyDailyRecords,
  } = args;

  // Read Monthly Aggregates header first to be resilient to older layouts
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${MONTHLY_AGG_SHEET}!A3:N3`,
  });

  const headerRow = (headerRes.data.values ?? [])[0] ?? ([] as unknown[]);

  const findCol = (keywords: string | string[], fallback: number) => {
    const ks = Array.isArray(keywords) ? keywords : [keywords];
    // Normalize header texts for robust matching (remove punctuation, lower-case)
    const norm = (s: unknown) =>
      String(s ?? "")
        .toLowerCase()
        .replace(/[\(\)%,:.]/g, "")
        .replace(/\s+/g, " ")
        .trim();

    // Primary scan: normalized substring match
    const found = ks
      .map((k) => {
        const kk = String(k).toLowerCase();
        const idx = headerRow.findIndex((h) => norm(h).includes(kk));
        return idx >= 0 ? idx : -1;
      })
      .filter((i) => i >= 0);
    if (found.length) return found[0];

    // Secondary: special-case percent+sunshine style headers
    if (ks.some((k) => String(k).toLowerCase().includes("percent"))) {
      const pctIdx = headerRow.findIndex((h) => {
        const s = String(h ?? "").toLowerCase();
        return s.includes("%") && s.includes("sunshine");
      });
      if (pctIdx >= 0) return pctIdx;
    }

    // Final fallback: raw substring match
    const found2 = ks
      .map((k) => {
        const kk = String(k).toLowerCase();
        const idx = headerRow.findIndex((h) =>
          String(h ?? "")
            .toLowerCase()
            .includes(kk)
        );
        return idx >= 0 ? idx : -1;
      })
      .filter((i) => i >= 0);
    return found2.length ? found2[0] : fallback;
  };

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${MONTHLY_AGG_SHEET}!A4:O`,
  });

  const rows = (res.data.values ?? []) as unknown[][];

  const idxDefaults = {
    year: 0,
    month: 1,
    tmax: 2,
    tmin: 3,
    tmean: 4,
    dew: 5,
    rh: 6,
    totalRain: 7,
    rainyDays: 8,
    totalSnowfall: 9,
    snowyDays: 10,
    totalPrecip: 11,
    wetDays: 12,
    sunshine: 13,
    sunshinePct: 14,
    validDays: 15,
  } as const;

  const idxMap = {
    year: findCol(["year"], idxDefaults.year),
    month: findCol(["month"], idxDefaults.month),
    tmax: findCol(["tmax", "mean tmax"], idxDefaults.tmax),
    tmin: findCol(["tmin"], idxDefaults.tmin),
    tmean: findCol(["mean temp", "mean tmean"], idxDefaults.tmean),
    dew: findCol(["dew"], idxDefaults.dew),
    rh: findCol(["relative humidity", "rh"], idxDefaults.rh),
    totalRain: findCol(
      ["total rainfall", "total rain", "rainfall", "rain (sum)"],
      idxDefaults.totalRain
    ),
    rainyDays: findCol(["rainy days", "rainy"], idxDefaults.rainyDays),
    totalSnowfall: findCol(
      ["total snowfall", "snowfall"],
      idxDefaults.totalSnowfall
    ),
    snowyDays: findCol(["snowy days", "snowydays"], idxDefaults.snowyDays),
    totalPrecip: findCol(
      ["total precipitation", "total precip", "precipitation"],
      idxDefaults.totalPrecip
    ),
    wetDays: findCol(["wet days", "wetdays"], idxDefaults.wetDays),
    sunshine: findCol(["total sunshine", "sunshine"], idxDefaults.sunshine),
    sunshinePct: findCol(
      ["percent possible sunshine", "percent possible", "possible sunshine"],
      idxDefaults.sunshinePct
    ),
    validDays: findCol(["valid days", "valid"], idxDefaults.validDays),
  } as const;
  const byYearMonth = new Map<string, YearMonthAgg>();

  for (const r of rows) {
    const year = asNum(r[idxMap.year]);
    const monthName = String(r[idxMap.month] ?? "").trim();
    if (!year || !monthName) continue;

    const monthIdx = monthIndexFromName(monthName, timezone);
    if (!monthIdx) continue;

    const key = `${year}-${String(monthIdx).padStart(2, "0")}`;
    byYearMonth.set(key, {
      year,
      monthIdx,
      tmax: asNum(r[idxMap.tmax]),
      tmin: asNum(r[idxMap.tmin]),
      tmean: asNum(r[idxMap.tmean]),
      dew: asNum(r[idxMap.dew]),
      rh: asNum(r[idxMap.rh]),
      rain: asNum(r[idxMap.totalRain]),
      rainyDays: asNum(r[idxMap.rainyDays]),
      snowfall: asNum(r[idxMap.totalSnowfall]),
      snowyDays: asNum(r[idxMap.snowyDays]),
      precip: asNum(r[idxMap.totalPrecip]),
      wetDays: asNum(r[idxMap.wetDays]),
      sunshine: asNum(r[idxMap.sunshine]),
      sunshinePct: parsePercent(r[idxMap.sunshinePct]), // 0..1
      validDays: asNum(r[idxMap.validDays]),
    });
  }

  const records = Array.from(byYearMonth.values());
  const yr = computeAvailableYearRange(records);
  if (!yr) {
    return {
      createdTabs: [] as string[],
      windows: [] as Array<{ start: number; end: number }>,
    };
  }

  const windows = buildWindows({
    minYear: yr.minYear,
    maxYear: yr.maxYear,
    baseStartYear,
    windowYears,
    stepYears,
  });

  const createdTabs: string[] = [];

  for (const w of windows) {
    const title = `Climatology_${w.start}_${w.end}`;
    const { climoRows, annualRow } = computeWindowClimo({
      records,
      startYear: w.start,
      endYear: w.end,
      timezone,
      dailyRecordsByMonth: monthlyDailyRecords,
    });

    await writeWindowSheet({
      sheets,
      spreadsheetId,
      title,
      timezone,
      startYear: w.start,
      endYear: w.end,
      climoRows,
      annualRow,
      getOrCreateSheetId,
    });

    createdTabs.push(title);
  }

  return { createdTabs, windows };
}
