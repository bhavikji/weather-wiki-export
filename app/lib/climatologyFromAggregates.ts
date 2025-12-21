import type { sheets_v4 } from "googleapis";
import { readMonthlyAggregates } from "@/app/lib//readMonthlyAggregates";
import { computeClimatologyFromMonthlyAggregates } from "@/app/lib//computeClimatology";
import { writeClimatologySheetStandalone } from "@/app/lib//writeClimatologySheets";
import { CLIMATOLOGY_MASTER_SHEET } from "@/app/constants";

export async function generateClimatologyMasterFromMonthlyAggregates(args: {
  sheets: sheets_v4.Sheets;
  spreadsheetId: string;
  timezone: string;
  startYear: number;
  endYear: number;
  getOrCreateSheetId: (
    sheets: sheets_v4.Sheets,
    spreadsheetId: string,
    title: string
  ) => Promise<number>;
}) {
  const {
    sheets,
    spreadsheetId,
    timezone,
    startYear,
    endYear,
    getOrCreateSheetId,
  } = args;

  const records = await readMonthlyAggregates({
    sheets,
    spreadsheetId,
    timezone,
  });
  const years = Array.from(new Set(records.map((r) => r.year))).sort(
    (a, b) => a - b
  );

  if (!years.length) return;

  const globalMinYear = years[0];
  const globalMaxYear = years[years.length - 1];

  const { rows, annualRow } = computeClimatologyFromMonthlyAggregates({
    records,
    startYear,
    endYear,
  });

  const isFullRange = startYear === globalMinYear && endYear === globalMaxYear;

  const sheetTitle = isFullRange
    ? CLIMATOLOGY_MASTER_SHEET
    : `Climatology (${startYear}-${endYear})`;

  const tabId = await getOrCreateSheetId(sheets, spreadsheetId, sheetTitle);

  await writeClimatologySheetStandalone({
    sheets,
    spreadsheetId,
    sheetTitle,
    sheetTabId: tabId,
    timezone,
    startYear,
    endYear,
    rows,
    annualRow,
  });
}
