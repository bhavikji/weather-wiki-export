export type MonthlyAggregateRow = [
  number, // year
  string, // month name
  number | null, // mean tmax
  number | null, // mean tmin
  number | null, // mean temp (new)
  number | null, // mean dew point
  number | null, // mean RH
  number | null, // Total Rainfall (mm)
  number, // Rainy Days (days)
  number | null, // Total Snowfall (cm)
  number, // Snowy Days (days)
  number | null, // Total Precipitation (mm)
  number, // Wet Days (days)
  number | null, // sunshine hours
  number | null, // percent possible sunshine
  number // valid days
];
