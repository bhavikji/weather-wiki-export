export type RecordPair = {
  value: number | null;
  date: string | null; // keep as string (already in "11th Jan 1940")
};

export type MonthlyAggRecord = {
  year: number;
  monthName: string; // "January"
  monthIndex: number; // 1..12

  meanTmax: number | null;
  meanTmin: number | null;
  meanTemp: number | null;
  meanDewPoint: number | null;
  meanRh: number | null;

  totalRain: number | null;
  rainyDays: number | null;

  totalSnow: number | null;
  snowyDays: number | null;

  totalPrecip: number | null;
  wetDays: number | null;

  totalSunshineHours: number | null;
  percentPossibleSunshineFrac: number | null; // 0..1
  validDays: number | null;

  // month-year record columns (already computed upstream)
  recordHighTmax: RecordPair;
  recordLowTmin: RecordPair;

  recordMax24hRain: RecordPair;
  recordMax24hSnow: RecordPair;
  recordMax24hPrecip: RecordPair;
};

export type ClimoRow = Array<string | number | null>;
