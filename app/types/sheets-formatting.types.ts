import { sheets_v4 } from "googleapis";
import { SheetRow } from "@/app/types/sheet-values.types";

export type MonthSection = {
  month: number;
  monthName: string;
  monthHeaderRowIndex: number; // 1-based row index in sheet UI
  colHeaderRowIndex: number; // 1-based
  dataStartRow: number; // 1-based
  dataEndRow: number; // 1-based
  meanRowIndex: number; // 1-based
  totalRowIndex: number; // 1-based
  recordRowIndex: number; // 1-based (Extremes)
};

export type AnnualSection = {
  meanRowIndex: number; // 1-based
  totalRowIndex: number; // 1-based
  recordRowIndex: number; // 1-based
};

export type ApplyFormattingArgs = {
  sheets: sheets_v4.Sheets;
  spreadsheetId: string;
  sheetId: number; // Google sheet tabId
  monthSections: MonthSection[];
  annualSection?: AnnualSection;
};

export type CalendarRow = {
  iso: string; // YYYY-MM-DD
  row: SheetRow; // the actual sheet row array
};
export type MonthCalendar = Map<number, CalendarRow[]>;
