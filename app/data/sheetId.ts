export type SheetOption = {
  /** Human friendly label shown in dropdown */
  label: string;
  /** Google Spreadsheet ID (value actually used by API) */
  value: string;
  /** Optional short description for tooling / accessibility */
  description?: string;
  latitude?: number;
  longitude?: number;
};

export const SHEET_OPTIONS: SheetOption[] = [
  {
    label: "Select a spreadsheet...",
    value: "",
    description: "Select a spreadsheet…",
  },
  {
    label: "Aalo",
    value: "17S0IpeyXptm5O9viB3atTJd7p05KxPwacGWe1sHqMeo",
    description: "Aalo Weather station spreadsheet",
    latitude: 28.1695,
    longitude: 94.8006,
  },
  {
    label: "Anini",
    value: "1QnIXcyHo9YHqL_bt3q-QkzXsUJDWAx52DBZl2lRrUNk",
    description: "Anini Weather station spreadsheet",
    latitude: 28.7972,
    longitude: 95.9048,
  },
  {
    label: "Basar",
    value: "1JDiURUtrHKhkjQMgVssByFjtFve22MX7le67KlhIFzc",
    description: "Basar Weather station spreadsheet",
    latitude: 27.9826,
    longitude: 94.6898,
  },
  {
    label: "Boleng",
    value: "1K6A42f3ZmCzhVN69ZPCKoCQc_O5hNBtDEGWznFFyIzY",
    description: "Boleng Weather station spreadsheet",
    latitude: 28.335,
    longitude: 94.961,
  },
];

export const DEFAULT_SHEET_ID: string | null =
  SHEET_OPTIONS.length > 0 ? SHEET_OPTIONS[0].value : null;

export function getSheetOptions(): SheetOption[] {
  return SHEET_OPTIONS;
}

export default SHEET_OPTIONS;
