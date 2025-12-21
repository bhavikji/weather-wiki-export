// app/api/weather-to-sheets/route.ts
import { NextResponse } from "next/server";

import { fetchDailyRowsRange, DEFAULT_TIMEZONE } from "@/app/lib/openMeteo";
import { applySheetFormatting } from "@/app/lib/sheetsFormatting";

// Extracted helpers
import { getSheetsClient } from "@/app/lib/googleSheets";
import { getOrCreateSheetId } from "@/app/lib/sheetsTabHelpers";
import { normalizeError } from "@/app/lib/openMeteoErrors";
import { clampRangeToYear } from "@/app/helpers/rangeHelpers";
import { buildMonthWiseValues } from "@/app/lib/sheetValueBuilders";

// Monthly aggregates + de-dupe helpers
import {
  buildMonthlyAggregates,
  getMonthlyAggExistingKeys,
  filterOutExistingMonthlyAgg,
  monthlyAggKey,
} from "@/app/lib/monthlyAggregates";
import { THRESHOLDS } from "@/app/lib/thresholds";

import { applyMonthlyAggregatesFormatting } from "@/app/lib/monthlyAggregatesFormatting";

// Types + validator
import type { WeatherToSheetsBody } from "@/app/types/weather-to-sheets.types";
import { validateWeatherToSheetsBody } from "@/app/validation/weather-to-sheets.validation";
import { MONTHLY_AGGREGATES } from "@/app/constants";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as WeatherToSheetsBody;

    const {
      latitude,
      longitude,
      sheetId,
      startDate,
      endDate,
      startYear,
      endYear,
    } = validateWeatherToSheetsBody(body, {
      latitude: 28.1695,
      longitude: 94.8006,
    });

    const sheets = getSheetsClient();

    // -------------------- Monthly Aggregates sheet --------------------
    const aggSheetTabId = await getOrCreateSheetId(
      sheets,
      sheetId,
      MONTHLY_AGGREGATES
    );

    // Write headers once (idempotent)
    const headerCheck = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${MONTHLY_AGGREGATES}!A1`,
    });

    if (!headerCheck.data.values || headerCheck.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${MONTHLY_AGGREGATES}!A1`,
        valueInputOption: "RAW",
        requestBody: {
          values: [
            [
              "Latitude",
              "Longitude",
              "Elevation (m)",
              "Timezone",
              "Data Source",
            ],
            [
              latitude,
              longitude,
              null,
              DEFAULT_TIMEZONE,
              "ERA5-Land (Open-Meteo)",
            ],
            [
              "Year",
              "Month",
              "Mean Tmax (°C)",
              "Mean Tmin (°C)",
              "Mean Temp (°C)",
              "Mean Dew Point (°C)",
              "Mean Relative Humidity (%)",
              "Total Rainfall (mm)",
              `Rainy Days (≥${THRESHOLDS.RAIN_MM} mm)`,
              "Total Snowfall (cm)",
              `Snowy Days (≥${THRESHOLDS.SNOW_CM} cm)`,
              "Total Precipitation (mm)",
              `Wet Days (≥${THRESHOLDS.PRECIP_MM} mm)`,
              "Total Sunshine (hours)",
              "Percent Possible Sunshine (%)",
              "Valid Days",

              "Record High Tmax (°C)",
              "Record High Tmax Date",
              "Record Low Tmin (°C)",
              "Record Low Tmin Date",
              "Record Max 24h Rainfall (mm)",
              "Record Max 24h Rainfall Date",
              "Record Max 24h Snow (cm)",
              "Record Max 24h Snow Date",
              "Record Max 24h Precipitation (mm)",
              "Record Max 24h Precipitation Date",
            ],
          ],
        },
      });

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: {
          requests: [
            {
              updateSheetProperties: {
                properties: {
                  sheetId: aggSheetTabId,
                  gridProperties: { frozenRowCount: 3, frozenColumnCount: 2 },
                },
                fields:
                  "gridProperties.frozenRowCount,gridProperties.frozenColumnCount",
              },
            },
          ],
        },
      });
    }

    await applyMonthlyAggregatesFormatting({
      sheets,
      spreadsheetId: sheetId,
      sheetTabId: aggSheetTabId,
    });

    const existingMonthlyAggKeys = await getMonthlyAggExistingKeys({
      sheets,
      spreadsheetId: sheetId,
      sheetName: MONTHLY_AGGREGATES,
    });

    let metaUpdated = false;

    // -------------------- Year loop --------------------
    for (let year = startYear; year <= endYear; year++) {
      const clipped = clampRangeToYear(year, startDate, endDate);
      if (!clipped) continue;

      const sheetName = String(year);
      const yearSheetTabId = await getOrCreateSheetId(
        sheets,
        sheetId,
        sheetName
      );

      const { meta, rows: rawRows } = await fetchDailyRowsRange(
        latitude,
        longitude,
        clipped.start,
        clipped.end
      );

      // Update Monthly Aggregates meta row with API-provided metadata (elevation, timezone)
      // Write it only once (first successful fetch) to avoid repeated Sheets API calls.
      if (!metaUpdated) {
        try {
          const metaValues = [
            meta.latitude,
            meta.longitude,
            meta.elevation ?? null,
            meta.utc_offset_seconds ?? null,
            meta.timezone ?? DEFAULT_TIMEZONE,
            meta.timezone_abbreviation ?? null,
          ];

          await sheets.spreadsheets.values.update({
            spreadsheetId: sheetId,
            range: `${MONTHLY_AGGREGATES}!A2`,
            valueInputOption: "RAW",
            requestBody: { values: [metaValues] },
          });

          metaUpdated = true;
        } catch (e) {
          // Non-fatal: log and continue if updating meta row fails
          console.warn("Failed to update Monthly Aggregates meta row:", e);
        }
      }

      const { values, monthSections, annualSection } = buildMonthWiseValues({
        year,
        meta,
        rawRows,
        timezone: meta.timezone || DEFAULT_TIMEZONE,
      });

      // Future-proof clear range (daily vars may grow)
      await sheets.spreadsheets.values.clear({
        spreadsheetId: sheetId,
        range: `${sheetName}!A:ZZ`,
      });

      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${sheetName}!A1`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values },
      });

      await applySheetFormatting({
        sheets,
        spreadsheetId: sheetId,
        sheetId: yearSheetTabId,
        monthSections,
        annualSection,
      });

      const monthlyRows = buildMonthlyAggregates(
        year,
        rawRows,
        meta.timezone || DEFAULT_TIMEZONE
      );

      const rowsToAppend = filterOutExistingMonthlyAgg({
        rows: monthlyRows,
        existingKeys: existingMonthlyAggKeys,
      });

      if (rowsToAppend.length > 0) {
        await sheets.spreadsheets.values.append({
          spreadsheetId: sheetId,
          range: `${MONTHLY_AGGREGATES}!A4`,
          valueInputOption: "USER_ENTERED",
          insertDataOption: "INSERT_ROWS",
          requestBody: { values: rowsToAppend },
        });

        for (const r of rowsToAppend) {
          existingMonthlyAggKeys.add(monthlyAggKey(r[0], r[1]));
        }
      }
    }

    // Re-apply Monthly Aggregates formatting after rows have been appended.
    // This ensures columns like "Percent Possible Sunshine (%)" get the
    // PERCENT display format even if formatting was applied earlier.
    try {
      await applyMonthlyAggregatesFormatting({
        sheets,
        spreadsheetId: sheetId,
        sheetTabId: aggSheetTabId,
      });
    } catch (e) {
      // Non-fatal: log and continue
      console.warn("Failed to re-apply Monthly Aggregates formatting:", e);
    }

    return NextResponse.json({
      success: true,
      latitude,
      longitude,
      startYear,
      endYear,
    });
  } catch (err: unknown) {
    const e = normalizeError(err);
    return NextResponse.json(
      {
        success: false,
        error: { code: e.code, message: e.message },
      },
      { status: e.httpStatus }
    );
  }
}
