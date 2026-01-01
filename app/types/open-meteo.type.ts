import { DAILY_VARS } from "@/app/lib/openMeteo";

export type DailyVar = (typeof DAILY_VARS)[number];

export type Meta = {
  latitude?: number;
  longitude?: number;
  elevation?: number;
  utc_offset_seconds?: number;
  timezone: string;
  timezone_abbreviation?: string;
  station_id?: number;
};

export type ArchiveDaily = {
  time: string[];
} & Partial<Record<DailyVar, Array<number | string | null>>>;

export type ArchiveResponse = {
  latitude: number;
  longitude: number;
  elevation: number;
  utc_offset_seconds: number;
  timezone: string;
  timezone_abbreviation: string;
  daily_units?: Record<string, string>;
  daily?: ArchiveDaily;
  error?: boolean;
  reason?: string;
};

export type OpenMeteoRow = Array<string | number | null>;
