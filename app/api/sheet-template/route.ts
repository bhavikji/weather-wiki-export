import { NextResponse } from "next/server";
import { getSheetsClient } from "@/app/lib/googleSheets";
import { DEFAULT_TIMEZONE } from "@/app/lib/openMeteo";
import { generateYearSheetTemplate } from "@/app/lib/yearSheetTemplate";
import { normalizeError } from "@/app/lib/openMeteoErrors";
import type { Meta } from "@/app/types/open-meteo.type";

export const runtime = "nodejs";

interface TemplateBody extends Meta {
  sheetId?: string;
  year?: unknown;
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s : null;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as TemplateBody;

    const sheetId = typeof body.sheetId === "string" ? body.sheetId.trim() : "";
    const yearNum =
      typeof body.year === "number" ? body.year : Number(body.year);
    const year = Number.isFinite(yearNum) ? Math.trunc(yearNum) : NaN;

    if (!sheetId || !Number.isFinite(year)) {
      return NextResponse.json(
        {
          success: false,
          error: { message: "sheetId (string) and year (number) are required" },
        },
        { status: 400 }
      );
    }

    if (year < 1800 || year > 2200) {
      return NextResponse.json(
        { success: false, error: { message: "year must be 1800–2200" } },
        { status: 400 }
      );
    }

    const sheets = getSheetsClient();

    // Build meta (template-only: no API fetch, so UI must provide these if desired)
    const meta: Meta & { station_id?: number } = {
      latitude: asNumber(body.latitude) ?? undefined,
      longitude: asNumber(body.longitude) ?? undefined,
      elevation: asNumber(body.elevation) ?? undefined,
      utc_offset_seconds: asNumber(body.utc_offset_seconds) ?? undefined,
      timezone: asString(body.timezone) ?? DEFAULT_TIMEZONE,
      timezone_abbreviation: asString(body.timezone_abbreviation) ?? undefined,
      // not part of Open-Meteo Meta type in your codebase; store optionally
      ...(asNumber(body.station_id) != null
        ? { station_id: Math.trunc(asNumber(body.station_id)!) }
        : {}),
    };

    await generateYearSheetTemplate({
      sheets,
      spreadsheetId: sheetId,
      year,
      timezone: meta.timezone ?? DEFAULT_TIMEZONE,
      meta: meta as Meta, // station_id handled separately in builders if you add it
      rawRows: [],
    });

    return NextResponse.json({ success: true, sheetId, year });
  } catch (err: unknown) {
    const e = normalizeError(err);
    return NextResponse.json(
      { success: false, error: { message: e?.message || "Unknown error" } },
      { status: 500 }
    );
  }
}
