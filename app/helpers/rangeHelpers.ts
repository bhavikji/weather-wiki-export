// app/helpers/rangeHelpers.ts
import { cmpIso } from "./dateHelpers";

export function clampRangeToYear(
  year: number,
  startDate: string,
  endDate: string
) {
  const yStart = `${year}-01-01`;
  const yEnd = `${year}-12-31`;

  const start = cmpIso(startDate, yStart) > 0 ? startDate : yStart;
  const end = cmpIso(endDate, yEnd) < 0 ? endDate : yEnd;

  if (cmpIso(start, end) > 0) return null;
  return { start, end };
}
