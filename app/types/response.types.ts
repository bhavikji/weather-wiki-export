type DailyUnits = {
  time: string;
  temperature_2m_max: string;
  temperature_2m_min: string;
  rain_sum: string;
  snowfall_sum: string;
  precipitation_sum: string;
  relative_humidity_2m_max: string;
  relative_humidity_2m_min: string;
  relative_humidity_2m_mean: string;
  pressure_msl_mean: string;
  surface_pressure_mean: string;
  cloud_cover_mean: string;
  wind_speed_10m_mean: string;
  daylight_duration: string;
  sunshine_duration: string;
  sunrise: string;
  sunset: string;
};

type DailyData = {
  time: string[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  rain_sum: number[];
  snowfall_sum: number[];
  precipitation_sum: number[];
  relative_humidity_2m_max: number[];
  relative_humidity_2m_min: number[];
  relative_humidity_2m_mean: number[];
  pressure_msl_mean: number[];
  surface_pressure_mean: number[];
  cloud_cover_mean: number[];
  wind_speed_10m_mean: number[];
  daylight_duration: number[];
  sunshine_duration: number[];
  sunrise: string[];
  sunset: string[];
};

export type WeatherApiResponse = {
  latitude: number;
  longitude: number;
  generationtime_ms: number;
  utc_offset_seconds: number;
  timezone: string;
  timezone_abbreviation: string;
  elevation: number;
  daily_units: DailyUnits;
  daily: DailyData;
};
