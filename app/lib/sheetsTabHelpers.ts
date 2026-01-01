// app/lib/sheetsTabHelpers.ts
import type { sheets_v4 } from "googleapis";
import { domainError } from "./openMeteoErrors";

export async function getOrCreateSheetId(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  title: string
): Promise<number> {
  const existing = await sheets.spreadsheets.get({
    spreadsheetId,
    includeGridData: false,
  });

  const found = existing.data.sheets?.find(
    (s) => s.properties?.title === title
  );
  if (found?.properties?.sheetId != null) return found.properties.sheetId;

  const created = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [{ addSheet: { properties: { title } } }] },
  });

  const reply = created.data.replies?.[0]?.addSheet?.properties?.sheetId;
  if (reply == null) {
    throw domainError({
      code: "UNKNOWN",
      message: `Failed to create sheet tab '${title}'`,
      httpStatus: 500,
    });
  }
  return reply;
}

export const isEmptyCell = (v: string) => {
  const s = String(v ?? "").trim();
  return s === "" || s === "—";
};

export const buildHeaderIndexMap = (headers: string[]) => {
  const m = new Map<string, number>(); // header -> 1-based col index
  for (let i = 0; i < headers.length; i++) {
    const h = String(headers[i] ?? "").trim();
    if (h) m.set(h, i + 1);
  }
  return m;
};
