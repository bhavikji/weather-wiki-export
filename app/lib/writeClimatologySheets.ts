import moment from "moment-timezone";
import type { sheets_v4 } from "googleapis";
import type { ClimoRow } from "@/app/types/climatology-from-aggregates.types";
import { MONTHLY_AGGREGATES } from "@/app/constants";

const BIG_END_ROW = 200000;

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
    repeatCell: { range: args.range, cell: args.cell, fields: args.fields },
  };
}

function numberFormatReq(args: {
  sheetId: number;
  col0: number;
  type: "NUMBER" | "PERCENT";
  pattern: string;
  startRowIndex: number;
  endRowIndex: number;
}): sheets_v4.Schema$Request {
  return repeatCell({
    range: gridRange({
      sheetId: args.sheetId,
      startRowIndex: args.startRowIndex,
      endRowIndex: args.endRowIndex,
      startColumnIndex: args.col0,
      endColumnIndex: args.col0 + 1,
    }),
    cell: {
      userEnteredFormat: {
        numberFormat: { type: args.type, pattern: args.pattern },
      },
    },
    fields: "userEnteredFormat.numberFormat",
  });
}

export async function writeClimatologySheetStandalone(args: {
  sheets: sheets_v4.Sheets;
  spreadsheetId: string;
  sheetTitle: string;
  sheetTabId: number;
  timezone: string;
  startYear: number;
  endYear: number;
  rows: ClimoRow[];
  annualRow: ClimoRow;
}) {
  const {
    sheets,
    spreadsheetId,
    sheetTitle,
    sheetTabId,
    timezone,
    startYear,
    endYear,
    rows,
    annualRow,
  } = args;

  const nowStr = moment.tz(timezone).format("Do MMM YYYY, hh:mm A");

  const header: (string | number | null)[] = [
    "Month",
    "Mean Tmax (°C)",
    "Mean Tmin (°C)",
    "Mean Temp (°C)",
    "Mean Dew Point (°C)",
    "Mean Relative Humidity (%)",
    "Mean Rainfall (mm)",
    "Mean Rainy Days (days)",
    "Mean Snowfall (cm)",
    "Mean Snowy Days (days)",
    "Mean Monthly Precipitation (mm)",
    "Mean Wet Days (days)",
    "Mean Sunshine (hours)",
    "Mean Percent Possible Sunshine (%)",
    "N (years)",
    "Warmest Monthly Mean Tmax (°C)",
    "Coldest Monthly Mean Tmin (°C)",
    "Wettest Monthly Total (mm)",
    "Wettest Monthly Total Year",
    "Record High Tmax (°C)",
    "Record High Tmax Date",
    "Record Low Tmin (°C)",
    "Record Low Tmin Date",
    "Record Max 24h Rainfall (mm)",
    "Record Max 24h Rainfall Date",
    "Record Max 24h Precipitation (mm)",
    "Record Max 24h Precipitation Date",
    "Record Max 24h Snow (cm)",
    "Record Max 24h Snow Date",
  ];

  const values: (string | number | null)[][] = [
    [`${sheetTitle} (Standalone: computed from ${MONTHLY_AGGREGATES})`],
    [
      "Period",
      `${startYear}-${endYear}`,
      "Timezone",
      timezone,
      "Updated",
      nowStr,
    ],
    header,
    ...(rows as (string | number | null)[][]),
    annualRow as (string | number | null)[],
  ];

  // clear and write
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${sheetTitle}!A:ZZ`,
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetTitle}!A1`,
    valueInputOption: "RAW",
    requestBody: { values },
  });

  const endRow = values.length;
  const colCount = header.length; // 29

  // Annual row index in grid (0-based):
  const annualRowStart = endRow - 1; // last row
  const annualRowEnd = endRow;

  // formatting requests
  const requests: sheets_v4.Schema$Request[] = [
    // freeze header
    {
      updateSheetProperties: {
        properties: {
          sheetId: sheetTabId,
          gridProperties: { frozenRowCount: 3, frozenColumnCount: 1 },
        },
        fields:
          "gridProperties.frozenRowCount,gridProperties.frozenColumnCount",
      },
    },

    // title bold
    repeatCell({
      range: gridRange({
        sheetId: sheetTabId,
        startRowIndex: 0,
        endRowIndex: 1,
        startColumnIndex: 0,
        endColumnIndex: colCount,
      }),
      cell: { userEnteredFormat: { textFormat: { bold: true, fontSize: 12 } } },
      fields: "userEnteredFormat.textFormat",
    }),

    // header row bold
    repeatCell({
      range: gridRange({
        sheetId: sheetTabId,
        startRowIndex: 2,
        endRowIndex: 3,
        startColumnIndex: 0,
        endColumnIndex: colCount,
      }),
      cell: { userEnteredFormat: { textFormat: { bold: true } } },
      fields: "userEnteredFormat.textFormat",
    }),
    // ensuring that the text in the header row wraps and is vertically centered
    repeatCell({
      range: gridRange({
        sheetId: sheetTabId,
        startRowIndex: 2, // header row
        endRowIndex: 3,
        startColumnIndex: 0,
        endColumnIndex: colCount,
      }),
      cell: {
        userEnteredFormat: {
          wrapStrategy: "WRAP",
          verticalAlignment: "MIDDLE",
        },
      },
      fields:
        "userEnteredFormat.wrapStrategy,userEnteredFormat.verticalAlignment",
    }),

    // defaults: data right aligned
    repeatCell({
      range: gridRange({
        sheetId: sheetTabId,
        startRowIndex: 3,
        endRowIndex: BIG_END_ROW,
        startColumnIndex: 0,
        endColumnIndex: colCount,
      }),
      cell: { userEnteredFormat: { horizontalAlignment: "RIGHT" } },
      fields: "userEnteredFormat.horizontalAlignment",
    }),

    // month col left aligned
    repeatCell({
      range: gridRange({
        sheetId: sheetTabId,
        startRowIndex: 3,
        endRowIndex: BIG_END_ROW,
        startColumnIndex: 0,
        endColumnIndex: 1,
      }),
      cell: { userEnteredFormat: { horizontalAlignment: "LEFT" } },
      fields: "userEnteredFormat.horizontalAlignment",
    }),

    // 2-decimal numeric columns (most numeric cells)
    // B..M => 1..12, plus P..Q..R numeric etc; we set individually to be explicit
    ...[
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      10,
      11,
      12, // B..M
      15,
      16,
      17, // P,Q,R
      19,
      21,
      23,
      25,
      27, // T,V,X,Z,AB (record numeric)
    ].map((col0) =>
      numberFormatReq({
        sheetId: sheetTabId,
        col0,
        type: "NUMBER",
        pattern: "0.00",
        startRowIndex: 3,
        endRowIndex: endRow,
      })
    ),

    // Percent possible sunshine (N => col 13)
    numberFormatReq({
      sheetId: sheetTabId,
      col0: 13,
      type: "PERCENT",
      pattern: "0.00%",
      startRowIndex: 3,
      endRowIndex: endRow,
    }),

    // N(years) integer (O => col 14)
    numberFormatReq({
      sheetId: sheetTabId,
      col0: 14,
      type: "NUMBER",
      pattern: "0",
      startRowIndex: 3,
      endRowIndex: endRow,
    }),

    // wettest year integer (S => col 18)
    numberFormatReq({
      sheetId: sheetTabId,
      col0: 18,
      type: "NUMBER",
      pattern: "0",
      startRowIndex: 3,
      endRowIndex: endRow,
    }),

    // ---------- Annual row standout ----------
    // background
    repeatCell({
      range: gridRange({
        sheetId: sheetTabId,
        startRowIndex: annualRowStart,
        endRowIndex: annualRowEnd,
        startColumnIndex: 0,
        endColumnIndex: colCount,
      }),
      cell: {
        userEnteredFormat: {
          backgroundColor: { red: 0.93, green: 0.94, blue: 0.98 },
        },
      },
      fields: "userEnteredFormat.backgroundColor",
    }),
    // bold
    repeatCell({
      range: gridRange({
        sheetId: sheetTabId,
        startRowIndex: annualRowStart,
        endRowIndex: annualRowEnd,
        startColumnIndex: 0,
        endColumnIndex: colCount,
      }),
      cell: { userEnteredFormat: { textFormat: { bold: true } } },
      fields: "userEnteredFormat.textFormat",
    }),
    // thicker top border
    {
      updateBorders: {
        range: gridRange({
          sheetId: sheetTabId,
          startRowIndex: annualRowStart,
          endRowIndex: annualRowEnd,
          startColumnIndex: 0,
          endColumnIndex: colCount,
        }),
        top: { style: "SOLID_THICK" },
      },
    },
  ];

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });
}
