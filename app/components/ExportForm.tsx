"use client";

import React, { useMemo, useState } from "react";
import SheetSelect from "@/app/components/SheetSelect";
import ResultBanner from "@/app/components/ResultBanner";
import { DEFAULT_SHEET_ID, getSheetOptions } from "@/app/data/sheetId";
import type {
  ExportResponse,
  ExportFormState,
  DomainErrorResponse,
} from "@/app/types/ui.types";

function isIsoDate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export default function ExportForm() {
  const [loading, setLoading] = useState(false);
  const [reorderLoading, setReorderLoading] = useState(false);
  const [result, setResult] = useState<ExportResponse | null>(null);

  const defaultOpt = getSheetOptions().find(
    (x) => x.value === (DEFAULT_SHEET_ID ?? "")
  );

  const [form, setForm] = useState<ExportFormState>({
    latitude: String(defaultOpt?.latitude ?? 28.1695),
    longitude: String(defaultOpt?.longitude ?? 94.8006),
    sheetId: DEFAULT_SHEET_ID ?? "",
    startDate: "1940-01-01",
    endDate: "1940-12-31",
  });

  const errors = useMemo(() => {
    const e: Record<string, string> = {};

    const lat = Number(form.latitude);
    const lon = Number(form.longitude);

    if (!Number.isFinite(lat) || lat < -90 || lat > 90)
      e.latitude = "Latitude must be between -90 and 90.";
    if (!Number.isFinite(lon) || lon < -180 || lon > 180)
      e.longitude = "Longitude must be between -180 and 180.";
    if (!form.sheetId.trim()) e.sheetId = "Google Sheet ID is required.";
    if (!isIsoDate(form.startDate))
      e.startDate = "Start date must be YYYY-MM-DD.";
    if (!isIsoDate(form.endDate)) e.endDate = "End date must be YYYY-MM-DD.";

    if (isIsoDate(form.startDate) && isIsoDate(form.endDate)) {
      const s = new Date(form.startDate + "T00:00:00Z").getTime();
      const d = new Date(form.endDate + "T00:00:00Z").getTime();
      if (Number.isFinite(s) && Number.isFinite(d) && s > d)
        e.endDate = "End date must be on/after start date.";
    }

    return e;
  }, [form]);

  const canSubmit = Object.keys(errors).length === 0 && !loading;
  const canReorder =
    Boolean(form.sheetId.trim()) && !loading && !reorderLoading;

  const selectedSheetLabel = useMemo(() => {
    const opts = getSheetOptions();
    const o = opts.find((x) => x.value === form.sheetId);
    return o ? o.label : null;
  }, [form.sheetId]);

  async function run() {
    setLoading(true);
    setResult(null);

    const startYear = Number(form.startDate.slice(0, 4));
    const endYear = Number(form.endDate.slice(0, 4));

    const payload = {
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
      sheetId: form.sheetId.trim(),
      startDate: form.startDate,
      endDate: form.endDate,
      startYear,
      endYear,
    };

    try {
      const res = await fetch("/api/weather-to-sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = (await res.json()) as ExportResponse;
      setResult(json);
    } catch {
      setResult({
        success: false,
        error: { code: "CLIENT_ERROR", message: "Failed to call API route." },
      });
    } finally {
      setLoading(false);
    }
  }

  async function reorderSheets() {
    setReorderLoading(true);
    setResult(null);

    const payload = { sheetId: form.sheetId.trim() };

    try {
      const res = await fetch("/api/reorder-sheets", {
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
          latitude: Number(form.latitude),
          longitude: Number(form.longitude),
          startYear: Number(form.startDate.slice(0, 4)),
          endYear: Number(form.endDate.slice(0, 4)),
        });
      } else {
        setResult(json as DomainErrorResponse);
      }
    } catch {
      setResult({
        success: false,
        error: {
          code: "CLIENT_ERROR",
          message: "Failed to call reorder route.",
        },
      });
    } finally {
      setReorderLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <h1 className="text-lg font-semibold text-slate-900">
            Weather → Google Sheets Export
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Provide coordinates, target Sheet ID, and a date range.
          </p>
        </div>

        <div className="px-6 py-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Latitude */}
            <div>
              <label className="text-sm font-medium text-slate-700">
                Latitude
              </label>
              <input
                className={[
                  "mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none",
                  errors.latitude
                    ? "border-red-300 focus:border-red-400"
                    : "border-slate-200 focus:border-slate-400",
                ].join(" ")}
                inputMode="decimal"
                placeholder="e.g. 28.1695"
                value={form.latitude}
                onChange={(e) =>
                  setForm((p) => ({ ...p, latitude: e.target.value }))
                }
              />
              {errors.latitude && (
                <p className="mt-1 text-xs text-red-600">{errors.latitude}</p>
              )}
            </div>

            {/* Longitude */}
            <div>
              <label className="text-sm font-medium text-slate-700">
                Longitude
              </label>
              <input
                className={[
                  "mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none",
                  errors.longitude
                    ? "border-red-300 focus:border-red-400"
                    : "border-slate-200 focus:border-slate-400",
                ].join(" ")}
                inputMode="decimal"
                placeholder="e.g. 94.8006"
                value={form.longitude}
                onChange={(e) =>
                  setForm((p) => ({ ...p, longitude: e.target.value }))
                }
              />
              {errors.longitude && (
                <p className="mt-1 text-xs text-red-600">{errors.longitude}</p>
              )}
            </div>

            {/* Sheet ID (select) */}
            <div className="sm:col-span-2">
              <SheetSelect
                value={form.sheetId}
                onChange={(v) =>
                  setForm((p) => {
                    const opt = getSheetOptions().find((x) => x.value === v);

                    // If no option or no coords, keep existing lat/long
                    if (!opt?.latitude || !opt?.longitude) {
                      return { ...p, sheetId: v };
                    }

                    return {
                      ...p,
                      sheetId: v,
                      latitude: String(opt.latitude),
                      longitude: String(opt.longitude),
                    };
                  })
                }
                error={errors.sheetId}
              />
            </div>

            {/* Start Date */}
            <div>
              <label className="text-sm font-medium text-slate-700">
                Start date
              </label>
              <input
                type="date"
                className={[
                  "mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none",
                  errors.startDate
                    ? "border-red-300 focus:border-red-400"
                    : "border-slate-200 focus:border-slate-400",
                ].join(" ")}
                value={form.startDate}
                onChange={(e) =>
                  setForm((p) => ({ ...p, startDate: e.target.value }))
                }
              />
              {errors.startDate && (
                <p className="mt-1 text-xs text-red-600">{errors.startDate}</p>
              )}
            </div>

            {/* End Date */}
            <div>
              <label className="text-sm font-medium text-slate-700">
                End date
              </label>
              <input
                type="date"
                className={[
                  "mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none",
                  errors.endDate
                    ? "border-red-300 focus:border-red-400"
                    : "border-slate-200 focus:border-slate-400",
                ].join(" ")}
                value={form.endDate}
                onChange={(e) =>
                  setForm((p) => ({ ...p, endDate: e.target.value }))
                }
              />
              {errors.endDate && (
                <p className="mt-1 text-xs text-red-600">{errors.endDate}</p>
              )}
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-slate-500">
              Request will export years derived from the selected date range.
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                onClick={reorderSheets}
                disabled={!canReorder}
                className={[
                  "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold",
                  canReorder
                    ? "bg-white text-slate-900 border border-slate-200 hover:bg-slate-50"
                    : "bg-slate-200 text-slate-500 cursor-not-allowed",
                ].join(" ")}
              >
                {reorderLoading ? "Re-ordering..." : "Re-order sheets"}
              </button>

              <button
                onClick={run}
                disabled={!canSubmit || reorderLoading}
                className={[
                  "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold",
                  canSubmit && !reorderLoading
                    ? "bg-slate-900 text-white hover:bg-slate-800"
                    : "bg-slate-200 text-slate-500 cursor-not-allowed",
                ].join(" ")}
              >
                {loading ? "Exporting..." : "Export to Sheets"}
              </button>
            </div>
          </div>

          <ResultBanner
            result={result}
            loading={loading}
            reorderLoading={reorderLoading}
            selectedSheetLabel={selectedSheetLabel}
          />
        </div>
      </div>
    </div>
  );
}
