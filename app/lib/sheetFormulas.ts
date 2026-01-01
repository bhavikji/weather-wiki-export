// app/lib/sheetFormulas.ts

/**
 * Strict template-safe formulas:
 * - If there are 0 numeric observations in the range/refs => ""
 * - Otherwise compute normally.
 *
 * Notes:
 * - COUNT ignores blanks and text.
 * - Works for humidity fractions too (0..1).
 */

export function safeAverageRange(
  col: string,
  startRow: number,
  endRow: number
) {
  const range = `${col}${startRow}:${col}${endRow}`;
  return `=IF(COUNT(${range})=0,"",AVERAGE(${range}))`;
}

export function safeSumRange(col: string, startRow: number, endRow: number) {
  const range = `${col}${startRow}:${col}${endRow}`;
  return `=IF(COUNT(${range})=0,"",SUM(${range}))`;
}

export function safeMaxRange(col: string, startRow: number, endRow: number) {
  const range = `${col}${startRow}:${col}${endRow}`;
  return `=IF(COUNT(${range})=0,"",MAX(${range}))`;
}

export function safeMinRange(col: string, startRow: number, endRow: number) {
  const range = `${col}${startRow}:${col}${endRow}`;
  return `=IF(COUNT(${range})=0,"",MIN(${range}))`;
}

/**
 * For comma-separated refs: e.g. "C12,C45,C78"
 * (This is how your annual rows are built today.)
 */
export function safeAverageRefs(refsCsv: string) {
  return `=IF(COUNT(${refsCsv})=0,"",AVERAGE(${refsCsv}))`;
}

export function safeSumRefs(refsCsv: string) {
  return `=IF(COUNT(${refsCsv})=0,"",SUM(${refsCsv}))`;
}

export function safeMaxRanges(rangesCsv: string) {
  return `=IF(COUNT(${rangesCsv})=0,"",MAX(${rangesCsv}))`;
}

export function safeMinRanges(rangesCsv: string) {
  return `=IF(COUNT(${rangesCsv})=0,"",MIN(${rangesCsv}))`;
}

/**
 * Your existing “threshold bypass” but guarded for empty templates first.
 */
export function safeMaxWithThresholdFormula(args: {
  col: string;
  startRow: number;
  endRow: number;
  threshold: number;
}) {
  const { col, startRow, endRow, threshold } = args;
  const range = `${col}${startRow}:${col}${endRow}`;

  // If empty => "", else if max < threshold => "", else max
  return `=IF(COUNT(${range})=0,"",IF(MAX(${range})<${threshold},"",MAX(${range})))`;
}
