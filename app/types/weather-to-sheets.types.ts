// app/types/weather-to-sheets.types.ts

/**
 * Raw request body for /api/weather-to-sheets
 * All fields optional at input stage.
 */
export type WeatherToSheetsBody = {
  latitude?: number;
  longitude?: number;
  sheetId?: string; // Google Spreadsheet ID
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
};

/**
 * Fully validated + normalized payload
 * Guaranteed safe to use by the route handler.
 */
export type WeatherToSheetsValidated = {
  latitude: number;
  longitude: number;
  sheetId: string;
  startDate: string;
  endDate: string;
  startYear: number;
  endYear: number;
};
