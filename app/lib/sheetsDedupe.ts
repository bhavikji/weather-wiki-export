// app/lib/sheetsDedupe.ts
import type { sheets_v4 } from "googleapis";

export type SheetCell = string | number | boolean | null;
export type SheetRow = SheetCell[];

function normCell(v: unknown): string {
  return String(v ?? "")
    .trim()
    .toLowerCase();
}

/**
 * Builds a stable row-key from selected column indices.
 * Example: keyColumns=[0,1] => Year + Month
 */
export function buildRowKeyFromColumns(
  row: readonly unknown[],
  keyColumns: number[]
): string | null {
  const parts: string[] = [];

  for (const idx of keyColumns) {
    const s = normCell(row[idx]);
    if (!s) return null; // if any key-part missing => no key
    parts.push(s);
  }

  return parts.join("|");
}

/**
 * Reads a range and returns a Set of keys computed from `keyColumns`.
 *
 * Pass a narrow range for performance, e.g. "Monthly Aggregates!A4:B"
 * and keyColumns=[0,1].
 */
export async function getExistingKeysFromRange(args: {
  sheets: sheets_v4.Sheets;
  spreadsheetId: string;
  rangeA1: string;
  keyColumns: number[];
}): Promise<Set<string>> {
  const { sheets, spreadsheetId, rangeA1, keyColumns } = args;

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: rangeA1,
  });

  const values = (res.data.values ?? []) as unknown[][];
  const keys = new Set<string>();

  for (const row of values) {
    const key = buildRowKeyFromColumns(row, keyColumns);
    if (key) keys.add(key);
  }

  return keys;
}

/**
 * Filters out rows whose computed key is already present.
 * `rowToKey` lets you build keys from strongly typed rows.
 */
export function filterOutExistingRows<T>(args: {
  rows: T[];
  existingKeys: Set<string>;
  rowToKey: (row: T) => string | null;
}): T[] {
  const { rows, existingKeys, rowToKey } = args;

  const out: T[] = [];
  for (const r of rows) {
    const k = rowToKey(r);
    if (!k) continue; // skip bad rows silently (or throw if you prefer)
    if (!existingKeys.has(k)) out.push(r);
  }
  return out;
}
