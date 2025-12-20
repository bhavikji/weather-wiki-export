export type Body = {
  latitude?: number;
  longitude?: number;
  sheetId?: string; // Google Spreadsheet ID (from URL)
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
};
