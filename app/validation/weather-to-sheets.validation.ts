// app/validation/weather-to-sheets.validation.ts
import { cmpIso, isIsoDate } from "@/app/helpers/dateHelpers";
import { domainError } from "@/app/lib/openMeteoErrors";
import {
  WeatherToSheetsBody,
  WeatherToSheetsValidated,
} from "@/app/types/weather-to-sheets.types";
/**
 * Validates + normalizes input for /api/weather-to-sheets
 * - applies defaults for lat/lon when absent
 * - trims sheetId
 * - ensures date format + date ordering
 * - extracts startYear/endYear
 *
 * Throws domainError({ code: "INPUT_VALIDATION", httpStatus: 400 }) on failure.
 */
export function validateWeatherToSheetsBody(
  body: WeatherToSheetsBody,
  defaults?: { latitude?: number; longitude?: number }
): WeatherToSheetsValidated {
  const latitude = body.latitude ?? defaults?.latitude ?? 28.1695;
  const longitude = body.longitude ?? defaults?.longitude ?? 94.8006;

  const sheetId = (body.sheetId ?? "").trim();
  const startDate = body.startDate;
  const endDate = body.endDate;

  // -------------------- Validation --------------------
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw domainError({
      code: "INPUT_VALIDATION",
      message: "Invalid latitude/longitude",
      httpStatus: 400,
    });
  }

  // Optional but recommended: basic bounds check
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw domainError({
      code: "INPUT_VALIDATION",
      message:
        "Latitude must be between -90..90 and longitude between -180..180.",
      httpStatus: 400,
    });
  }

  if (!sheetId) {
    throw domainError({
      code: "INPUT_VALIDATION",
      message: "Google Sheet ID is required.",
      httpStatus: 400,
    });
  }

  if (!isIsoDate(startDate) || !isIsoDate(endDate)) {
    throw domainError({
      code: "INPUT_VALIDATION",
      message: "Start date and end date must be YYYY-MM-DD.",
      httpStatus: 400,
    });
  }

  if (cmpIso(startDate, endDate) > 0) {
    throw domainError({
      code: "INPUT_VALIDATION",
      message: "End date must be on/after start date.",
      httpStatus: 400,
    });
  }

  const startYear = Number(startDate.slice(0, 4));
  const endYear = Number(endDate.slice(0, 4));

  if (!Number.isInteger(startYear) || !Number.isInteger(endYear)) {
    throw domainError({
      code: "INPUT_VALIDATION",
      message: "Invalid year derived from date range.",
      httpStatus: 400,
    });
  }

  // Optional but useful safety: prevent absurdly large ranges
  if (endYear - startYear > 300) {
    throw domainError({
      code: "INPUT_VALIDATION",
      message: "Date range too large. Please request a smaller range.",
      httpStatus: 400,
    });
  }

  return {
    latitude,
    longitude,
    sheetId,
    startDate,
    endDate,
    startYear,
    endYear,
  };
}
