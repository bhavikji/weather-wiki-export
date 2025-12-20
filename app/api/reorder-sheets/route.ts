// app/api/reorder-sheets/route.ts
import { NextResponse } from "next/server";
import { google } from "googleapis";
import { DomainError } from "@/app/lib/openMeteoErrors";
import { Body } from "@/app/types/body.types";

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

  const pinned: Array<{ title: string; sheetId: number }> = [];
  const years: Array<{ title: string; sheetId: number; year: number }> = [];
  const others: Array<{ title: string; sheetId: number }> = [];

  for (const e of entries) {
    if (pinnedSet.has(e.title)) {
      pinned.push(e);
      continue;
    }
    if (/^\d{4}$/.test(e.title)) {
      const y = Number(e.title);
      if (Number.isInteger(y)) {
        years.push({ ...e, year: y });
        continue;
      }
    }
    others.push(e);
  }

  const pinnedByOrder = pinnedTitles
    .map((t) => pinned.find((p) => p.title === t))
    .filter((x): x is { title: string; sheetId: number } => Boolean(x));

  years.sort((a, b) => a.year - b.year);
  others.sort((a, b) =>
    a.title.localeCompare(b.title, undefined, { sensitivity: "base" })
  );

  const finalOrder = [
    ...pinnedByOrder,
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
        "Monthly Aggregates",
        "Climatology Master",
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
