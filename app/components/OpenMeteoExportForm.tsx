"use client";

import { useMemo, useState } from "react";
import SHEET_OPTIONS from "@/app/data/sheetId"; // Open-Meteo sheet options (adjust path)
import type { SheetOption } from "@/app/types/sheet-options.types";

type ApiResult =
  | {
      success: true;
      sheetId: string;
      date: string;
      year: number;
      wroteCells: number;
    }
  | { success: false; error?: { message?: string } };

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function isISODate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s.trim());
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function OpenMeteoExportForm() {
  // Controlled inputs
  const [sheetId, setSheetId] = useState<string>("");
  const [dateText, setDateText] = useState<string>(() => todayISO());
  const [force, setForce] = useState(false);

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    kind: "idle" | "success" | "error";
    message?: string;
  }>({ kind: "idle" });

  // O(1) option lookup
  const options = SHEET_OPTIONS as SheetOption[];
  const optionById = useMemo(() => {
    const m = new Map<string, SheetOption>();
    for (const o of options) m.set(o.value, o);
    return m;
  }, [options]);

  const selected = useMemo(
    () => (sheetId ? optionById.get(sheetId) ?? null : null),
    [sheetId, optionById]
  );

  const isDateValid = useMemo(() => isISODate(dateText), [dateText]);

  const latitude = selected?.latitude ?? null;
  const longitude = selected?.longitude ?? null;

  const canSubmit =
    Boolean(sheetId) &&
    latitude != null &&
    longitude != null &&
    isDateValid &&
    !submitting;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setResult({ kind: "idle" });

    try {
      const res = await fetch("/api/open-meteo-daily-to-sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sheetId,
          latitude,
          longitude,
          date: dateText.trim(), // start_date=end_date inside API
          force,
          timezone: selected?.timezone ?? "Asia/Kolkata",
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
        message: `Open-Meteo sync complete for ${data.date}. Wrote ${data.wroteCells} cell(s).`,
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

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-zinc-900">
          Open-Meteo → Sheets (Daily)
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Writes a single day’s Open-Meteo archive values into the selected
          spreadsheet without clearing other rows.
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Sheet selector */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-zinc-800">
              Spreadsheet
            </label>
            <p className="mt-1 text-xs text-zinc-500">
              Choose the destination Google Spreadsheet.
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

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-zinc-800">
              Date (YYYY-MM-DD)
            </label>
            <p className="mt-1 text-xs text-zinc-500">
              This will call the Open-Meteo archive for a single day
              (start_date=end_date).
            </p>

            <input
              value={dateText}
              onChange={(e) => {
                setDateText(e.target.value);
                setResult({ kind: "idle" });
              }}
              className={cn(
                "mt-2 w-full rounded-xl border bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:ring-2",
                !isDateValid
                  ? "border-red-300 focus:border-red-600 focus:ring-red-600/10"
                  : "border-zinc-300 focus:border-zinc-900 focus:ring-zinc-900/10"
              )}
              placeholder="e.g., 2025-12-30"
            />
            {!isDateValid ? (
              <div className="mt-2 text-xs text-red-600">
                Enter a valid date (YYYY-MM-DD).
              </div>
            ) : null}
          </div>

          {/* Force overwrite */}
          <div className="flex items-start gap-3">
            <div className="pt-7">
              <input
                id="force"
                type="checkbox"
                checked={force}
                onChange={(e) => {
                  setForce(e.target.checked);
                  setResult({ kind: "idle" });
                }}
                className="h-4 w-4 rounded border-zinc-300 text-zinc-900"
              />
            </div>
            <div className="pt-6">
              <label
                htmlFor="force"
                className="block text-sm font-medium text-zinc-800"
              >
                Force overwrite
              </label>
              <p className="mt-1 text-xs text-zinc-500">
                If enabled, writes even when cells already have values.
              </p>
            </div>
          </div>

          {/* Meta (read-only) */}
          <div className="md:col-span-2 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-zinc-800">
                Latitude
              </label>
              <p className="mt-1 text-xs text-zinc-500">Read-only metadata.</p>
              <input
                value={latitude ?? ""}
                readOnly
                className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800"
                placeholder="—"
              />
              {sheetId && latitude == null ? (
                <div className="mt-2 text-xs text-red-600">
                  This option does not have latitude. Please fix SHEET_OPTIONS.
                </div>
              ) : null}
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-800">
                Longitude
              </label>
              <p className="mt-1 text-xs text-zinc-500">Read-only metadata.</p>
              <input
                value={longitude ?? ""}
                readOnly
                className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800"
                placeholder="—"
              />
              {sheetId && longitude == null ? (
                <div className="mt-2 text-xs text-red-600">
                  This option does not have longitude. Please fix SHEET_OPTIONS.
                </div>
              ) : null}
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-800">
                Timezone
              </label>
              <p className="mt-1 text-xs text-zinc-500">
                Used as the Open-Meteo request timezone.
              </p>
              <input
                value={selected?.timezone ?? "Asia/Kolkata"}
                readOnly
                className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800"
                placeholder="—"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-800">
                Station ID
              </label>
              <p className="mt-1 text-xs text-zinc-500">
                Not applicable for Open-Meteo (always blank).
              </p>
              <input
                value=""
                readOnly
                className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800"
                placeholder="—"
              />
            </div>
          </div>

          {/* Sheet ID raw */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-zinc-800">
              Spreadsheet ID (Raw)
            </label>
            <p className="mt-1 text-xs text-zinc-500">
              Exact spreadsheetId sent to the API.
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
            {submitting ? "Syncing…" : "Sync Open-Meteo Daily Data"}
          </button>

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

      <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700 shadow-sm">
        <div className="font-semibold text-zinc-900">Notes</div>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-zinc-600">
          <li>Writes only the selected date row in the year tab (YYYY).</li>
          <li>
            Does not overwrite existing values unless “Force overwrite” is
            enabled.
          </li>
          <li>
            Open-Meteo archive returns all required daily fields; station ID is
            not applicable.
          </li>
        </ul>
      </div>
    </div>
  );
}
