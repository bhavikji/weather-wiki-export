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
 * Climatology Master columns (A..AA) = 27 cols:
 * A  Month                         idx 1
 * B  Mean Tmax (°C)                idx 2
 * C  Mean Tmin (°C)                idx 3
 * D  Mean Temp (°C)                idx 4
 * E  Mean Dew Point (°C)           idx 5
 * F  Mean Relative Humidity (%)    idx 6
 * G  Mean Rainfall (mm)            idx 7
 * H  Mean Rainy Days (days)        idx 8
 * I  Mean Snowfall (cm)            idx 9
 * J  Mean Snowy Days (days)        idx 10
 * K  Mean Monthly Precipitation (mm) idx 11
 * L  Mean Wet Days (days)          idx 12
 * M  Mean Sunshine (hours)        idx 13
 * N  Mean Percent Possible Sunshine (%)  (0..1 stored) idx 14
 * O  N (years)                     idx 15
 * P  Warmest Monthly Mean Tmax (°C)  idx 16
 * Q  Coldest Monthly Mean Tmin (°C)  idx 17
 * R  Wettest Monthly Total (mm)  idx 18
 * S  Wettest Monthly Total Year  idx 19
 * T  Record High Tmax (°C)        idx 20
 * U  Record High Tmax Date      idx 21
 * V  Record Low Tmin (°C)       idx 22
 * W  Record Low Tmin Date     idx 23
 * X  Record Max 24h Precipitation (mm) idx 24
 * Y  Record Max 24h Precipitation Date idx 25
 * Z  Record Max 24h Snow (cm)       idx 26
 * AA Record Max 24h Snow Date  idx 27
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
  number | null, // P Warmest Monthly Mean Tmax
  number | null, // Q Coldest Monthly Mean Tmin
  number | null, // R Wettest Monthly Total
  number | null, // S Wettest Monthly Total Year

  number | null, // T Record High Tmax
  string | null, // U Record High Tmax Date
  number | null, // V Record Low Tmin
  string | null, // W Record Low Tmin Date
  number | null, // X Record Max 24h Precip
  string | null, // Y Record Max 24h Precip Date
  number | null, // Z Record Max 24h Snow
  string | null // AA Record Max 24h Snow Date
];
