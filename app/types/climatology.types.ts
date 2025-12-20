// app/types/climatology.types.ts

export type RecordPair = [number | null, string | null];

export type DailyRecord = {
  value: number;
  isoDate: string; // YYYY-MM-DD
};

export type ExistingMonthlyRecords = {
  recHighTmax: RecordPair;
  recLowTmin: RecordPair;
  recMaxPrecip: RecordPair;
  recMaxSnow: RecordPair;
};

export type YearMonthAgg = {
  year: number;
  monthIdx: number; // 1..12

  tmax: number | null;
  tmin: number | null;
  tmean: number | null;

  // New: separate rainfall (from rain_sum) and precipitation (from precipitation_sum)
  rain: number | null; // total rainfall for the month (mm) derived from rain_sum
  rainyDays: number | null;

  snowfall: number | null; // total snowfall for the month (cm)
  snowyDays: number | null;

  dew: number | null;

  rh: number | null;
  precip: number | null; // total precipitation (mm)
  wetDays: number | null; // days with precipitation >= PRECIP_MM

  sunshine: number | null; // hours
  sunshinePct: number | null; // 0..1 (format as % in Sheets)

  validDays: number | null;
};

/**
 * IMPORTANT: keep this tuple aligned with the Climatology Master sheet columns:
 *
 * A Month
 * B Mean Tmax (°C)
 * C Mean Tmin (°C)
 * D Mean Temp (°C)
 * E Mean Dew Point (°C)
 * F Mean Relative Humidity (%)
 * G Mean Rainfall (mm)
 * H Mean Rainy Days (days)
 * I Mean Snowfall (cm)
 * J Mean Snowy Days (days)
 * K Mean Monthly Precipitation (mm)
 * L Mean Wet Days (days)
 * M Mean Sunshine (hours)
 * N Mean Percent Possible Sunshine (%)  (0..1 stored)
 * O N (years)
 * N Warmest Monthly Mean Tmax (°C)
 * O Coldest Monthly Mean Tmin (°C)
 * P Wettest Monthly Total (mm)
 * Q Wettest Monthly Total Year
 * R Record High Tmax (°C)
 * S Record High Tmax Date
 * T Record Low Tmin (°C)
 * U Record Low Tmin Date
 * V Record Max 24h Precipitation (mm)
 * W Record Max 24h Precipitation Date
 * X Record Max 24h Snow (mm)
 * Y Record Max 24h Snow Date
 */
export type ClimoMonthRow = [
  string, // A Month label

  number | null, // B Mean Tmax
  number | null, // C Mean Tmin
  number | null, // D Mean Temp
  number | null, // E Mean Dew Point
  number | null, // F Mean Relative Humidity
  number | null, // G Mean Rainfall (mm)
  number | null, // H Mean Rainy Days (days)
  number | null, // I Mean Snowfall (cm)
  number | null, // J Mean Snowy Days (days)
  number | null, // K Mean Monthly Precipitation (mm)
  number | null, // L Mean Wet Days (days)
  number | null, // M Mean Sunshine (hours)
  number | null, // N Mean Percent Possible Sunshine (0..1)

  number | null, // O N (years)
  number | null, // N Warmest Monthly Mean Tmax
  number | null, // O Coldest Monthly Mean Tmin
  number | null, // P Wettest Monthly Total
  number | null, // Q Wettest Monthly Total Year

  number | null, // R Record High Tmax
  string | null, // S Record High Tmax Date
  number | null, // T Record Low Tmin
  string | null, // U Record Low Tmin Date
  number | null, // V Record Max 24h Precip
  string | null, // W Record Max 24h Precip Date
  number | null, // X Record Max 24h Snow
  string | null // Y Record Max 24h Snow Date
];
