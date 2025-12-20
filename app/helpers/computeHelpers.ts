import { DAILY_VARS } from "@/app/lib/openMeteo";
import { DailyVar } from "@/app/types/open-meteo.type";

export function asNum(x: unknown): number | null {
  if (x == null) return null;
  const n = typeof x === "number" ? x : Number(String(x).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function round2(n: number | null): number | null {
  if (n == null) return null;
  const r = Math.round(n * 100) / 100;
  return Object.is(r, -0) ? 0 : r;
}

export function toNum(x: unknown): number | null {
  const n = typeof x === "number" ? x : Number(String(x ?? "").trim());
  return Number.isFinite(n) ? n : null;
}

// ✅ Guard: avoid indexOf(...) = -1 bugs
export function idxOfDailyVar(
  v: (typeof DAILY_VARS)[number] | string
): number | null {
  const i = DAILY_VARS.indexOf(v as DailyVar);
  return i >= 0 ? i : null;
}
export function mean(nums: Array<number | null>): number | null {
  const a = nums.filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v)
  );
  if (!a.length) return null;
  return a.reduce((s, v) => s + v, 0) / a.length;
}

export function max(nums: Array<number | null>): number | null {
  const a = nums.filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v)
  );
  return a.length ? Math.max(...a) : null;
}

export function min(nums: Array<number | null>): number | null {
  const a = nums.filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v)
  );
  return a.length ? Math.min(...a) : null;
}

export function sum(nums: Array<number | null | undefined>): number | null {
  let s = 0;
  let any = false;
  for (const v of nums) {
    if (v == null || !Number.isFinite(v)) continue;
    s += v;
    any = true;
  }
  return any ? s : null;
}
