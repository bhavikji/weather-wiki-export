"use client";

import { useMemo, useState } from "react";
import IMD_SHEET_OPTIONS from "@/app/data/imdSheetId";
import SHEET_OPTIONS from "@/app/data/sheetId";
import type { SheetOption } from "@/app/types/sheet-options.types";

type Dataset = "open-meteo" | "imd";

type ApiResult =
  | { success: true; sheetId: string; year: number }
  | { success: false; error?: { message?: string } };

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function asIntYear(value: string): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const y = Math.trunc(n);
  if (y < 1800 || y > 2200) return null;
  return y;
}

export default function CreateSheetTemplatePage() {
  // Dataset selector
  const [dataset, setDataset] = useState<Dataset>("open-meteo");

  // Controlled inputs
  const [sheetId, setSheetId] = useState<string>("");
  const [yearText, setYearText] = useState<string>(() => {
    const now = new Date();
    return String(now.getFullYear());
  });

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    kind: "idle" | "success" | "error";
    message?: string;
  }>({ kind: "idle" });

  const year = useMemo(() => asIntYear(yearText), [yearText]);

  // Options based on dataset
  const options = useMemo(() => {
    return dataset === "imd"
      ? (IMD_SHEET_OPTIONS as SheetOption[])
      : (SHEET_OPTIONS as SheetOption[]);
  }, [dataset]);

  // O(1) option lookup
  const optionById = useMemo(() => {
    const m = new Map<string, SheetOption>();
    for (const o of options) m.set(o.value, o);
    return m;
  }, [options]);

  const selected = useMemo(
    () => (sheetId ? optionById.get(sheetId) ?? null : null),
    [sheetId, optionById]
  );

  const canSubmit = Boolean(sheetId) && year != null && !submitting;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || year == null) return;

    setSubmitting(true);
    setResult({ kind: "idle" });

    try {
      const res = await fetch("/api/sheet-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataset, // optional: keep if your API wants to branch; safe to include
          sheetId,
          year,
          latitude: selected?.latitude ?? null,
          longitude: selected?.longitude ?? null,
          elevation: selected?.elevation ?? null,

          // Only IMD has station_id
          station_id: dataset === "imd" ? selected?.station_id ?? null : null,

          utc_offset_seconds: selected?.utc_offset_seconds ?? null,
          timezone: selected?.timezone ?? null,
        }),
      });

      const data = (await res.json().catch(() => null)) as ApiResult | null;

      if (!res.ok || !data || data.success === false) {
        const msg =
          (data && "error" in data && data.error?.message) ||
          `Request failed (${res.status})`;
        setResult({ kind: "error", message: msg });
        return;
      }

      setResult({
        kind: "success",
        message: `Template created for ${data.year}.`,
      });
    } catch (err) {
      setResult({
        kind: "error",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  const datasetLabel = dataset === "imd" ? "IMD" : "Open-meteo";

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-zinc-900">
          Create Sheet Template
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Generates a full-year, UTC-stable template on the selected
          spreadsheet.
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Dataset selector */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-zinc-800">
              Dataset
            </label>
            <p className="mt-1 text-xs text-zinc-500">
              Choose which dataset you want to generate the template for.
            </p>

            <div className="mt-2">
              <select
                value={dataset}
                onChange={(e) => {
                  const next = e.target.value as Dataset;
                  setDataset(next);
                  setSheetId("");
                  setResult({ kind: "idle" });
                }}
                className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
              >
                <option value="open-meteo">Open-meteo</option>
                <option value="imd">IMD</option>
              </select>
            </div>
          </div>

          {/* Sheet selector */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-zinc-800">
              {datasetLabel} Spreadsheet
            </label>
            <p className="mt-1 text-xs text-zinc-500">
              Choose the target Google Spreadsheet (destination of template).
            </p>

            <div className="mt-2">
              <select
                value={sheetId}
                onChange={(e) => {
                  setSheetId(e.target.value);
                  setResult({ kind: "idle" });
                }}
                className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
              >
                <option value="" disabled>
                  Select a spreadsheet…
                </option>
                {options.map((o) => (
                  <option key={o.label + o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {selected?.description ? (
              <div className="mt-2 text-xs text-zinc-600">
                {selected.description}
              </div>
            ) : null}
          </div>

          {/* Year */}
          <div>
            <label className="block text-sm font-medium text-zinc-800">
              Year
            </label>
            <p className="mt-1 text-xs text-zinc-500">
              Generates template for the entire year (no date range).
            </p>

            <input
              inputMode="numeric"
              value={yearText}
              onChange={(e) => {
                setYearText(e.target.value);
                setResult({ kind: "idle" });
              }}
              className={cn(
                "mt-2 w-full rounded-xl border bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:ring-2",
                year == null
                  ? "border-red-300 focus:border-red-600 focus:ring-red-600/10"
                  : "border-zinc-300 focus:border-zinc-900 focus:ring-zinc-900/10"
              )}
              placeholder="e.g., 2025"
            />
            {year == null ? (
              <div className="mt-2 text-xs text-red-600">
                Enter a valid year (1800–2200).
              </div>
            ) : null}
          </div>

          {/* Station ID (IMD only) */}
          {dataset === "imd" ? (
            <div>
              <label className="block text-sm font-medium text-zinc-800">
                Station ID
              </label>
              <p className="mt-1 text-xs text-zinc-500">Read-only metadata.</p>

              <input
                value={selected?.station_id ?? ""}
                readOnly
                className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800"
                placeholder="—"
              />
            </div>
          ) : null}

          {/* Lat/Long */}
          <div>
            <label className="block text-sm font-medium text-zinc-800">
              Latitude
            </label>
            <input
              value={selected?.latitude ?? ""}
              readOnly
              className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800"
              placeholder="—"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-800">
              Longitude
            </label>
            <input
              value={selected?.longitude ?? ""}
              readOnly
              className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800"
              placeholder="—"
            />
          </div>

          {/* Elevation / Timezone */}
          <div>
            <label className="block text-sm font-medium text-zinc-800">
              Elevation (m)
            </label>
            <input
              value={selected?.elevation ?? ""}
              readOnly
              className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800"
              placeholder="—"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-800">
              Timezone
            </label>
            <input
              value={selected?.timezone ?? ""}
              readOnly
              className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800"
              placeholder="—"
            />
          </div>

          {/* Sheet ID (raw) */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-zinc-800">
              Spreadsheet ID (Raw)
            </label>
            <p className="mt-1 text-xs text-zinc-500">
              This is the exact ID sent to the API.
            </p>
            <input
              value={sheetId}
              readOnly
              className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-xs text-zinc-800"
              placeholder="—"
            />
          </div>
        </div>

        {/* Action bar */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="submit"
            disabled={!canSubmit}
            className={cn(
              "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition",
              canSubmit
                ? "bg-zinc-900 text-white hover:bg-zinc-800"
                : "cursor-not-allowed bg-zinc-200 text-zinc-500"
            )}
          >
            {submitting ? "Generating…" : "Generate Template"}
          </button>

          {/* Status */}
          <div className="min-h-5 text-sm">
            {result.kind === "success" ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800">
                {result.message}
              </div>
            ) : null}
            {result.kind === "error" ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-red-800">
                {result.message}
              </div>
            ) : null}
          </div>
        </div>
      </form>

      {/* Mobile help section */}
      <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700 shadow-sm">
        <div className="font-semibold text-zinc-900">Notes</div>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-zinc-600">
          <li>
            Template is UTC-stable (prevents historical timezone day shifts like
            1941 issues).
          </li>
          <li>
            If you run it again for the same year, it overwrites that year sheet
            tab range A:ZZ.
          </li>
          <li>
            Your safe formulas should keep template sheets clean (no #DIV/0!).
          </li>
        </ul>
      </div>
    </div>
  );
}
