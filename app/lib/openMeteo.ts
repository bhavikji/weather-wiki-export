// app/lib/openMeteo.ts
import type {
  ArchiveDaily,
  ArchiveResponse,
  DailyVar,
  Meta,
  OpenMeteoRow,
} from "@/app//types/open-meteo.type";

export const ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive";
export const DEFAULT_TIMEZONE = "Asia/Kolkata";

export const DAILY_VARS = [
  "temperature_2m_max",
  "temperature_2m_min",
  "temperature_2m_mean",
  "dew_point_2m_mean",
  "rain_sum",
  "snowfall_sum",
  "precipitation_sum",
  "relative_humidity_2m_max",
  "relative_humidity_2m_min",
  "relative_humidity_2m_mean",
  "pressure_msl_mean",
  "surface_pressure_mean",
  "cloud_cover_mean",
  "wind_speed_10m_mean",
  "daylight_duration",
  "sunshine_duration",
  "sunrise",
  "sunset",
] as const;

export const HUMIDITY_VARS: readonly DailyVar[] = [
  "relative_humidity_2m_max",
  "relative_humidity_2m_min",
  "relative_humidity_2m_mean",
] as const;

// ---------- Human readable headers (meta + daily) ----------
export const metaHeaderRowHuman = [
  "Latitude",
  "Longitude",
  "Elevation (m)",
  "UTC offset (seconds)",
  "Timezone",
  "Timezone abbreviation",
] as const;

export const metaHeaderRow = [
  "latitude",
  "longitude",
  "elevation",
  "utc_offset_seconds",
  "timezone",
  "timezone_abbreviation",
] as const;

// Stable mapping: DAILY_VARS order remains the source of truth.
export const DAILY_VAR_LABELS: Record<DailyVar, string> = {
  temperature_2m_max: "Max temperature (2m) (°C)",
  temperature_2m_min: "Min temperature (2m) (°C)",
  temperature_2m_mean: "Mean temperature (2m) (°C)",
  dew_point_2m_mean: "Dew point mean (2m) (°C)",
  rain_sum: "Rain (sum) mm",
  snowfall_sum: "Snowfall (sum) cm",
  precipitation_sum: "Precipitation (sum) mm",
  relative_humidity_2m_max: "Humidity max (2m) (%)",
  relative_humidity_2m_min: "Humidity min (2m) (%)",
  relative_humidity_2m_mean: "Humidity mean (2m) (%)",
  pressure_msl_mean: "MSL pressure (mean) (hPa)",
  surface_pressure_mean: "Surface pressure (mean)",
  cloud_cover_mean: "Cloud cover (mean) (%)",
  wind_speed_10m_mean: "Wind speed (10m mean) (km/h)",
  daylight_duration: "Daylight duration (hrs)",
  sunshine_duration: "Sunshine duration (hrs)",
  sunrise: "Sunrise",
  sunset: "Sunset",
} as const;

export const headerRowHuman = [
  "Date",
  ...DAILY_VARS.map((v) => DAILY_VAR_LABELS[v]),
] as const;

export const headerRow = ["time", ...DAILY_VARS] as const;

export function buildArchiveUrl(params: {
  latitude: number;
  longitude: number;
  start_date: string;
  end_date: string;
  daily: readonly string[];
  timezone: string;
  models?: string;
}) {
  const u = new globalThis.URL(ARCHIVE_URL);
  u.searchParams.set("latitude", String(params.latitude));
  u.searchParams.set("longitude", String(params.longitude));
  u.searchParams.set("start_date", params.start_date);
  u.searchParams.set("end_date", params.end_date);
  u.searchParams.set("daily", params.daily.join(","));
  u.searchParams.set("timezone", params.timezone);
  if (params.models) u.searchParams.set("models", params.models);
  return u.toString();
}

function requireDaily(
  json: ArchiveResponse,
  ctx: { intendedUrl: string; start_date: string; end_date: string }
): ArchiveDaily {
  if (!json.daily) {
    throw new Error(
      `OPEN_METEO_MISSING_DAILY: Response missing 'daily' for range=${ctx.start_date}..${ctx.end_date}. Intended URL: ${ctx.intendedUrl}`
    );
  }
  return json.daily;
}

function requireTime(
  daily: ArchiveDaily,
  ctx: { intendedUrl: string; start_date: string; end_date: string }
): string[] {
  const t = daily.time;
  if (!Array.isArray(t) || t.length === 0) {
    throw new Error(
      `OPEN_METEO_MISSING_TIME: daily.time is missing/empty for range=${ctx.start_date}..${ctx.end_date}. Intended URL: ${ctx.intendedUrl}`
    );
  }
  return t;
}

function requireDailyField(
  daily: ArchiveDaily,
  key: DailyVar,
  ctx: { intendedUrl: string; start_date: string; end_date: string }
): Array<number | string | null> {
  const v = daily[key];
  if (!Array.isArray(v)) {
    throw new Error(
      `OPEN_METEO_MISSING_VARIABLE: Missing daily field '${key}' for range=${ctx.start_date}..${ctx.end_date}. Intended URL: ${ctx.intendedUrl}`
    );
  }
  return v;
}

/**
 * ✅ fetch daily rows for any date range (inclusive) that Open-Meteo supports.
 */
export async function fetchDailyRowsRange(
  lat: number,
  lon: number,
  start_date: string,
  end_date: string
): Promise<{
  meta: Meta;
  rows: OpenMeteoRow[];
  intendedUrl: string;
}> {
  const intendedUrl = buildArchiveUrl({
    latitude: lat,
    longitude: lon,
    start_date,
    end_date,
    daily: DAILY_VARS,
    timezone: DEFAULT_TIMEZONE,
  });

  console.log("[OpenMeteo] Intended request:", intendedUrl);

  const res = await fetch(intendedUrl, { method: "GET" });
  const json = (await res.json()) as ArchiveResponse;

  if (!res.ok || json.error) {
    const reason = json.reason ?? `HTTP_${res.status}`;
    throw new Error(
      `OPEN_METEO_BAD_REQUEST: ${reason}. Intended URL: ${intendedUrl}`
    );
  }

  const ctx = { intendedUrl, start_date, end_date };
  const daily = requireDaily(json, ctx);
  const time = requireTime(daily, ctx);

  const cols = DAILY_VARS.map((k) => {
    const arr = requireDailyField(daily, k, ctx);
    if (arr.length !== time.length) {
      throw new Error(
        `OPEN_METEO_LENGTH_MISMATCH: daily.${k} length mismatch. Intended URL: ${intendedUrl}`
      );
    }
    return arr;
  });

  const rows: OpenMeteoRow[] = time.map((d, i) => [
    d,
    ...cols.map((arr) => arr[i] ?? null),
  ]);

  const meta: Meta = {
    latitude: json.latitude,
    longitude: json.longitude,
    elevation: json.elevation,
    utc_offset_seconds: json.utc_offset_seconds,
    timezone: json.timezone,
    timezone_abbreviation: json.timezone_abbreviation,
  };

  return { meta, rows, intendedUrl };
}

/**
 * ✅ Backwards-compatible helper
 */
export async function fetchYearDailyRows(
  lat: number,
  lon: number,
  year: number
) {
  return fetchDailyRowsRange(lat, lon, `${year}-01-01`, `${year}-12-31`);
}
