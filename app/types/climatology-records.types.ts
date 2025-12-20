// app/types/climatology-records.types.ts

export type DailyRecordPoint = {
  value: number;
  isoDate: string; // YYYY-MM-DD
};

export type MonthlyDailyRecordBucket = {
  // Daily candidates for record computations (records selected later in climatology.ts)
  tmax: DailyRecordPoint[]; // temperature_2m_max
  tmin: DailyRecordPoint[]; // temperature_2m_min
  precip: DailyRecordPoint[]; // precipitation_sum (24h total)
  snow: DailyRecordPoint[]; // snowfall_sum (24h total)
};

// Month index (1..12)
export type MonthlyDailyRecordsByMonth = Partial<
  Record<number, MonthlyDailyRecordBucket>
>;
