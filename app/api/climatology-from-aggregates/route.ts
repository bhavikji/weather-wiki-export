import { NextResponse } from "next/server";
import { getSheetsClient } from "@/app/lib/googleSheets";
import { getOrCreateSheetId } from "@/app/lib/sheetsTabHelpers";
import { normalizeError } from "@/app/lib/openMeteoErrors";
import { DEFAULT_TIMEZONE } from "@/app/lib/openMeteo";

import { generateClimatologyMasterFromMonthlyAggregates } from "@/app/lib/climatologyFromAggregates";

export const runtime = "nodejs";

type Body = {
  sheetId?: string;
  startYear?: number;
  endYear?: number;
  timezone?: string;
};

function asInt(x: unknown): number | null {
  const n = typeof x === "number" ? x : Number(String(x ?? "").trim());
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function validateBody(b: Body) {
  const sheetId = String(b.sheetId ?? "").trim();
  if (!sheetId) throw new Error("sheetId is required.");

  const startYear = asInt(b.startYear);
  const endYear = asInt(b.endYear);

  if (startYear == null || startYear < 1800 || startYear > 2500)
    throw new Error("startYear must be a valid year.");
  if (endYear == null || endYear < 1800 || endYear > 2500)
    throw new Error("endYear must be a valid year.");
  if (startYear > endYear) throw new Error("startYear must be <= endYear.");

  const timezone =
    String(b.timezone ?? DEFAULT_TIMEZONE).trim() || DEFAULT_TIMEZONE;

  return { sheetId, startYear, endYear, timezone };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const { sheetId, startYear, endYear, timezone } = validateBody(body);

    const sheets = getSheetsClient();

    await generateClimatologyMasterFromMonthlyAggregates({
      sheets,
      spreadsheetId: sheetId,
      timezone,
      startYear,
      endYear,
      getOrCreateSheetId,
    });

    return NextResponse.json({
      success: true,
      sheetId,
      timezone,
      startYear,
      endYear,
    });
  } catch (err: unknown) {
    const e = normalizeError(err);
    return NextResponse.json(
      { success: false, error: { code: e.code, message: e.message } },
      { status: e.httpStatus }
    );
  }
}
