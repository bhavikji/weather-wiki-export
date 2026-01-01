export type SheetOption = {
  /** Human friendly label shown in dropdown */
  label: string;
  /** Google Spreadsheet ID (value actually used by API) */
  value: string;
  /** Optional short description for tooling / accessibility */
  description?: string;
  latitude?: number;
  longitude?: number;
  elevation?: number;
  station_id?: number;
  utc_offset_seconds?: number;
  timezone?: string;
};
