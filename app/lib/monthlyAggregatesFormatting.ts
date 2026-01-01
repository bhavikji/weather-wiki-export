// app/lib/monthlyAggregatesFormatting.ts
import type { sheets_v4 } from "googleapis";
import { MONTHLY_AGGREGATES } from "@/app/constants";

const BIG_END_ROW = 200000;

// Utility: build a GridRange
function gridRange(args: {
  sheetId: number;
  startRowIndex: number;
  endRowIndex: number;
  startColumnIndex: number;
  endColumnIndex: number;
}): sheets_v4.Schema$GridRange {
  return {
    sheetId: args.sheetId,
    startRowIndex: args.startRowIndex,
    endRowIndex: args.endRowIndex,
    startColumnIndex: args.startColumnIndex,
    endColumnIndex: args.endColumnIndex,
  };
}

function repeatCell(args: {
  range: sheets_v4.Schema$GridRange;
  cell: sheets_v4.Schema$CellData;
  fields: string;
}): sheets_v4.Schema$Request {
  return {
    repeatCell: {
      range: args.range,
      cell: args.cell,
      fields: args.fields,
    },
  };
}

function numberFormatReq(args: {
  sheetId: number;
  col0: number;
  type: "NUMBER" | "PERCENT";
  pattern: string;
}): sheets_v4.Schema$Request {
  return repeatCell({
    range: gridRange({
      sheetId: args.sheetId,
      startRowIndex: 3, // Row 4+
      endRowIndex: BIG_END_ROW,
      startColumnIndex: args.col0,
      endColumnIndex: args.col0 + 1,
    }),
    cell: {
      userEnteredFormat: {
        numberFormat: {
          type: args.type,
          pattern: args.pattern,
        },
      },
    },
    fields: "userEnteredFormat.numberFormat",
  });
}

function alignReq(args: {
  sheetId: number;
  startCol0: number;
  endColExcl: number;
  align: "LEFT" | "RIGHT" | "CENTER";
}): sheets_v4.Schema$Request {
  return repeatCell({
    range: gridRange({
      sheetId: args.sheetId,
      startRowIndex: 3,
      endRowIndex: BIG_END_ROW,
      startColumnIndex: args.startCol0,
      endColumnIndex: args.endColExcl,
    }),
    cell: { userEnteredFormat: { horizontalAlignment: args.align } },
    fields: "userEnteredFormat.horizontalAlignment",
  });
}

function boldReq(args: {
  sheetId: number;
  startRowIndex: number;
  endRowIndex: number;
  startCol0: number;
  endColExcl: number;
  bold: boolean;
}): sheets_v4.Schema$Request {
  return repeatCell({
    range: gridRange({
      sheetId: args.sheetId,
      startRowIndex: args.startRowIndex,
      endRowIndex: args.endRowIndex,
      startColumnIndex: args.startCol0,
      endColumnIndex: args.endColExcl,
    }),
    cell: { userEnteredFormat: { textFormat: { bold: args.bold } } },
    fields: "userEnteredFormat.textFormat",
  });
}

function textFormatReq(args: {
  sheetId: number;
  startRowIndex: number;
  endRowIndex: number;
  startCol0: number;
  endColExcl: number;

  bold?: boolean;
  wrapStrategy?: "WRAP" | "OVERFLOW_CELL" | "CLIP";
  verticalAlignment?: "TOP" | "MIDDLE" | "BOTTOM";
}): sheets_v4.Schema$Request {
  const { bold, wrapStrategy, verticalAlignment } = args;

  const userEnteredFormat: sheets_v4.Schema$CellFormat = {};

  if (bold != null) {
    userEnteredFormat.textFormat = { bold };
  }
  if (wrapStrategy != null) {
    userEnteredFormat.wrapStrategy = wrapStrategy;
  }
  if (verticalAlignment != null) {
    userEnteredFormat.verticalAlignment = verticalAlignment;
  }

  const fields: string[] = [];
  if (bold != null) fields.push("userEnteredFormat.textFormat.bold");
  if (wrapStrategy != null) fields.push("userEnteredFormat.wrapStrategy");
  if (verticalAlignment != null)
    fields.push("userEnteredFormat.verticalAlignment");

  return repeatCell({
    range: gridRange({
      sheetId: args.sheetId,
      startRowIndex: args.startRowIndex,
      endRowIndex: args.endRowIndex,
      startColumnIndex: args.startCol0,
      endColumnIndex: args.endColExcl,
    }),
    cell: { userEnteredFormat },
    fields: fields.join(","),
  });
}

function normalizeHeader(h: unknown): string {
  return String(h ?? "")
    .trim()
    .toLowerCase();
}

export async function applyMonthlyAggregatesFormatting(args: {
  sheets: sheets_v4.Sheets;
  spreadsheetId: string;
  sheetTabId: number;
}) {
  const { sheets, spreadsheetId, sheetTabId } = args;

  // Read header row to determine dynamic column width + column positions
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${MONTHLY_AGGREGATES}!A3:ZZ3`,
  });

  const headerRow = (headerRes.data.values?.[0] ?? []) as unknown[];
  const headers = headerRow.map(normalizeHeader);

  // End column = last non-empty header
  let endColExcl = 0;
  for (let i = headers.length - 1; i >= 0; i--) {
    if (headers[i]) {
      endColExcl = i + 1;
      break;
    }
  }

  // Fallback: if sheet is empty-ish, do nothing safely
  if (endColExcl === 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            updateSheetProperties: {
              properties: {
                sheetId: sheetTabId,
                gridProperties: { frozenRowCount: 3, frozenColumnCount: 2 },
              },
              fields:
                "gridProperties.frozenRowCount,gridProperties.frozenColumnCount",
            },
          },
        ],
      },
    });
    return;
  }

  const colIndex = (name: string) => {
    const n = normalizeHeader(name);
    // Prefer substring match so slight header text differences still map
    const idx = headers.findIndex((h) => h.includes(n));
    return idx >= 0 ? idx : headers.indexOf(n);
  };

  const COL_MONTH = colIndex("month");

  // 2-decimal numeric columns
  // NOTE: "mean rainfall" intentionally removed (you don't use it).
  const TWO_DEC_HEADERS = [
    "mean tmax",
    "mean tmin",
    "mean temp",
    "mean dew point",
    "mean relative humidity",
    "total rainfall",
    "total snowfall",
    "total precipitation",
    "total sunshine",

    // Records
    "record high tmax",
    "record low tmin",
    "record max 24h rainfall",
    "record max 24h snow",
    "record max 24h precipitation",
  ];

  // Integer columns
  const INT_HEADERS = ["rainy days", "valid days", "snowy days", "wet days"];

  // Percent column (stored as 0..1)
  const possibleSunMatches = [
    "percent possible sunshine (%)",
    "percent possible sunshine",
    "percent possible",
    "possible sunshine",
    "% possible sunshine",
  ].map(normalizeHeader);

  let COL_POSSIBLE_SUN = -1;
  for (const k of possibleSunMatches) {
    const c = headers.findIndex((h) => h.includes(k));
    if (c >= 0) {
      COL_POSSIBLE_SUN = c;
      break;
    }
  }
  // final fallback: any header containing '%' and 'possible'
  if (COL_POSSIBLE_SUN < 0) {
    COL_POSSIBLE_SUN = headers.findIndex(
      (h) => h.includes("%") && h.includes("possible")
    );
  }

  const requests: sheets_v4.Schema$Request[] = [];

  // Freeze first 3 rows
  requests.push({
    updateSheetProperties: {
      properties: {
        sheetId: sheetTabId,
        gridProperties: { frozenRowCount: 3 },
      },
      fields: "gridProperties.frozenRowCount",
    },
  });

  // Meta rows bold (rows 1-2)
  requests.push(
    boldReq({
      sheetId: sheetTabId,
      startRowIndex: 0,
      endRowIndex: 2,
      startCol0: 0,
      endColExcl,
      bold: true,
    })
  );

  // Header row bold (row 3)
  requests.push(
    textFormatReq({
      sheetId: sheetTabId,
      startRowIndex: 2,
      endRowIndex: 3,
      startCol0: 0,
      endColExcl,
      bold: true,
      wrapStrategy: "WRAP",
      verticalAlignment: "MIDDLE",
    })
  );

  // Data rows not bold by default (row 4+)
  requests.push(
    boldReq({
      sheetId: sheetTabId,
      startRowIndex: 3,
      endRowIndex: BIG_END_ROW,
      startCol0: 0,
      endColExcl,
      bold: false,
    })
  );

  // Month column bold for data rows
  if (COL_MONTH >= 0) {
    requests.push(
      boldReq({
        sheetId: sheetTabId,
        startRowIndex: 3,
        endRowIndex: BIG_END_ROW,
        startCol0: COL_MONTH,
        endColExcl: COL_MONTH + 1,
        bold: true,
      })
    );
  }

  // Apply 2-decimal formats
  for (const h of TWO_DEC_HEADERS) {
    const c = colIndex(h);
    if (c >= 0) {
      requests.push(
        numberFormatReq({
          sheetId: sheetTabId,
          col0: c,
          type: "NUMBER",
          pattern: "0.00",
        })
      );
    }
  }

  // Apply integer formats
  for (const h of INT_HEADERS) {
    const c = colIndex(h);
    if (c >= 0) {
      requests.push(
        numberFormatReq({
          sheetId: sheetTabId,
          col0: c,
          type: "NUMBER",
          pattern: "0",
        })
      );
    }
  }

  // Percent Possible Sunshine as true percent (0..1 stored)
  if (COL_POSSIBLE_SUN >= 0) {
    requests.push(
      numberFormatReq({
        sheetId: sheetTabId,
        col0: COL_POSSIBLE_SUN,
        type: "PERCENT",
        pattern: "0.00%",
      })
    );
  }

  // Alignment: default right for all data columns
  requests.push(
    alignReq({ sheetId: sheetTabId, startCol0: 0, endColExcl, align: "RIGHT" })
  );

  // Month column left aligned
  if (COL_MONTH >= 0) {
    requests.push(
      alignReq({
        sheetId: sheetTabId,
        startCol0: COL_MONTH,
        endColExcl: COL_MONTH + 1,
        align: "LEFT",
      })
    );
  }

  // Optional: left-align record date columns (pure text like "1st Jan 2025")
  const DATE_HEADERS = [
    "record high tmax date",
    "record low tmin date",
    "record max 24h rainfall date",
    "record max 24h snow date",
    "record max 24h precipitation date",
  ];
  for (const h of DATE_HEADERS) {
    const c = colIndex(h);
    if (c >= 0) {
      requests.push(
        alignReq({
          sheetId: sheetTabId,
          startCol0: c,
          endColExcl: c + 1,
          align: "LEFT",
        })
      );
    }
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });
}
