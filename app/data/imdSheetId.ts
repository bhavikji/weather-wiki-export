import { DEFAULT_TIMEZONE } from "@/app/lib/openMeteo";
import { SheetOption } from "@/app/types/sheet-options.types";
export const IMD_SHEET_OPTIONS: SheetOption[] = [
  {
    label: "Select a spreadsheet...",
    value: "",
    description: "Select a spreadsheet…",
    station_id: 0,
  },
  {
    label: "Itanagar (Met Office)",
    value: "1TqIYGVr9WzrMGcNiaOzZDSIGs7dtiG2SPuOIhKHIVUM",
    description: "Itanagar (Met Office) Weather station spreadsheet",
    latitude: 27.1015532,
    longitude: 93.8266653,
    elevation: 530,
    station_id: 42308,
    utc_offset_seconds: 19800,
    timezone: DEFAULT_TIMEZONE,
  },
  {
    label: "Pasighat (IMD)",
    value: "1XyBzi5LX3pyqJ5jGXPLkO59zGwNHJvveoLrNoZSjVJc",
    description: "Pasighat (IMD) Weather station spreadsheet",
    latitude: 28.0648,
    longitude: 95.337,
    elevation: 157,
    station_id: 42220,
    utc_offset_seconds: 19800,
    timezone: DEFAULT_TIMEZONE,
  },
  {
    label: "Jodhpur (IMD)",
    value: "1FQSNRP3h6RP9V86hJlNI49GZ4tx9ucfIsSJzcCw5q9c",
    description: "Jodhpur (IMD) Weather station spreadsheet",
    latitude: 28.0648,
    longitude: 95.337,
    elevation: 241,
    station_id: 42339,
    utc_offset_seconds: 19800,
    timezone: DEFAULT_TIMEZONE,
  },
];

export const DEFAULT_SHEET_ID: string | null =
  IMD_SHEET_OPTIONS.length > 0 ? IMD_SHEET_OPTIONS[0].value : null;

export function getImdSheetOptions(): SheetOption[] {
  return IMD_SHEET_OPTIONS;
}

export default IMD_SHEET_OPTIONS;
