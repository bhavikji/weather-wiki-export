import type {
  MonthlyAggRecord,
  ClimoRow,
  RecordPair,
} from "@/app/types/climatology-from-aggregates.types";
import {
  mean,
  min,
  max,
  round2,
  sumNonNull,
} from "@/app/helpers/computeHelpers";

function byMonth(records: MonthlyAggRecord[], monthIndex: number) {
  return records.filter((r) => r.monthIndex === monthIndex);
}

function bestMaxPair(
  records: MonthlyAggRecord[],
  getter: (r: MonthlyAggRecord) => RecordPair,
  requirePositive = false
): RecordPair {
  let best: RecordPair = { value: null, date: null };
  for (const r of records) {
    const p = getter(r);
    if (p.value == null || !Number.isFinite(p.value)) continue;
    if (requirePositive && !(p.value > 0)) continue;
    if (best.value == null || p.value > best.value)
      best = { value: p.value, date: p.date };
  }
  return {
    value: best.value != null ? round2(best.value) : null,
    date: best.date ?? null,
  };
}

function bestMinPair(
  records: MonthlyAggRecord[],
  getter: (r: MonthlyAggRecord) => RecordPair
): RecordPair {
  let best: RecordPair = { value: null, date: null };
  for (const r of records) {
    const p = getter(r);
    if (p.value == null || !Number.isFinite(p.value)) continue;
    if (best.value == null || p.value < best.value)
      best = { value: p.value, date: p.date };
  }
  return {
    value: best.value != null ? round2(best.value) : null,
    date: best.date ?? null,
  };
}

function wettestMonthlyTotal(records: MonthlyAggRecord[]): {
  total: number | null;
  year: number | null;
} {
  let bestTotal: number | null = null;
  let bestYear: number | null = null;

  for (const r of records) {
    const t = r.totalPrecip;
    if (t == null || !Number.isFinite(t)) continue;
    if (bestTotal == null || t > bestTotal) {
      bestTotal = t;
      bestYear = r.year;
    }
  }
  return {
    total: bestTotal != null ? round2(bestTotal) : null,
    year: bestYear,
  };
}

export function computeClimatologyFromMonthlyAggregates(args: {
  records: MonthlyAggRecord[];
  startYear: number;
  endYear: number;
}): {
  rows: ClimoRow[];
  annualRow: ClimoRow;
} {
  const window = args.records.filter(
    (r) => r.year >= args.startYear && r.year <= args.endYear
  );

  // Month names: take from records if available, else fallback
  const monthNameFor = (m: number) => {
    const found = window.find((r) => r.monthIndex === m);
    return found?.monthName ?? String(m);
  };

  const rows: ClimoRow[] = [];

  for (let m = 1; m <= 12; m++) {
    const b = byMonth(window, m);
    const nYears = b.filter((x) => (x.validDays ?? 0) > 0).length || null;

    const wet = wettestMonthlyTotal(b);

    const recHighTmax = bestMaxPair(b, (x) => x.recordHighTmax);
    const recLowTmin = bestMinPair(b, (x) => x.recordLowTmin);

    const recMaxRain = bestMaxPair(b, (x) => x.recordMax24hRain, true);
    const recMaxPrecip = bestMaxPair(b, (x) => x.recordMax24hPrecip, true);
    const recMaxSnow = bestMaxPair(b, (x) => x.recordMax24hSnow, true);

    rows.push([
      monthNameFor(m),

      round2(mean(b.map((x) => x.meanTmax))),
      round2(mean(b.map((x) => x.meanTmin))),
      round2(mean(b.map((x) => x.meanTemp))),
      round2(mean(b.map((x) => x.meanDewPoint))),
      round2(mean(b.map((x) => x.meanRh))),

      round2(mean(b.map((x) => x.totalRain))),
      round2(mean(b.map((x) => x.rainyDays))),

      round2(mean(b.map((x) => x.totalSnow))),
      round2(mean(b.map((x) => x.snowyDays))),

      round2(mean(b.map((x) => x.totalPrecip))),
      round2(mean(b.map((x) => x.wetDays))),

      round2(mean(b.map((x) => x.totalSunshineHours))),
      round2(mean(b.map((x) => x.percentPossibleSunshineFrac))), // 0..1

      nYears,

      round2(max(b.map((x) => x.meanTmax))),
      round2(min(b.map((x) => x.meanTmin))),

      wet.total,
      wet.year,

      recHighTmax.value,
      recHighTmax.date,

      recLowTmin.value,
      recLowTmin.date,

      recMaxRain.value,
      recMaxRain.date,

      recMaxPrecip.value,
      recMaxPrecip.date,

      recMaxSnow.value,
      recMaxSnow.date,
    ]);
  }

  // Annual row: use monthly climatology means/totals
  const annualRow: ClimoRow = [
    "Annual",

    round2(mean(rows.map((r) => r[1] as number | null))),
    round2(mean(rows.map((r) => r[2] as number | null))),
    round2(mean(rows.map((r) => r[3] as number | null))),
    round2(mean(rows.map((r) => r[4] as number | null))),
    round2(mean(rows.map((r) => r[5] as number | null))),

    round2(sumNonNull(rows.map((r) => r[6] as number | null))), // Mean Rainfall (annual total)
    round2(sumNonNull(rows.map((r) => r[7] as number | null))), // Mean Rainy Days

    round2(sumNonNull(rows.map((r) => r[8] as number | null))), // Mean Snowfall (annual total)
    round2(sumNonNull(rows.map((r) => r[9] as number | null))), // Mean Snowy Days

    round2(sumNonNull(rows.map((r) => r[10] as number | null))), // Mean Precipitation (annual total)
    round2(sumNonNull(rows.map((r) => r[11] as number | null))), // Mean Wet Days

    round2(mean(rows.map((r) => r[12] as number | null))),
    round2(mean(rows.map((r) => r[13] as number | null))),

    max(rows.map((r) => r[14] as number | null)),

    round2(max(rows.map((r) => r[15] as number | null))),
    round2(min(rows.map((r) => r[16] as number | null))),

    round2(max(rows.map((r) => r[17] as number | null))),
    null,

    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
  ];

  return { rows, annualRow };
}
