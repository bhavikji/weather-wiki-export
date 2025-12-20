// app/lib/sheetValueBuilders.ts
import moment from "moment-timezone";
import {
  DAILY_VARS,
  HUMIDITY_VARS,
  metaHeaderRowHuman,
  headerRowHuman,
} from "@/app/lib/openMeteo";
import type { DailyVar, Meta, OpenMeteoRow } from "@/app/types/open-meteo.type";
import type { MonthSection } from "@/app/types/sheets-formatting.types";

export type SheetCell = string | number | boolean | null;
export type SheetRow = SheetCell[];
export type SheetValues = SheetRow[];

export const COL_COUNT = 1 + DAILY_VARS.length; // A + (B..)
export const BLANK_ROW: SheetRow = new Array<SheetCell>(COL_COUNT).fill(null);

// Thresholds used to "bypass" zero-ish precip/snow extremes in the Extremes rows
const RAIN_DAY_THRESHOLD_MM = 0.1;
const PRECIP_DAY_THRESHOLD_MM = 0.1;
const SNOW_DAY_THRESHOLD_CM = 0.1;

export function isTotalVar(v: DailyVar) {
  return (
    v === "rain_sum" ||
    v === "snowfall_sum" ||
    v === "precipitation_sum" ||
    v === "sunshine_duration" ||
    v === "daylight_duration"
  );
}

export function colLetter(colIndex1Based: number): string {
  let n = colIndex1Based;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function toFiniteNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const t = v.trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function toSheetRow(row: OpenMeteoRow, yearTimezone: string): SheetRow {
  const [dateStr, ...vals] = row;

  const m = moment.tz(String(dateStr), "YYYY-MM-DD", true, yearTimezone);
  const prettyDate = m.isValid() ? m.format("Do MMM YYYY") : String(dateStr);

  const out: SheetRow = [prettyDate];

  for (let i = 0; i < DAILY_VARS.length; i++) {
    const varName = DAILY_VARS[i];
    const v = vals[i];

    // humidity -> store as fraction (0..1) so Sheets % format shows correctly
    if (HUMIDITY_VARS.includes(varName)) {
      const num = toFiniteNumber(v);
      out.push(num != null ? num / 100 : null);
      continue;
    }

    // sunrise/sunset -> human readable time (force TEXT in Sheets)
    if (varName === "sunrise" || varName === "sunset") {
      const toText = (s: string) => (s ? `'${s}` : null);

      // Case 1: ISO datetime string
      if (typeof v === "string" && v) {
        const mt = moment.tz(v, yearTimezone);
        const formatted = mt.isValid() ? mt.format("hh:mm A") : v;
        out.push(toText(formatted));
        continue;
      }

      // Case 2: fraction-of-day number (0..1)
      if (typeof v === "number" && Number.isFinite(v)) {
        const seconds = Math.round(v * 24 * 60 * 60);

        const base = moment.tz(
          String(dateStr),
          "YYYY-MM-DD",
          true,
          yearTimezone
        );

        const formatted = base.isValid()
          ? base
              .clone()
              .startOf("day")
              .add(seconds, "seconds")
              .format("hh:mm A")
          : moment
              .utc(0)
              .startOf("day")
              .add(seconds, "seconds")
              .format("hh:mm A");

        out.push(toText(formatted));
        continue;
      }

      out.push(null);
      continue;
    }

    // daylight & sunshine duration -> convert seconds → hours
    if (varName === "daylight_duration" || varName === "sunshine_duration") {
      const num = toFiniteNumber(v);
      out.push(num != null ? num / 3600 : null);
      continue;
    }

    out.push((v ?? null) as SheetCell);
  }

  return out;
}

function maxWithThresholdFormula(args: {
  col: string;
  startRow: number;
  endRow: number;
  threshold: number;
}) {
  const { col, startRow, endRow, threshold } = args;
  // Blank if max < threshold
  return `=IF(MAX(${col}${startRow}:${col}${endRow})<${threshold},"",MAX(${col}${startRow}:${col}${endRow}))`;
}

export function buildMonthWiseValues(args: {
  year: number;
  meta: Meta;
  rawRows: OpenMeteoRow[];
  timezone: string;
}): {
  values: SheetValues;
  monthSections: MonthSection[];
  annualSection?: {
    meanRowIndex: number;
    totalRowIndex: number;
    recordRowIndex: number;
  };
} {
  const { year, meta, rawRows, timezone } = args;

  const sheetRows: SheetRow[] = rawRows.map((r) => toSheetRow(r, timezone));

  const monthBuckets = new Map<number, SheetRow[]>();
  for (let i = 0; i < rawRows.length; i++) {
    const dateStr = String(rawRows[i][0]);
    const mm = Number(dateStr.slice(5, 7)); // 01..12
    if (!monthBuckets.has(mm)) monthBuckets.set(mm, []);
    monthBuckets.get(mm)!.push(sheetRows[i]);
  }

  const values: SheetValues = [];

  const metaValueRow: SheetRow = [
    meta.latitude,
    meta.longitude,
    meta.elevation,
    meta.utc_offset_seconds,
    meta.timezone,
    meta.timezone_abbreviation,
  ];

  values.push([...metaHeaderRowHuman]);
  values.push(metaValueRow);
  values.push([]); // spacer row (kept as empty row)

  const monthSections: MonthSection[] = [];
  let currentRow = 4; // 1-based

  let annualSection:
    | { meanRowIndex: number; totalRowIndex: number; recordRowIndex: number }
    | undefined;

  for (let month = 1; month <= 12; month++) {
    const rows = monthBuckets.get(month) ?? [];
    if (rows.length === 0) continue;

    const monthName = moment
      .tz(`${year}-${String(month).padStart(2, "0")}-01`, timezone)
      .format("MMMM");

    values.push([monthName]);
    const monthHeaderRowIndex = currentRow;
    currentRow++;

    values.push([...headerRowHuman]);
    const colHeaderRowIndex = currentRow;
    currentRow++;

    const dataStartRow = currentRow;
    for (const r of rows) values.push(r);
    currentRow += rows.length;
    const dataEndRow = currentRow - 1;

    // Mean row
    const meanRowIndex = currentRow;
    const meanRow: SheetRow = new Array<SheetCell>(COL_COUNT).fill(null);
    meanRow[0] = "Mean";

    for (let c = 2; c <= COL_COUNT; c++) {
      const col = colLetter(c);
      const varName = DAILY_VARS[c - 2];
      if (varName === "sunrise" || varName === "sunset") {
        meanRow[c - 1] = null;
        continue;
      }
      meanRow[c - 1] = `=AVERAGE(${col}${dataStartRow}:${col}${dataEndRow})`;
    }

    values.push(meanRow);
    currentRow++;

    // Total row
    const totalRowIndex = currentRow;
    const totalRow: SheetRow = new Array<SheetCell>(COL_COUNT).fill(null);
    totalRow[0] = "Total";

    for (let c = 2; c <= COL_COUNT; c++) {
      const col = colLetter(c);
      const varName = DAILY_VARS[c - 2];

      if (varName === "sunrise" || varName === "sunset") {
        totalRow[c - 1] = null;
        continue;
      }

      totalRow[c - 1] = isTotalVar(varName)
        ? `=SUM(${col}${dataStartRow}:${col}${dataEndRow})`
        : null;
    }

    values.push(totalRow);
    currentRow++;

    // Extremes row
    const recordRowIndex = currentRow;
    const recordRow: SheetRow = new Array<SheetCell>(COL_COUNT).fill(null);
    recordRow[0] = "Extremes";

    for (let c = 2; c <= COL_COUNT; c++) {
      const col = colLetter(c);
      const varName = DAILY_VARS[c - 2];

      if (varName === "sunrise" || varName === "sunset") {
        recordRow[c - 1] = null;
        continue;
      }

      if (
        varName === "temperature_2m_min" ||
        varName === "relative_humidity_2m_min"
      ) {
        recordRow[c - 1] = `=MIN(${col}${dataStartRow}:${col}${dataEndRow})`;
        continue;
      }

      // ✅ Bypass precip/snow extremes if below thresholds (blank instead of 0)
      if (varName === "rain_sum") {
        recordRow[c - 1] = maxWithThresholdFormula({
          col,
          startRow: dataStartRow,
          endRow: dataEndRow,
          threshold: RAIN_DAY_THRESHOLD_MM,
        });
        continue;
      }
      if (varName === "snowfall_sum") {
        recordRow[c - 1] = maxWithThresholdFormula({
          col,
          startRow: dataStartRow,
          endRow: dataEndRow,
          threshold: SNOW_DAY_THRESHOLD_CM,
        });
        continue;
      }
      if (varName === "precipitation_sum") {
        recordRow[c - 1] = maxWithThresholdFormula({
          col,
          startRow: dataStartRow,
          endRow: dataEndRow,
          threshold: PRECIP_DAY_THRESHOLD_MM,
        });
        continue;
      }

      recordRow[c - 1] = `=MAX(${col}${dataStartRow}:${col}${dataEndRow})`;
    }

    values.push(recordRow);
    currentRow++;

    values.push([]); // spacer
    currentRow++;

    monthSections.push({
      month,
      monthName,
      monthHeaderRowIndex,
      colHeaderRowIndex,
      dataStartRow,
      dataEndRow,
      meanRowIndex,
      totalRowIndex,
      recordRowIndex,
    } as MonthSection);
  }

  // Annual summary
  if (monthSections.length > 0) {
    values.push([...BLANK_ROW]);
    currentRow++;

    const refsFor = (col: string, kind: "mean" | "total") =>
      monthSections
        .map((ms) =>
          kind === "mean"
            ? `${col}${ms.meanRowIndex}`
            : `${col}${ms.totalRowIndex}`
        )
        .join(",");

    const yearRangesFor = (col: string) =>
      monthSections
        .map((ms) => `${col}${ms.dataStartRow}:${col}${ms.dataEndRow}`)
        .join(",");

    const annualMeanRowIndex = currentRow;
    const annualMeanRow: SheetRow = new Array<SheetCell>(COL_COUNT).fill(null);
    annualMeanRow[0] = "Annual Mean";

    for (let c = 2; c <= COL_COUNT; c++) {
      const col = colLetter(c);
      const varName = DAILY_VARS[c - 2];
      if (varName === "sunrise" || varName === "sunset") continue;
      annualMeanRow[c - 1] = `=AVERAGE(${refsFor(col, "mean")})`;
    }

    values.push(annualMeanRow);
    currentRow++;

    const annualTotalRowIndex = currentRow;
    const annualTotalRow: SheetRow = new Array<SheetCell>(COL_COUNT).fill(null);
    annualTotalRow[0] = "Annual Total";

    for (let c = 2; c <= COL_COUNT; c++) {
      const col = colLetter(c);
      const varName = DAILY_VARS[c - 2];
      if (varName === "sunrise" || varName === "sunset") continue;

      annualTotalRow[c - 1] = isTotalVar(varName)
        ? `=SUM(${refsFor(col, "total")})`
        : null;
    }

    values.push(annualTotalRow);
    currentRow++;

    const annualRecordRowIndex = currentRow;
    const annualRecordRow: SheetRow = new Array<SheetCell>(COL_COUNT).fill(
      null
    );
    annualRecordRow[0] = "Annual Extremes";

    for (let c = 2; c <= COL_COUNT; c++) {
      const col = colLetter(c);
      const varName = DAILY_VARS[c - 2];
      if (varName === "sunrise" || varName === "sunset") continue;

      const ranges = yearRangesFor(col);

      if (
        varName === "temperature_2m_min" ||
        varName === "relative_humidity_2m_min"
      ) {
        annualRecordRow[c - 1] = `=MIN(${ranges})`;
      } else {
        annualRecordRow[c - 1] = `=MAX(${ranges})`;
      }
    }

    values.push(annualRecordRow);
    currentRow++;

    annualSection = {
      meanRowIndex: annualMeanRowIndex,
      totalRowIndex: annualTotalRowIndex,
      recordRowIndex: annualRecordRowIndex,
    };
  }

  return { values, monthSections, annualSection };
}
