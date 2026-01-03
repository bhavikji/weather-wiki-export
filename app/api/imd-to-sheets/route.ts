// app/api/imd-to-sheets/route.ts
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
  formatTimeTo12h,
} from "@/app/lib/helpers";
import { isIsoDate } from "@/app/helpers/dateHelpers";
import { toNum } from "@/app/helpers/computeHelpers";

export const runtime = "nodejs";

type ImdToSheetsBody = {
  sheetId?: unknown;
  stationId?: unknown;
  date?: unknown; // YYYY-MM-DD
  force?: unknown; // boolean
};

type ImdStaticRow0 = {
  station_id?: string;
  dat?: string;
  max?: string;
  min?: string;
  rainfall?: string;
  rh0830?: string;
  rh1730?: string;
  sunrise?: string;
  sunset?: string;
  status?: number;
};

type ImdStaticResponse = [ImdStaticRow0, Record<string, unknown>];

function mean2(a: number | null, b: number | null): number | null {
  if (a == null || b == null) return null;
  return Math.round(((a + b) / 2) * 10) / 10; // 1 decimal
}

async function fetchImdCityStatic(
  stationId: string
): Promise<ImdStaticResponse> {
  const url =
    "https://city.imd.gov.in/citywx/responsive/api/fetchCity_static.php";

  // Prefer POST (PHP endpoints often expect it)
  try {
    const form = new URLSearchParams();
    form.set("ID", stationId);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Accept: "application/json,text/plain,*/*",
      },
      body: form.toString(),
      cache: "no-store",
    });

    if (res.ok) {
      const data = (await res.json()) as unknown;
      if (Array.isArray(data) && data.length >= 1)
        return data as ImdStaticResponse;
    }
  } catch {
    // fallthrough
  }

  // GET fallback
  const res2 = await fetch(`${url}?ID=${encodeURIComponent(stationId)}`, {
    method: "GET",
    headers: { Accept: "application/json,text/plain,*/*" },
    cache: "no-store",
  });

  if (!res2.ok) throw new Error(`IMD request failed (${res2.status})`);

  const data2 = (await res2.json()) as unknown;
  if (!Array.isArray(data2) || data2.length < 1) {
    throw new Error("Unexpected IMD response shape");
  }
  return data2 as ImdStaticResponse;
}

async function findDateRowIndex(args: {
  sheets: sheets_v4.Sheets;
  spreadsheetId: string;
  sheetName: string;
  isoDate: string; // YYYY-MM-DD
}): Promise<number | null> {
  const { sheets, spreadsheetId, sheetName, isoDate } = args;

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

  // Allow deep scans. Typical month blocks can be 30–60 rows plus padding.
  const hardCap = Math.max(50, args.scanUpRows ?? 600);

  const normalize = (v: unknown) =>
    String(v ?? "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();

  // Match on fragments (robust to minor header text changes)
  const requiredFragments = [
    "max temperature",
    "min temperature",
    "mean temperature",
    "rain (sum)",
    "precipitation (sum)",
    "humidity max",
    "humidity min",
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

  // Scan upward in chunks to avoid giant reads
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

    // Search from bottom-most row upward (closest header first)
    for (let i = rows.length - 1; i >= 0; i--) {
      const row = rows[i] ?? [];
      const hits = rowHitCount(row);

      // If it matches enough expected columns, treat it as the header row
      // (4 is a good threshold; adjust to 3 if your header row is shorter)
      if (hits >= 4) {
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

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as ImdToSheetsBody;

    const sheetId = typeof body.sheetId === "string" ? body.sheetId.trim() : "";
    const stationId =
      typeof body.stationId === "string" ? body.stationId.trim() : "";
    const isoDate = typeof body.date === "string" ? body.date.trim() : "";
    const force = Boolean(body.force);

    if (!sheetId) {
      return NextResponse.json(
        { success: false, error: { message: "sheetId is required" } },
        { status: 400 }
      );
    }
    if (!stationId) {
      return NextResponse.json(
        { success: false, error: { message: "stationId is required" } },
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

    // Fetch IMD data
    const imd = await fetchImdCityStatic(stationId);
    const row0 = (imd?.[0] ?? {}) as ImdStaticRow0;

    // Guard: this endpoint is typically "current day" for the station
    if (!row0.dat || row0.dat !== isoDate) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: `IMD payload dat=${
              row0.dat ?? "null"
            } does not match requested date=${isoDate}. This endpoint appears to be "current day".`,
          },
        },
        { status: 409 }
      );
    }

    // Extract + map
    const tMax = toNum(row0.max);
    const tMin = toNum(row0.min);
    const tMean = mean2(tMax, tMin);

    const rainfall = toNum(row0.rainfall);
    const precip = rainfall;

    const rh0830 = row0.rh0830;
    const rh1730 = row0.rh1730;

    const rhMin = rh0830 ?? null;
    const rhMax = rh1730 ?? null;
    const rhMean = mean2(toNum(rh0830), toNum(rh1730));

    // Normalize times to 12-hour format (e.g. "06:02 AM")
    const sunrise = formatTimeTo12h(row0.sunrise);
    const sunset = formatTimeTo12h(row0.sunset);

    // Locate row
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

    // Find header row + map
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

    // Read existing row so we don't overwrite by default
    const existingRow = await readRowAS({
      sheets,
      spreadsheetId: sheetId,
      sheetName,
      rowIndex: dateRowIndex,
    });

    const targets: Array<{ header: string; value: string | number | null }> = [
      { header: "Max temperature (2m) (°C)", value: tMax },
      { header: "Min temperature (2m) (°C)", value: tMin },
      { header: "Mean temperature (2m) (°C)", value: tMean },

      { header: "Rain (sum) mm", value: rainfall },
      { header: "Snowfall (sum) cm", value: 0 },
      { header: "Precipitation (sum) mm", value: precip },

      { header: "Humidity max (2m) (%)", value: formatHumidity(rhMax) },
      { header: "Humidity min (2m) (%)", value: formatHumidity(rhMin) },
      { header: "Humidity mean (2m) (%)", value: formatHumidity(rhMean) },

      { header: "Sunrise", value: sunrise },
      { header: "Sunset", value: sunset },
    ];

    const updates: Array<{ range: string; value: string | number | null }> = [];

    for (const t of targets) {
      const colIndex = headerMap.get(t.header);
      if (!colIndex) continue; // header not present; safe skip

      // existingRow is A:S; colIndex is 1-based
      const existing = existingRow[colIndex - 1] ?? "";
      const shouldWrite = force || isEmptyCell(existing);
      if (!shouldWrite) continue;

      updates.push({
        range: `${sheetName}!${colToA1(colIndex)}${dateRowIndex}`,
        value: t.value,
      });
    }

    if (updates.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: {
          valueInputOption: "USER_ENTERED",
          data: updates.map((u) => ({
            range: u.range,
            values: [[u.value]],
          })),
        },
      });
    }

    return NextResponse.json({
      success: true,
      sheetId,
      stationId,
      date: isoDate,
      wroteCells: updates.length,
      year,
    });
  } catch (err: unknown) {
    const e = normalizeError(err);
    return NextResponse.json(
      { success: false, error: { code: e.code, message: e.message } },
      { status: e.httpStatus ?? 500 }
    );
  }
}
