import moment from "moment-timezone";
import type { sheets_v4 } from "googleapis";
import type { MonthlyAggRecord } from "@/app/types/climatology-from-aggregates.types";
import { asNum } from "@/app/helpers/computeHelpers";
import { MONTHLY_AGGREGATES } from "@/app/constants";

function normalizeHeader(h: unknown): string {
  return String(h ?? "")
    .trim()
    .toLowerCase();
}

function asInt(x: unknown): number | null {
  const n = typeof x === "number" ? x : Number(String(x ?? "").trim());
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function parsePercentToFrac(x: unknown): number | null {
  if (x == null) return null;
  if (typeof x === "number" && Number.isFinite(x)) {
    // accept 0..1 or 0..100
    return x > 1 && x <= 100 ? x / 100 : x;
  }
  const s = String(x).trim();
  if (!s) return null;
  if (s.endsWith("%")) {
    const raw = Number(s.slice(0, -1).replace(/,/g, ""));
    return Number.isFinite(raw) ? raw / 100 : null;
  }
  const n = Number(s.replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  return n > 1 && n <= 100 ? n / 100 : n;
}

function monthIndexFromName(
  monthName: string,
  timezone: string
): number | null {
  const m = moment.tz(`2000-${monthName}-01`, "YYYY-MMMM-DD", true, timezone);
  return m.isValid() ? m.month() + 1 : null;
}

export async function readMonthlyAggregates(args: {
  sheets: sheets_v4.Sheets;
  spreadsheetId: string;
  timezone: string;
  sheetName?: string; // defaults "Monthly Aggregates"
}): Promise<MonthlyAggRecord[]> {
  const { sheets, spreadsheetId, timezone } = args;
  const sheetName = args.sheetName ?? MONTHLY_AGGREGATES;

  // header row (Row 3)
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A3:ZZ3`,
  });
  const headerRow = (headerRes.data.values?.[0] ?? []) as unknown[];
  const headers = headerRow.map(normalizeHeader);

  if (!headers.length) return [];

  const colIndex = (name: string) => {
    const n = normalizeHeader(name);
    const idx = headers.findIndex((h) => h.includes(n));
    return idx >= 0 ? idx : headers.indexOf(n);
  };

  // required
  const C_YEAR = colIndex("year");
  const C_MONTH = colIndex("month");

  // core metrics
  const C_TMAX = colIndex("mean tmax");
  const C_TMIN = colIndex("mean tmin");
  const C_TMEAN = colIndex("mean temp");
  const C_DEW = colIndex("mean dew point");
  const C_RH = colIndex("mean relative humidity");

  const C_RAIN_TOTAL = colIndex("total rainfall");
  const C_RAINY_DAYS = colIndex("rainy days");

  const C_SNOW_TOTAL = colIndex("total snowfall");
  const C_SNOWY_DAYS = colIndex("snowy days");

  const C_PRECIP_TOTAL = colIndex("total precipitation");
  const C_WET_DAYS = colIndex("wet days");

  const C_SUN = colIndex("total sunshine");
  const C_SUN_PCT = colIndex("percent possible sunshine");
  const C_VALID = colIndex("valid days");

  // record columns (your appended ones)
  const C_REC_HI_TMAX = colIndex("record high tmax");
  const C_REC_HI_TMAX_DATE = colIndex("record high tmax date");

  const C_REC_LO_TMIN = colIndex("record low tmin");
  const C_REC_LO_TMIN_DATE = colIndex("record low tmin date");

  const C_REC_MAX_RAIN = colIndex("record max 24h rainfall");
  const C_REC_MAX_RAIN_DATE = colIndex("record max 24h rainfall date");

  const C_REC_MAX_SNOW = colIndex("record max 24h snow");
  const C_REC_MAX_SNOW_DATE = colIndex("record max 24h snow date");

  const C_REC_MAX_PRECIP = colIndex("record max 24h precipitation");
  const C_REC_MAX_PRECIP_DATE = colIndex("record max 24h precipitation date");

  const dataRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A4:ZZ`,
  });

  const rows = (dataRes.data.values ?? []) as unknown[][];
  const out: MonthlyAggRecord[] = [];

  for (const r of rows) {
    const year = asInt(r?.[C_YEAR]);
    const monthName = String(r?.[C_MONTH] ?? "").trim();
    if (!year || !monthName) continue;

    const monthIndex = monthIndexFromName(monthName, timezone);
    if (!monthIndex) continue;

    out.push({
      year,
      monthName,
      monthIndex,

      meanTmax: asNum(r?.[C_TMAX]),
      meanTmin: asNum(r?.[C_TMIN]),
      meanTemp: asNum(r?.[C_TMEAN]),
      meanDewPoint: asNum(r?.[C_DEW]),
      meanRh: asNum(r?.[C_RH]),

      totalRain: asNum(r?.[C_RAIN_TOTAL]),
      rainyDays: asNum(r?.[C_RAINY_DAYS]),

      totalSnow: asNum(r?.[C_SNOW_TOTAL]),
      snowyDays: asNum(r?.[C_SNOWY_DAYS]),

      totalPrecip: asNum(r?.[C_PRECIP_TOTAL]),
      wetDays: asNum(r?.[C_WET_DAYS]),

      totalSunshineHours: asNum(r?.[C_SUN]),
      percentPossibleSunshineFrac: parsePercentToFrac(r?.[C_SUN_PCT]),
      validDays: asNum(r?.[C_VALID]),

      recordHighTmax: {
        value: asNum(r?.[C_REC_HI_TMAX]),
        date: r?.[C_REC_HI_TMAX_DATE] ? String(r[C_REC_HI_TMAX_DATE]) : null,
      },
      recordLowTmin: {
        value: asNum(r?.[C_REC_LO_TMIN]),
        date: r?.[C_REC_LO_TMIN_DATE] ? String(r[C_REC_LO_TMIN_DATE]) : null,
      },

      recordMax24hRain: {
        value: asNum(r?.[C_REC_MAX_RAIN]),
        date: r?.[C_REC_MAX_RAIN_DATE] ? String(r[C_REC_MAX_RAIN_DATE]) : null,
      },
      recordMax24hSnow: {
        value: asNum(r?.[C_REC_MAX_SNOW]),
        date: r?.[C_REC_MAX_SNOW_DATE] ? String(r[C_REC_MAX_SNOW_DATE]) : null,
      },
      recordMax24hPrecip: {
        value: asNum(r?.[C_REC_MAX_PRECIP]),
        date: r?.[C_REC_MAX_PRECIP_DATE]
          ? String(r[C_REC_MAX_PRECIP_DATE])
          : null,
      },
    });
  }

  return out;
}
