// app/lib/sheetsFormatting.ts
import type { sheets_v4 } from "googleapis";
import { DAILY_VARS, HUMIDITY_VARS } from "@/app/lib/openMeteo";
import { THRESHOLDS } from "@/app/lib/thresholds";
import type { ApplyFormattingArgs } from "@/app/types/sheets-formatting.types";

// ---------- Thresholds (for “highlight only if meaningful”) ----------
// Use centralized thresholds from app/lib/thresholds.ts
const RAIN_DAY_THRESHOLD_MM = THRESHOLDS.RAIN_MM; // rainy day threshold (mm)
const PRECIP_DAY_THRESHOLD_MM = THRESHOLDS.PRECIP_MM; // precip threshold (mm)
const SNOW_DAY_THRESHOLD_CM = THRESHOLDS.SNOW_CM; // snow threshold (cm)

// ---------- Helpers ----------
function gridRange(args: {
  sheetId: number;
  startRowIndex: number; // 0-based inclusive
  endRowIndex: number; // 0-based exclusive
  startColumnIndex: number; // 0-based inclusive
  endColumnIndex: number; // 0-based exclusive
}): sheets_v4.Schema$GridRange {
  return {
    sheetId: args.sheetId,
    startRowIndex: args.startRowIndex,
    endRowIndex: args.endRowIndex,
    startColumnIndex: args.startColumnIndex,
    endColumnIndex: args.endColumnIndex,
  };
}

function repeatCellRequest(args: {
  range: sheets_v4.Schema$GridRange;
  userEnteredFormat: sheets_v4.Schema$CellFormat;
  fields: string;
}): sheets_v4.Schema$Request {
  return {
    repeatCell: {
      range: args.range,
      cell: { userEnteredFormat: args.userEnteredFormat },
      fields: args.fields,
    },
  };
}

function numberFormatRequest(args: {
  range: sheets_v4.Schema$GridRange;
  type: "NUMBER" | "PERCENT" | "TEXT";
  pattern?: string;
}): sheets_v4.Schema$Request {
  return {
    repeatCell: {
      range: args.range,
      cell: {
        userEnteredFormat: {
          numberFormat: {
            type: args.type,
            ...(args.pattern ? { pattern: args.pattern } : {}),
          },
        },
      },
      fields: "userEnteredFormat.numberFormat",
    },
  };
}

function freezeRequest(args: {
  sheetId: number;
  frozenRowCount?: number;
  frozenColumnCount?: number;
}): sheets_v4.Schema$Request {
  return {
    updateSheetProperties: {
      properties: {
        sheetId: args.sheetId,
        gridProperties: {
          ...(args.frozenRowCount != null && {
            frozenRowCount: args.frozenRowCount,
          }),
          ...(args.frozenColumnCount != null && {
            frozenColumnCount: args.frozenColumnCount,
          }),
        },
      },
      fields: [
        args.frozenRowCount != null ? "gridProperties.frozenRowCount" : null,
        args.frozenColumnCount != null
          ? "gridProperties.frozenColumnCount"
          : null,
      ]
        .filter(Boolean)
        .join(","),
    },
  };
}

function addConditionalFormatRuleRequest(args: {
  sheetId: number;
  range: sheets_v4.Schema$GridRange;
  backgroundColor: sheets_v4.Schema$Color;
  index: number;
}): sheets_v4.Schema$Request {
  return {
    addConditionalFormatRule: {
      rule: {
        ranges: [args.range],
        booleanRule: {
          condition: { type: "NOT_BLANK" },
          format: {
            backgroundColor: args.backgroundColor,
            textFormat: { bold: true },
          },
        },
      },
      index: args.index,
    },
  };
}

// ✅ CUSTOM_FORMULA conditional rule (for daily max/min highlight + tie handling)
function addFormulaConditionalFormatRuleRequest(args: {
  sheetId: number;
  range: sheets_v4.Schema$GridRange;
  formula: string; // must start with "="
  backgroundColor: sheets_v4.Schema$Color;
  index: number;
}): sheets_v4.Schema$Request {
  return {
    addConditionalFormatRule: {
      rule: {
        ranges: [args.range],
        booleanRule: {
          condition: {
            type: "CUSTOM_FORMULA",
            values: [{ userEnteredValue: args.formula }],
          },
          format: {
            backgroundColor: args.backgroundColor,
            textFormat: { bold: true },
          },
        },
      },
      index: args.index,
    },
  };
}

// Column indexes (0-based) A=0 ... dynamic end based on DAILY_VARS
const COL_A = 0;
const COL_B = 1;

// ✅ End column exclusive for this sheet = A (Date) + all DAILY_VARS
const COL_END_EXCL = 1 + DAILY_VARS.length; // exclusive

const COL_DATA_START = 1; // B

function varToColIndex0(v: (typeof DAILY_VARS)[number]): number {
  return COL_DATA_START + DAILY_VARS.indexOf(v);
}

function safeColor(r: number, g: number, b: number): sheets_v4.Schema$Color {
  return { red: r / 255, green: g / 255, blue: b / 255 };
}

/**
 * Google Sheets palette (approx) based on common defaults:
 * - Light Red 2       ≈ #f4cccc (244,204,204)
 * - Light Yellow 2    ≈ #fff2cc (255,242,204)
 * - Light Cornflower 3≈ #9fc5e8 (159,197,232)
 * - Light Cyan 3      ≈ #a2c4c9 (162,196,201)
 * - Light Gray 2      ≈ #eeeeee (238,238,238)
 */
export const COLOR_MEAN_ROW = safeColor(162, 196, 201); // Light Cyan 3
const COLOR_TOTAL_ROW = safeColor(238, 238, 238); // Light Gray 2
const COLOR_MAX_TEMP = safeColor(244, 204, 204); // Light Red 2
const COLOR_MIN_TEMP = safeColor(255, 242, 204); // Light Yellow 2
const COLOR_MAX_RAIN = safeColor(159, 197, 232); // Light Cornflower 3

// ✅ Convert 0-based col index to A1 column letter (A, B, ..., AA...)
function col0ToA1(col0: number): string {
  let n = col0 + 1; // 1-based
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// --------------------------
// ✅ Precomputed mappings
// --------------------------
const VAR_COL0: Record<(typeof DAILY_VARS)[number], number> =
  Object.fromEntries(DAILY_VARS.map((v) => [v, varToColIndex0(v)])) as Record<
    string,
    number
  >;

const OTHER_NUMERIC_VARS = DAILY_VARS.filter(
  (v) =>
    v !== "sunrise" &&
    v !== "sunset" &&
    v !== "temperature_2m_max" &&
    v !== "temperature_2m_min" &&
    !HUMIDITY_VARS.includes(v) &&
    v !== "rain_sum" &&
    v !== "snowfall_sum" &&
    v !== "precipitation_sum"
);

const VAR_FORMATS: Array<{
  vars: (typeof DAILY_VARS)[number][];
  type: "NUMBER" | "PERCENT" | "TEXT";
  pattern?: string;
}> = [
  { vars: [...HUMIDITY_VARS], type: "PERCENT", pattern: "0.00%" },
  {
    vars: [
      "temperature_2m_max",
      "temperature_2m_min",
      "temperature_2m_mean",
      "dew_point_2m_mean",
    ],
    type: "NUMBER",
    pattern: "0.0",
  },
  {
    vars: ["rain_sum", "snowfall_sum", "precipitation_sum"],
    type: "NUMBER",
    pattern: "0.00",
  },
  { vars: OTHER_NUMERIC_VARS, type: "NUMBER", pattern: "0.00" },
  { vars: ["sunrise", "sunset"], type: "TEXT" },
];

type SectionLike = {
  // Optional month header + col header
  monthHeaderRowIndex?: number;
  colHeaderRowIndex?: number;

  // Data rows only needed for daily extremes highlighting
  dataStartRow?: number;
  dataEndRow?: number;

  // Required “summary rows”
  meanRowIndex: number;
  totalRowIndex: number;
  recordRowIndex: number;
};

function pushNumberFormats(args: {
  requests: sheets_v4.Schema$Request[];
  sheetId: number;
  rowStart0: number; // 0-based inclusive
  rowEnd0: number; // 0-based exclusive
}) {
  const { requests, sheetId, rowStart0, rowEnd0 } = args;

  for (const fmt of VAR_FORMATS) {
    for (const v of fmt.vars) {
      const c0 = VAR_COL0[v];
      requests.push(
        numberFormatRequest({
          range: gridRange({
            sheetId,
            startRowIndex: rowStart0,
            endRowIndex: rowEnd0,
            startColumnIndex: c0,
            endColumnIndex: c0 + 1,
          }),
          type: fmt.type,
          ...(fmt.pattern ? { pattern: fmt.pattern } : {}),
        })
      );
    }
  }
}

function pushExtremesRowHighlighting(args: {
  requests: sheets_v4.Schema$Request[];
  sheetId: number;
  recordRowIndex1: number; // 1-based
  ruleIndex: { value: number };
}) {
  const { requests, sheetId, recordRowIndex1, ruleIndex } = args;

  const recordRowStart0 = recordRowIndex1 - 1;
  const recordRowEnd0 = recordRowIndex1;

  const maxTempCol0 = VAR_COL0["temperature_2m_max"];
  const minTempCol0 = VAR_COL0["temperature_2m_min"];
  const rainCol0 = VAR_COL0["rain_sum"];
  const snowCol0 = VAR_COL0["snowfall_sum"];
  const precipCol0 = VAR_COL0["precipitation_sum"];

  // ✅ For precipitation-type cells in the Extremes row:
  // - highlight only if the cell is > threshold (so 0 stays unformatted)
  const addExtremeCellHighlightIfAbove = (col0: number, threshold: number) => {
    const col = col0ToA1(col0);
    const r = recordRowIndex1; // 1-based row for A1
    const formula = `=AND(NOT(ISBLANK(${col}${r})),${col}${r}>${threshold})`;

    requests.push(
      addFormulaConditionalFormatRuleRequest({
        sheetId,
        range: gridRange({
          sheetId,
          startRowIndex: recordRowStart0,
          endRowIndex: recordRowEnd0,
          startColumnIndex: col0,
          endColumnIndex: col0 + 1,
        }),
        formula,
        backgroundColor: COLOR_MAX_RAIN,
        index: ruleIndex.value++,
      })
    );
  };

  addExtremeCellHighlightIfAbove(rainCol0, RAIN_DAY_THRESHOLD_MM);
  addExtremeCellHighlightIfAbove(snowCol0, SNOW_DAY_THRESHOLD_CM);
  addExtremeCellHighlightIfAbove(precipCol0, PRECIP_DAY_THRESHOLD_MM);

  // Min temp extreme highlight (always)
  requests.push(
    addConditionalFormatRuleRequest({
      sheetId,
      range: gridRange({
        sheetId,
        startRowIndex: recordRowStart0,
        endRowIndex: recordRowEnd0,
        startColumnIndex: minTempCol0,
        endColumnIndex: minTempCol0 + 1,
      }),
      backgroundColor: COLOR_MIN_TEMP,
      index: ruleIndex.value++,
    })
  );

  // Max temp extreme highlight (always)
  requests.push(
    addConditionalFormatRuleRequest({
      sheetId,
      range: gridRange({
        sheetId,
        startRowIndex: recordRowStart0,
        endRowIndex: recordRowEnd0,
        startColumnIndex: maxTempCol0,
        endColumnIndex: maxTempCol0 + 1,
      }),
      backgroundColor: COLOR_MAX_TEMP,
      index: ruleIndex.value++,
    })
  );
}

function pushDailyExtremesHighlighting(args: {
  requests: sheets_v4.Schema$Request[];
  sheetId: number;

  dataStartRow1: number; // 1-based
  dataEndRow1: number; // 1-based
  ruleIndex: { value: number };
}) {
  const { requests, sheetId, dataStartRow1, dataEndRow1, ruleIndex } = args;

  // Applies ONLY to daily data rows (not Mean/Total/Extremes rows)
  const dataStart0 = dataStartRow1 - 1; // 0-based inclusive
  const dataEnd0 = dataEndRow1; // 0-based exclusive

  const r1 = dataStartRow1; // A1 row start (1-based)
  const r2 = dataEndRow1; // A1 row end (1-based)

  const maxTempCol0 = VAR_COL0["temperature_2m_max"];
  const minTempCol0 = VAR_COL0["temperature_2m_min"];
  const rainCol0 = VAR_COL0["rain_sum"];
  const snowCol0 = VAR_COL0["snowfall_sum"];
  const precipCol0 = VAR_COL0["precipitation_sum"];

  const addMaxDayHighlightIfAtLeast = (col0: number, threshold: number) => {
    const col = col0ToA1(col0);

    // Highlight if:
    // 1) cell equals MAX(range)  -> ties included
    // 2) MAX(range) >= threshold -> if all 0 (or below threshold), highlight none
    const formula = `=AND(${col}${r1}=MAX(${col}$${r1}:${col}$${r2}),MAX(${col}$${r1}:${col}$${r2})>=${threshold})`;

    requests.push(
      addFormulaConditionalFormatRuleRequest({
        sheetId,
        range: gridRange({
          sheetId,
          startRowIndex: dataStart0,
          endRowIndex: dataEnd0,
          startColumnIndex: col0,
          endColumnIndex: col0 + 1,
        }),
        formula,
        backgroundColor: COLOR_MAX_RAIN,
        index: ruleIndex.value++,
      })
    );
  };

  // Heaviest rain/snow/precip day(s) — with “bypass if all zeros”
  addMaxDayHighlightIfAtLeast(rainCol0, RAIN_DAY_THRESHOLD_MM);
  addMaxDayHighlightIfAtLeast(snowCol0, SNOW_DAY_THRESHOLD_CM);
  addMaxDayHighlightIfAtLeast(precipCol0, PRECIP_DAY_THRESHOLD_MM);

  // Hottest (tmax) day(s)
  {
    const col = col0ToA1(maxTempCol0);
    const formula = `=${col}${r1}=MAX(${col}$${r1}:${col}$${r2})`;

    requests.push(
      addFormulaConditionalFormatRuleRequest({
        sheetId,
        range: gridRange({
          sheetId,
          startRowIndex: dataStart0,
          endRowIndex: dataEnd0,
          startColumnIndex: maxTempCol0,
          endColumnIndex: maxTempCol0 + 1,
        }),
        formula,
        backgroundColor: COLOR_MAX_TEMP,
        index: ruleIndex.value++,
      })
    );
  }

  // Coldest (tmin) day(s)
  {
    const col = col0ToA1(minTempCol0);
    const formula = `=${col}${r1}=MIN(${col}$${r1}:${col}$${r2})`;

    requests.push(
      addFormulaConditionalFormatRuleRequest({
        sheetId,
        range: gridRange({
          sheetId,
          startRowIndex: dataStart0,
          endRowIndex: dataEnd0,
          startColumnIndex: minTempCol0,
          endColumnIndex: minTempCol0 + 1,
        }),
        formula,
        backgroundColor: COLOR_MIN_TEMP,
        index: ruleIndex.value++,
      })
    );
  }
}

function pushSectionFormatting(args: {
  requests: sheets_v4.Schema$Request[];
  sheetId: number;
  section: SectionLike;
  ruleIndex: { value: number };
  includeMonthHeaders: boolean;
  includeDailyExtremesHighlight: boolean;
}) {
  const {
    requests,
    sheetId,
    section,
    ruleIndex,
    includeMonthHeaders,
    includeDailyExtremesHighlight,
  } = args;

  // -------- Month header + column header (FORMAT ONLY, NO MERGE) --------
  if (
    includeMonthHeaders &&
    section.monthHeaderRowIndex != null &&
    section.colHeaderRowIndex != null
  ) {
    // Month header styling
    requests.push(
      repeatCellRequest({
        range: gridRange({
          sheetId,
          startRowIndex: section.monthHeaderRowIndex - 1,
          endRowIndex: section.monthHeaderRowIndex,
          startColumnIndex: COL_A,
          endColumnIndex: COL_END_EXCL,
        }),
        userEnteredFormat: {
          textFormat: { bold: true, fontSize: 12 },
          horizontalAlignment: "CENTER",
        },
        fields: "userEnteredFormat(textFormat,horizontalAlignment)",
      })
    );

    // Column header styling
    requests.push(
      repeatCellRequest({
        range: gridRange({
          sheetId,
          startRowIndex: section.colHeaderRowIndex - 1,
          endRowIndex: section.colHeaderRowIndex,
          startColumnIndex: COL_A,
          endColumnIndex: COL_END_EXCL,
        }),
        userEnteredFormat: {
          textFormat: { bold: true },
          horizontalAlignment: "LEFT",
          wrapStrategy: "WRAP",
        },
        fields:
          "userEnteredFormat(textFormat,horizontalAlignment,wrapStrategy)",
      })
    );
  }

  // -------- Bold label cells for Mean / Total / Extremes (column A only) --------
  requests.push(
    repeatCellRequest({
      range: gridRange({
        sheetId,
        startRowIndex: section.meanRowIndex - 1,
        endRowIndex: section.recordRowIndex,
        startColumnIndex: COL_A,
        endColumnIndex: COL_B,
      }),
      userEnteredFormat: { textFormat: { bold: true } },
      fields: "userEnteredFormat.textFormat",
    })
  );

  // -------- Mean row background --------
  requests.push(
    repeatCellRequest({
      range: gridRange({
        sheetId,
        startRowIndex: section.meanRowIndex - 1,
        endRowIndex: section.meanRowIndex,
        startColumnIndex: COL_A,
        endColumnIndex: COL_END_EXCL,
      }),
      userEnteredFormat: { backgroundColor: COLOR_MEAN_ROW },
      fields: "userEnteredFormat.backgroundColor",
    })
  );

  // -------- Total row background --------
  requests.push(
    repeatCellRequest({
      range: gridRange({
        sheetId,
        startRowIndex: section.totalRowIndex - 1,
        endRowIndex: section.totalRowIndex,
        startColumnIndex: COL_A,
        endColumnIndex: COL_END_EXCL,
      }),
      userEnteredFormat: { backgroundColor: COLOR_TOTAL_ROW },
      fields: "userEnteredFormat.backgroundColor",
    })
  );

  // -------- Number formats (data → extremes) --------
  const rowStart0 = (section.dataStartRow ?? section.meanRowIndex) - 1;
  const rowEnd0 = section.recordRowIndex;

  pushNumberFormats({
    requests,
    sheetId,
    rowStart0,
    rowEnd0,
  });

  // -------- Extremes row highlighting --------
  pushExtremesRowHighlighting({
    requests,
    sheetId,
    recordRowIndex1: section.recordRowIndex,
    ruleIndex,
  });

  // -------- Daily extremes highlighting --------
  if (
    includeDailyExtremesHighlight &&
    section.dataStartRow != null &&
    section.dataEndRow != null
  ) {
    pushDailyExtremesHighlighting({
      requests,
      sheetId,
      dataStartRow1: section.dataStartRow,
      dataEndRow1: section.dataEndRow,
      ruleIndex,
    });
  }
}

export async function applySheetFormatting(args: ApplyFormattingArgs) {
  const { sheets, spreadsheetId, sheetId, monthSections, annualSection } = args;

  const requests: sheets_v4.Schema$Request[] = [];
  const ruleIndex = { value: 0 };

  // 1) Freeze top meta area + date column (SAFE)
  requests.push(
    freezeRequest({
      sheetId,
      frozenRowCount: 3,
      frozenColumnCount: 1, // Column A (Date)
    })
  );

  // 2) Meta row styling (NO MERGES — formatting only)
  requests.push(
    repeatCellRequest({
      range: gridRange({
        sheetId,
        startRowIndex: 0,
        endRowIndex: 3, // meta rows
        startColumnIndex: COL_A,
        endColumnIndex: COL_END_EXCL,
      }),
      userEnteredFormat: {
        textFormat: { bold: true },
        horizontalAlignment: "LEFT",
        wrapStrategy: "WRAP",
      },
      fields: "userEnteredFormat(textFormat,horizontalAlignment,wrapStrategy)",
    })
  );

  // 3) Month sections formatting (includes daily extremes highlighting)
  for (const sec of monthSections) {
    pushSectionFormatting({
      requests,
      sheetId,
      section: sec,
      ruleIndex,
      includeMonthHeaders: true,
      includeDailyExtremesHighlight: true,
    });
  }

  // 4) Annual section formatting (no daily highlight)
  if (annualSection) {
    pushSectionFormatting({
      requests,
      sheetId,
      section: annualSection,
      ruleIndex,
      includeMonthHeaders: false,
      includeDailyExtremesHighlight: false,
    });
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });
}
