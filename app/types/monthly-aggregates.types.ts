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
  number, // valid days
  number | null, // record high tmax
  string | null, // record high tmax date
  number | null, // record low tmin
  string | null, // record low tmin date
  number | null, // record max 24h rainfall
  string | null, // record max 24h rainfall date
  number | null, // record max 24h snow (cm)
  string | null, // record max 24h snow date
  number | null, // record max 24h precipitation
  string | null // record max 24h precipitation date
];
