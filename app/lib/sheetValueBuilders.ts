// app/lib/sheetValueBuilders.ts
import moment from "moment"; // moment-timezone no longer needed for calendar rows
import {
  DAILY_VARS,
  metaHeaderRowHuman,
  headerRowHuman,
} from "@/app/lib/openMeteo";
import type { DailyVar, Meta, OpenMeteoRow } from "@/app/types/open-meteo.type";
import type { MonthSection } from "@/app/types/sheets-formatting.types";

import type {
  MonthCalendarBuckets,
  CalendarRow,
} from "@/app/types/calendar-buckets.types";

import { prettyDateFromIsoUtc, toSheetDataCells } from "./sheetsFormatting";
import {
  SheetCell,
  SheetRow,
  SheetValues,
} from "@/app/types/sheet-values.types";
import {
  safeAverageRange,
  safeAverageRefs,
  safeMaxRange,
  safeMaxRanges,
  safeMaxWithThresholdFormula,
  safeMinRange,
  safeMinRanges,
  safeSumRange,
  safeSumRefs,
} from "./sheetFormulas";
import { THRESHOLDS } from "./thresholds";

export const COL_COUNT = 1 + DAILY_VARS.length; // A + (B..)
export const BLANK_ROW: SheetRow = new Array<SheetCell>(COL_COUNT).fill(null);

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

export function buildMonthWiseValues(args: {
  year: number;
  meta: Meta;
  rawRows: OpenMeteoRow[];
  timezone: string; // still used for formatting sunrise/sunset etc via toSheetDataCells
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

  // 1) build stable UTC calendar template
  const monthBuckets = buildCalendarMonthBucketsUtc(year);

  // 2) index iso -> template row for O(1) fill
  const isoToTemplateRow = new Map<string, SheetRow>();
  for (const [, entries] of monthBuckets) {
    for (const e of entries) isoToTemplateRow.set(e.iso, e.row);
  }

  // 3) fill template using API rows (join on YYYY-MM-DD string)
  for (const r of rawRows) {
    const iso = String(r[0]); // Open-Meteo daily.time (YYYY-MM-DD)
    const target = isoToTemplateRow.get(iso);
    if (!target) continue;

    const dataCells = toSheetDataCells(r, timezone); // returns B.. cells in correct order

    // copy B.. values; keep A (pretty date) as template output
    for (let i = 0; i < dataCells.length; i++) {
      target[i + 1] = dataCells[i] ?? null;
    }
  }

  // -------------------- Sheet values --------------------
  const values: SheetValues = [];

  // NOTE: You are currently writing 6 meta values. Ensure your meta header row matches.
  const metaValueRow: SheetRow = [
    meta?.latitude ?? null,
    meta?.longitude ?? null,
    meta?.elevation ?? null,
    meta?.utc_offset_seconds ?? null,
    meta?.timezone ?? null,
    meta?.timezone_abbreviation ?? null,
    meta?.station_id ?? null,
  ];

  values.push([...metaHeaderRowHuman]);
  values.push(metaValueRow);
  values.push([]); // spacer row

  const monthSections: MonthSection[] = [];
  let currentRow = 4; // 1-based

  let annualSection:
    | { meanRowIndex: number; totalRowIndex: number; recordRowIndex: number }
    | undefined;

  for (let month = 1; month <= 12; month++) {
    const calRows: CalendarRow[] = monthBuckets.get(month) ?? [];
    const rows: SheetRow[] = calRows.map((x) => x.row);

    const monthName = moment
      .utc(`${year}-${String(month).padStart(2, "0")}-01`, "YYYY-MM-DD", true)
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

      meanRow[c - 1] = safeAverageRange(col, dataStartRow, dataEndRow);
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
        ? safeSumRange(col, dataStartRow, dataEndRow)
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
        recordRow[c - 1] = safeMinRange(col, dataStartRow, dataEndRow);
        continue;
      }

      // Bypass precip/snow extremes if below thresholds (blank instead of 0)
      if (varName === "rain_sum") {
        recordRow[c - 1] = safeMaxWithThresholdFormula({
          col,
          startRow: dataStartRow,
          endRow: dataEndRow,
          threshold: THRESHOLDS.RAIN_MM, // etc
        });
        continue;
      }
      if (varName === "snowfall_sum") {
        recordRow[c - 1] = safeMaxWithThresholdFormula({
          col,
          startRow: dataStartRow,
          endRow: dataEndRow,
          threshold: THRESHOLDS.RAIN_MM, // etc
        });
        continue;
      }
      if (varName === "precipitation_sum") {
        recordRow[c - 1] = safeMaxWithThresholdFormula({
          col,
          startRow: dataStartRow,
          endRow: dataEndRow,
          threshold: THRESHOLDS.PRECIP_MM,
        });
        continue;
      }

      recordRow[c - 1] = safeMaxRange(col, dataStartRow, dataEndRow);
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

  // Annual summary (unchanged logic)
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
      // annualMeanRow[c - 1] = `=AVERAGE(${refsFor(col, "mean")})`;
      annualMeanRow[c - 1] = safeAverageRefs(refsFor(col, "mean"));
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
        ? safeSumRefs(refsFor(col, "total"))
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

      annualRecordRow[c - 1] =
        varName === "temperature_2m_min" ||
        varName === "relative_humidity_2m_min"
          ? safeMinRanges(ranges)
          : safeMaxRanges(ranges);
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

// Calendar-only month buckets: stable leap-year behavior, tz-agnostic, always complete.
function buildCalendarMonthBucketsUtc(year: number): MonthCalendarBuckets {
  const buckets: MonthCalendarBuckets = new Map();

  for (let month = 1; month <= 12; month++) {
    const baseUtc = moment.utc(
      `${year}-${String(month).padStart(2, "0")}-01`,
      "YYYY-MM-DD",
      true
    );

    const daysInMonth = baseUtc.daysInMonth();
    const rows: CalendarRow[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const iso = `${year}-${String(month).padStart(2, "0")}-${String(
        day
      ).padStart(2, "0")}`;

      const r: SheetRow = new Array<SheetCell>(COL_COUNT).fill(null);
      r[0] = prettyDateFromIsoUtc(iso); // A column display

      rows.push({ iso, row: r });
    }

    buckets.set(month, rows);
  }

  return buckets;
}
