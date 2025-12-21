"use client";

import React, { useMemo, useState } from "react";
import SheetSelect from "@/app/components/SheetSelect";
import { DEFAULT_SHEET_ID, getSheetOptions } from "@/app/data/sheetId";
import type { DomainErrorResponse } from "@/app/types/ui.types";

function yearsRange(start: number, end: number) {
  const out: number[] = [];
  for (let y = start; y <= end; y++) out.push(y);
  return out;
}

type ClimoFormState = {
  sheetId: string;
  startYear: number;
  endYear: number;
};

type ClimoResult =
  | { success: true; sheetId: string; startYear: number; endYear: number }
  | DomainErrorResponse
  | null;

export default function ClimatologyForm() {
  const years = useMemo(() => yearsRange(1940, 2025), []);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ClimoResult>(null);

  const [form, setForm] = useState<ClimoFormState>({
    sheetId: DEFAULT_SHEET_ID ?? "",
    startYear: 1961,
    endYear: 1990,
  });

  const errors = useMemo(() => {
    const e: Record<string, string> = {};

    if (!form.sheetId.trim()) e.sheetId = "Google Sheet ID is required.";

    if (
      !Number.isFinite(form.startYear) ||
      form.startYear < 1940 ||
      form.startYear > 2025
    )
      e.startYear = "Start year must be between 1940 and 2025.";
    if (
      !Number.isFinite(form.endYear) ||
      form.endYear < 1940 ||
      form.endYear > 2025
    )
      e.endYear = "End year must be between 1940 and 2025.";

    if (form.startYear > form.endYear)
      e.endYear = "End year must be on/after start year.";

    return e;
  }, [form]);

  const canSubmit = Object.keys(errors).length === 0 && !loading;

  const selectedSheetLabel = useMemo(() => {
    const opts = getSheetOptions();
    const o = opts.find((x) => x.value === form.sheetId);
    return o ? o.label : null;
  }, [form.sheetId]);

  async function run() {
    setLoading(true);
    setResult(null);

    const payload = {
      sheetId: form.sheetId.trim(),
      startYear: form.startYear,
      endYear: form.endYear,
    };

    try {
      // You will implement this API route to:
      // 1) read Monthly Aggregates / other tabs
      // 2) compute climatology
      // 3) write Climatology tabs back
      const res = await fetch("/api/generate-climatology", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = (await res.json()) as
        | { success: true }
        | DomainErrorResponse;

      if ("success" in json && json.success === true) {
        setResult({
          success: true,
          sheetId: payload.sheetId,
          startYear: payload.startYear,
          endYear: payload.endYear,
        });
      } else {
        setResult(json);
      }
    } catch {
      setResult({
        success: false,
        error: {
          code: "CLIENT_ERROR",
          message: "Failed to call climatology route.",
        },
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-5">
        <h2 className="text-lg font-semibold text-slate-900">
          Climatological Data
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Generates climatology using the data already present in the selected
          Google Sheet.
        </p>
      </div>

      <div className="px-6 py-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Sheet select */}
          <div className="sm:col-span-2">
            <SheetSelect
              value={form.sheetId}
              onChange={(v) => setForm((p) => ({ ...p, sheetId: v }))}
              error={errors.sheetId}
            />
          </div>

          {/* Start year */}
          <div>
            <label className="text-sm font-medium text-slate-700">
              Start year
            </label>
            <select
              className={[
                "mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none bg-white",
                errors.startYear
                  ? "border-red-300 focus:border-red-400"
                  : "border-slate-200 focus:border-slate-400",
              ].join(" ")}
              value={form.startYear}
              onChange={(e) =>
                setForm((p) => ({ ...p, startYear: Number(e.target.value) }))
              }
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            {errors.startYear && (
              <p className="mt-1 text-xs text-red-600">{errors.startYear}</p>
            )}
          </div>

          {/* End year */}
          <div>
            <label className="text-sm font-medium text-slate-700">
              End year
            </label>
            <select
              className={[
                "mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none bg-white",
                errors.endYear
                  ? "border-red-300 focus:border-red-400"
                  : "border-slate-200 focus:border-slate-400",
              ].join(" ")}
              value={form.endYear}
              onChange={(e) =>
                setForm((p) => ({ ...p, endYear: Number(e.target.value) }))
              }
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            {errors.endYear && (
              <p className="mt-1 text-xs text-red-600">{errors.endYear}</p>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-slate-500">
            Sheet: {selectedSheetLabel ?? "—"} · Years: 1940–2025
          </div>

          <button
            onClick={run}
            disabled={!canSubmit}
            className={[
              "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold",
              canSubmit
                ? "bg-slate-900 text-white hover:bg-slate-800"
                : "bg-slate-200 text-slate-500 cursor-not-allowed",
            ].join(" ")}
          >
            {loading ? "Generating..." : "Generate Climatology"}
          </button>
        </div>

        {/* Minimal result banner (optional) */}
        {result && (
          <div
            className={[
              "mt-4 rounded-xl border px-4 py-3 text-sm",
              result.success
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-red-200 bg-red-50 text-red-900",
            ].join(" ")}
          >
            {result.success ? (
              <div>
                <div className="font-semibold">
                  Climatology generated successfully.
                </div>
                <div className="mt-1 text-xs opacity-80">
                  {selectedSheetLabel ?? result.sheetId} · {result.startYear}-
                  {result.endYear}
                </div>
              </div>
            ) : (
              <div>
                <div className="font-semibold">
                  Failed to generate climatology.
                </div>
                <div className="mt-1 text-xs opacity-80">
                  {result.error?.code}: {result.error?.message}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
