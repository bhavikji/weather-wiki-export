// app/api/reorder-sheets/route.ts
import { NextResponse } from "next/server";
import { google } from "googleapis";
import { DomainError } from "@/app/lib/openMeteoErrors";
import { Body } from "@/app/types/body.types";
import { CLIMATOLOGY_MASTER_SHEET, MONTHLY_AGGREGATES } from "@/app/constants";

export const runtime = "nodejs";

function domainError(e: DomainError): DomainError {
  return e;
}

function normalizeError(err: unknown): DomainError {
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === "string"
      ? err
      : "Unknown error";

  if (/PERMISSION_DENIED/i.test(msg) || /\b403\b/.test(msg)) {
    return domainError({
      code: "SHEETS_FORBIDDEN",
      message:
        "Google Sheets permission denied. Ensure the Sheet is shared with the service account email as Editor, and the Google Sheets API is enabled.",
      httpStatus: 403,
      details: { raw: msg },
    });
  }

  if (/Missing GOOGLE_/i.test(msg)) {
    return domainError({ code: "CONFIG", message: msg, httpStatus: 500 });
  }

  return domainError({ code: "UNKNOWN", message: msg, httpStatus: 500 });
}

function getSheetsClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!email) {
    throw domainError({
      code: "CONFIG",
      message: "Missing GOOGLE_SERVICE_ACCOUNT_EMAIL",
      httpStatus: 500,
    });
  }

  if (!key) {
    throw domainError({
      code: "CONFIG",
      message: "Missing GOOGLE_PRIVATE_KEY",
      httpStatus: 500,
    });
  }

  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth });
}

/**
 * Orders:
 * 1) pinned tabs (exact order)
 * 2) year tabs (title = 4 digits) ascending
 * 3) others alphabetical
 */
/**
 * Orders:
 * 1) pinned fixed tabs (exact order)  -> e.g. "Monthly Aggregates"
 * 2) any tab whose title starts with "Climatology" (dynamic)
 * 3) year tabs (title = 4 digits) ascending
 * 4) others alphabetical
 */
async function reorderAllSheets(args: {
  sheets: ReturnType<typeof getSheetsClient>;
  spreadsheetId: string;
  pinnedTitles: string[];
}) {
  const { sheets, spreadsheetId, pinnedTitles } = args;

  const ss = await sheets.spreadsheets.get({
    spreadsheetId,
    includeGridData: false,
  });

  const all = ss.data.sheets ?? [];

  const entries: Array<{ title: string; sheetId: number }> = [];
  for (const s of all) {
    const title = s.properties?.title;
    const sheetId = s.properties?.sheetId;
    if (typeof title === "string" && typeof sheetId === "number") {
      entries.push({ title, sheetId });
    }
  }

  const pinnedSet = new Set(pinnedTitles);

  const pinnedFixed: Array<{ title: string; sheetId: number }> = [];
  const climatology: Array<{ title: string; sheetId: number }> = [];
  const years: Array<{ title: string; sheetId: number; year: number }> = [];
  const others: Array<{ title: string; sheetId: number }> = [];

  for (const e of entries) {
    // 1) fixed pinned titles (exact match)
    if (pinnedSet.has(e.title)) {
      pinnedFixed.push(e);
      continue;
    }

    // 2) dynamic climatology tabs (anything starting with "Climatology")
    if (/^Climatology/i.test(e.title)) {
      climatology.push(e);
      continue;
    }

    // 3) year tabs
    if (/^\d{4}$/.test(e.title)) {
      const y = Number(e.title);
      if (Number.isInteger(y)) {
        years.push({ ...e, year: y });
        continue;
      }
    }

    // 4) others
    others.push(e);
  }

  // fixed pinned in explicit order
  const pinnedByOrder = pinnedTitles
    .map((t) => pinnedFixed.find((p) => p.title === t))
    .filter((x): x is { title: string; sheetId: number } => Boolean(x));

  // climatology ordering:
  // Prefer:
  // - "Climatology Master" first (if present)
  // - then "Climatology Master (...)" variants
  // - then "Climatology_YYYY_YYYY..." sorted by start year
  // - then the rest alphabetically
  const isMaster = (t: string) => /^Climatology Master\b/i.test(t);
  const matchWindow = (t: string) => {
    // matches: Climatology_1961_1990 (and variants)
    const m = t.match(/Climatology_(\d{4})_(\d{4})/i);
    if (!m) return null;
    return { start: Number(m[1]), end: Number(m[2]) };
  };

  climatology.sort((a, b) => {
    const am = isMaster(a.title);
    const bm = isMaster(b.title);
    if (am !== bm) return am ? -1 : 1;

    const aw = matchWindow(a.title);
    const bw = matchWindow(b.title);
    if (aw && bw) {
      if (aw.start !== bw.start) return aw.start - bw.start;
      return aw.end - bw.end;
    }
    if (aw && !bw) return -1;
    if (!aw && bw) return 1;

    return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
  });

  years.sort((a, b) => a.year - b.year);
  others.sort((a, b) =>
    a.title.localeCompare(b.title, undefined, { sensitivity: "base" })
  );

  const finalOrder = [
    ...pinnedByOrder,
    ...climatology,
    ...years.map(({ title, sheetId }) => ({ title, sheetId })),
    ...others,
  ];

  const requests = finalOrder.map((e, idx) => ({
    updateSheetProperties: {
      properties: { sheetId: e.sheetId, index: idx },
      fields: "index",
    },
  }));

  if (!requests.length) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Body;

    const sheetId = (body.sheetId ?? "").trim();
    if (!sheetId) {
      throw domainError({
        code: "INPUT_VALIDATION",
        message: "Google Sheet ID is required.",
        httpStatus: 400,
      });
    }

    const sheets = getSheetsClient();

    // Put your summary tabs first (add more if you want)
    await reorderAllSheets({
      sheets,
      spreadsheetId: sheetId,
      pinnedTitles: [
        MONTHLY_AGGREGATES,
        CLIMATOLOGY_MASTER_SHEET,
        "Climatology_1961_1990",
        "Climatology_1991_2020",
      ],
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const e = normalizeError(err);
    return NextResponse.json(
      {
        success: false,
        error: { code: e.code, message: e.message, details: e.details },
      },
      { status: e.httpStatus }
    );
  }
}
