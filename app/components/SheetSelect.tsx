"use client";

import React from "react";
import { getSheetOptions, DEFAULT_SHEET_ID } from "@/app/data/sheetId";
import type { SheetSelectProps } from "@/app/types/ui.types";

export default function SheetSelect({
  value,
  onChange,
  error,
  className,
}: SheetSelectProps) {
  const options = getSheetOptions();

  return (
    <div className={className}>
      <label className="text-sm font-medium text-slate-700">
        Google Sheet ID
      </label>
      <select
        className={[
          "mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none bg-white",
          error
            ? "border-red-300 focus:border-red-400"
            : "border-slate-200 focus:border-slate-400",
        ].join(" ")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {(!DEFAULT_SHEET_ID || DEFAULT_SHEET_ID === "") && (
          <option value="">Select a spreadsheet…</option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      <p className="mt-1 text-xs text-slate-500">
        Choose a spreadsheet (the long ID in the Google Sheets URL).
      </p>
    </div>
  );
}
