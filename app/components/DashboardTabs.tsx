"use client";

import React, { useState } from "react";
import ExportForm from "@/app/components/ExportForm";
import ClimatologyForm from "@/app/components/ClimatologyForm";

type TabKey = "weather" | "climo";

export default function DashboardTabs() {
  const [tab, setTab] = useState<TabKey>("weather");

  const tabBtn = (key: TabKey, label: string) => {
    const active = tab === key;
    return (
      <button
        type="button"
        onClick={() => setTab(key)}
        className={[
          "rounded-xl px-4 py-2 text-sm font-semibold transition",
          active
            ? "bg-slate-900 text-white"
            : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50",
        ].join(" ")}
        aria-pressed={active}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">
            Weather Toolkit
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Export weather data and generate climatological summaries.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {tabBtn("weather", "Weather Data")}
          {tabBtn("climo", "Climatological Data")}
        </div>
      </div>

      <div className="mt-6">
        {tab === "weather" ? <ExportForm /> : <ClimatologyForm />}
      </div>
    </div>
  );
}
