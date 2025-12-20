"use client";

import type { ResultBannerProps } from "@/app/types/ui.types";

export default function ResultBanner(props: ResultBannerProps) {
  const { result, loading, reorderLoading, selectedSheetLabel } = props;

  if (!result) return null;

  if (result.success === false) {
    return (
      <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
        <p className="text-sm font-medium text-red-900">
          {result.error.code}: {result.error.message}
        </p>
        {result.error.details && (
          <pre className="mt-2 overflow-auto rounded-xl bg-white/60 p-3 text-xs text-red-900">
            {JSON.stringify(result.error.details, null, 2)}
          </pre>
        )}
      </div>
    );
  }

  // success === true
  return (
    <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
      <p className="text-sm font-medium text-emerald-900">
        {reorderLoading
          ? "Re-ordering sheets…"
          : loading
          ? "Exporting to Sheets…"
          : `Export complete for ${selectedSheetLabel ?? "selected target"}`}
      </p>
      <p className="mt-1 text-sm text-emerald-800">
        {selectedSheetLabel ? `${selectedSheetLabel} — ` : "Target: "}
        Coordinates: {result.latitude}, {result.longitude}.
      </p>
      <p className="mt-1 text-sm text-emerald-800">
        Year:{" "}
        {result.startYear === result.endYear
          ? result.startYear
          : `${result.startYear}–${result.endYear}`}
        .
      </p>
      <p className="mt-1 text-xs text-emerald-800">
        Your data was written to the spreadsheet (tab names: yearly tabs plus
        summary pages). If you clicked Re-order sheets, your summary tabs should
        now be first, followed by year tabs in ascending order.
      </p>
    </div>
  );
}
