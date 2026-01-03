// app/api/open-meteo-daily-to-sheets/route.ts
import { NextResponse } from "next/server";
import type { sheets_v4 } from "googleapis";

import { getSheetsClient } from "@/app/lib/googleSheets";
import {
  buildHeaderIndexMap,
  getOrCreateSheetId,
  isEmptyCell,
} from "@/app/lib/sheetsTabHelpers";
import { normalizeError } from "@/app/lib/openMeteoErrors";
import {
  colToA1,
  formatHumidity,
  isoToSheetDateLabel,
  normalizeCellDate,
} from "@/app/lib/helpers";

import {
  DEFAULT_TIMEZONE,
  DAILY_VARS,
  DAILY_VAR_LABELS,
  fetchDailyRowsRange,
} from "@/app/lib/openMeteo";

import { toNum } from "@/app/helpers/computeHelpers";
import { isIsoDate, toHoursFromSeconds } from "@/app/helpers/dateHelpers";
import { formatTimeTo12h } from "@/app/lib/helpers";

export const runtime = "nodejs";

type OpenMeteoDailyToSheetsBody = {
  sheetId?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  date?: unknown; // YYYY-MM-DD
  timezone?: unknown; // currently not used by fetchDailyRowsRange; kept for contract parity
  force?: unknown; // boolean
};

async function readRowAS(args: {
  sheets: sheets_v4.Sheets;
  spreadsheetId: string;
  sheetName: string;
  rowIndex: number;
}) {
  const { sheets, spreadsheetId, sheetName, rowIndex } = args;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A${rowIndex}:S${rowIndex}`,
  });
  const row = res.data.values?.[0] ?? [];
  return row.map((x) => (x == null ? "" : String(x)));
}

async function findDateRowIndex(args: {
  sheets: sheets_v4.Sheets;
  spreadsheetId: string;
  sheetName: string;
  isoDate: string; // YYYY-MM-DD
}): Promise<number | null> {
  const { sheets, spreadsheetId, sheetName, isoDate } = args;

  // Your template writes "31st Dec 2025" style dates in col A
  const sheetLabel = isoToSheetDateLabel(isoDate);
  if (!sheetLabel) return null;

  const want = normalizeCellDate(sheetLabel);

  const colA = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:A`,
  });

  const values = colA.data.values ?? [];
  for (let i = 0; i < values.length; i++) {
    const cell = values[i]?.[0];
    if (normalizeCellDate(cell) === want) return i + 1; // 1-based row
  }
  return null;
}

async function findHeaderRowNear(args: {
  sheets: sheets_v4.Sheets;
  spreadsheetId: string;
  sheetName: string;
  dateRowIndex: number; // 1-based
  scanUpRows?: number; // optional hard cap
}): Promise<{ headerRowIndex: number; headers: string[] } | null> {
  const { sheets, spreadsheetId, sheetName, dateRowIndex } = args;

  // Same robust scan strategy as your IMD route
  const hardCap = Math.max(50, args.scanUpRows ?? 600);

  const normalize = (v: unknown) =>
    String(v ?? "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();

  const requiredFragments = [
    "max temperature",
    "min temperature",
    "mean temperature",
    "dew point",
    "rain (sum)",
    "snowfall (sum)",
    "precipitation (sum)",
    "humidity max",
    "humidity min",
    "humidity mean",
    "pressure",
    "cloud cover",
    "wind speed",
    "daylight duration",
    "sunshine duration",
    "sunrise",
    "sunset",
  ];

  const rowHitCount = (row: unknown[]) => {
    const cells = row.map(normalize).filter(Boolean);
    let hits = 0;
    for (const frag of requiredFragments) {
      if (cells.some((c) => c.includes(frag))) hits++;
    }
    return hits;
  };

  const chunkSize = 200;
  let end = dateRowIndex - 1;
  let scanned = 0;

  while (end >= 1 && scanned < hardCap) {
    const start = Math.max(1, end - chunkSize + 1);

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A${start}:S${end}`,
    });

    const rows = res.data.values ?? [];

    for (let i = rows.length - 1; i >= 0; i--) {
      const row = rows[i] ?? [];
      const hits = rowHitCount(row);

      // 5 is a safe threshold for your header density
      if (hits >= 5) {
        return {
          headerRowIndex: start + i,
          headers: row.map((x) => String(x ?? "").trim()),
        };
      }
    }

    scanned += end - start + 1;
    end = start - 1;
  }

  return null;
}

export async function POST(req: Request) {
  try {
    const body = (await req
      .json()
      .catch(() => ({}))) as OpenMeteoDailyToSheetsBody;

    const sheetId = typeof body.sheetId === "string" ? body.sheetId.trim() : "";
    const isoDate = typeof body.date === "string" ? body.date.trim() : "";
    const force = Boolean(body.force);

    const latitude = toNum(body.latitude);
    const longitude = toNum(body.longitude);

    // Keep for API contract parity; fetchDailyRowsRange currently uses DEFAULT_TIMEZONE internally
    const timezone =
      typeof body.timezone === "string" && body.timezone.trim()
        ? body.timezone.trim()
        : DEFAULT_TIMEZONE;

    if (!sheetId) {
      return NextResponse.json(
        { success: false, error: { message: "sheetId is required" } },
        { status: 400 }
      );
    }
    if (latitude == null || longitude == null) {
      return NextResponse.json(
        {
          success: false,
          error: { message: "latitude and longitude are required" },
        },
        { status: 400 }
      );
    }
    if (!isoDate || !isIsoDate(isoDate)) {
      return NextResponse.json(
        { success: false, error: { message: "date must be YYYY-MM-DD" } },
        { status: 400 }
      );
    }

    const year = Number(isoDate.slice(0, 4));
    const sheetName = String(year);

    const sheets = getSheetsClient();
    await getOrCreateSheetId(sheets, sheetId, sheetName);

    // Fetch exactly one day using your existing open-meteo lib
    // NOTE: currently uses DEFAULT_TIMEZONE inside openMeteo.ts;
    // if you want dynamic timezone, update fetchDailyRowsRange signature to accept timezone.
    const { rows } = await fetchDailyRowsRange(
      latitude,
      longitude,
      isoDate,
      isoDate
    );
    const row = rows[0];

    if (!row || row[0] !== isoDate) {
      throw new Error(
        `OPEN_METEO_DAILY_MISSING: No daily row returned for ${isoDate}`
      );
    }

    // Convert OpenMeteoRow -> { label -> value }
    const computed: Record<string, string | number | null> = {};

    // row shape: [time, ...DAILY_VARS]
    for (let i = 0; i < DAILY_VARS.length; i++) {
      const v = DAILY_VARS[i];
      const label = DAILY_VAR_LABELS[v]; // ✅ correct mapping
      const raw = row[i + 1] ?? null;

      if (v === "daylight_duration" || v === "sunshine_duration") {
        computed[label] = toHoursFromSeconds(toNum(raw));
        continue;
      }

      if (v === "sunrise" || v === "sunset") {
        // Normalize to 12-hour AM/PM (Open-Meteo returns ISO datetimes)
        computed[label] = formatTimeTo12h(
          raw == null ? null : String(raw),
          timezone
        );
        continue;
      }

      // Format humidity values as percent strings (e.g. "76.00%", "100.00%")
      if (
        String(label ?? "")
          .toLowerCase()
          .includes("humidity")
      ) {
        computed[label] = formatHumidity(raw);
        continue;
      }

      // numbers stay numbers; strings stay strings
      computed[label] =
        typeof raw === "number"
          ? raw
          : toNum(raw) ?? (raw == null ? null : String(raw));
    }

    // Find date row in template ("31st Dec 2025" style)
    const dateRowIndex = await findDateRowIndex({
      sheets,
      spreadsheetId: sheetId,
      sheetName,
      isoDate,
    });

    if (!dateRowIndex) {
      const label = isoToSheetDateLabel(isoDate) ?? isoDate;
      return NextResponse.json(
        {
          success: false,
          error: {
            message: `Could not find date row "${label}" in ${sheetName}!A:A`,
          },
        },
        { status: 404 }
      );
    }

    // Find header row above the date
    const headerInfo = await findHeaderRowNear({
      sheets,
      spreadsheetId: sheetId,
      sheetName,
      dateRowIndex,
    });

    if (!headerInfo) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: `Could not locate header row near row ${dateRowIndex}. Ensure the daily header row exists above the date rows.`,
          },
        },
        { status: 422 }
      );
    }

    const headerMap = buildHeaderIndexMap(headerInfo.headers);

    // Read existing row so we do not overwrite unless forced
    const existingRow = await readRowAS({
      sheets,
      spreadsheetId: sheetId,
      sheetName,
      rowIndex: dateRowIndex,
    });

    const updates: Array<{ range: string; value: string | number | null }> = [];

    for (const [label, value] of Object.entries(computed)) {
      const colIndex = headerMap.get(label);
      if (!colIndex) continue;

      const existing = existingRow[colIndex - 1] ?? "";
      const shouldWrite = force || isEmptyCell(existing);
      if (!shouldWrite) continue;

      updates.push({
        range: `${sheetName}!${colToA1(colIndex)}${dateRowIndex}`,
        value,
      });
    }

    if (updates.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: {
          valueInputOption: "USER_ENTERED",
          data: updates.map((u) => ({ range: u.range, values: [[u.value]] })),
        },
      });
    }

    return NextResponse.json({
      success: true,
      sheetId,
      latitude,
      longitude,
      timezone, // echoed
      date: isoDate,
      year,
      wroteCells: updates.length,
    });
  } catch (err: unknown) {
    const e = normalizeError(err);
    return NextResponse.json(
      { success: false, error: { code: e.code, message: e.message } },
      { status: e.httpStatus ?? 500 }
    );
  }
}
