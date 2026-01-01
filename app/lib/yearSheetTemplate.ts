// app/lib/yearSheetTemplate.ts
import { DEFAULT_TIMEZONE } from "@/app/lib/openMeteo";
import { getOrCreateSheetId } from "@/app/lib/sheetsTabHelpers";
import { buildMonthWiseValues } from "@/app/lib/sheetValueBuilders";
import { applySheetFormatting } from "@/app/lib/sheetsFormatting";
import { sheets_v4 } from "googleapis";
import { Meta, OpenMeteoRow } from "@/app/types/open-meteo.type";

export async function generateYearSheetTemplate(args: {
  sheets: sheets_v4.Sheets; // sheets_v4.Sheets
  spreadsheetId: string;
  year: number;
  timezone?: string;

  // meta is used by your builders (elevation/timezone labels etc.)
  // rawRows drives computed totals/extremes; for template-only, pass empty.
  meta?: Meta;
  rawRows?: OpenMeteoRow[];
}) {
  const {
    sheets,
    spreadsheetId,
    year,
    timezone = DEFAULT_TIMEZONE,
    meta = { timezone },
    rawRows = [],
  } = args;

  const sheetName = String(year);
  const yearSheetTabId = await getOrCreateSheetId(
    sheets,
    spreadsheetId,
    sheetName
  );

  const { values, monthSections, annualSection } = buildMonthWiseValues({
    year,
    meta,
    rawRows,
    timezone,
  });

  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${sheetName}!A:ZZ`,
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });

  await applySheetFormatting({
    sheets,
    spreadsheetId,
    sheetId: yearSheetTabId,
    monthSections,
    annualSection,
  });

  return { sheetName, yearSheetTabId, monthSections, annualSection };
}
