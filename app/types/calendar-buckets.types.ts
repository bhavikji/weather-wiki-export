// app/types/calendar-buckets.types.ts

import { SheetRow } from "@/app/types/sheet-values.types";

export type CalendarRow = {
  iso: string; // YYYY-MM-DD (join key with Open-Meteo daily.time)
  row: SheetRow; // actual sheet row array (A..)
};

export type MonthCalendarBuckets = Map<number, CalendarRow[]>;
