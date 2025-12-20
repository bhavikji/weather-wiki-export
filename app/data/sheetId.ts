export type SheetOption = {
  /** Human friendly label shown in dropdown */
  label: string;
  /** Google Spreadsheet ID (value actually used by API) */
  value: string;
  /** Optional short description for tooling / accessibility */
  description?: string;
};

export const SHEET_OPTIONS: SheetOption[] = [
  {
    label: "Aalo",
    value: "17S0IpeyXptm5O9viB3atTJd7p05KxPwacGWe1sHqMeo",
    description: "Aalo Weather station spreadsheet",
  },
];

export const DEFAULT_SHEET_ID: string | null =
  SHEET_OPTIONS.length > 0 ? SHEET_OPTIONS[0].value : null;

export function getSheetOptions(): SheetOption[] {
  return SHEET_OPTIONS;
}

export default SHEET_OPTIONS;
