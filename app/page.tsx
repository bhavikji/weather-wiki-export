"use client";

import React, { useState } from "react";
import ExportForm from "@/app/components/ExportForm";
import ClimatologyForm from "@/app/components/ClimatologyForm";

type TabKey = "weather" | "climatology";

export default function Home() {
  const [tab, setTab] = useState<TabKey>("weather");

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* Header */}
          <div className="border-b border-slate-200 px-6 py-5">
            <h1 className="text-lg font-semibold text-slate-900">
              Weather & Climatology
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Export daily weather data or generate climatology from Monthly
              Aggregates.
            </p>
          </div>

          {/* Tabs */}
          <div className="px-6 pt-5">
            <div className="flex gap-2 rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setTab("weather")}
                className={[
                  "flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition",
                  tab === "weather"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900",
                ].join(" ")}
              >
                Weather Data
              </button>
              <button
                type="button"
                onClick={() => setTab("climatology")}
                className={[
                  "flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition",
                  tab === "climatology"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900",
                ].join(" ")}
              >
                Climatological Data
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-6">
            {tab === "weather" ? <ExportForm /> : <ClimatologyForm />}
          </div>
        </div>
      </div>
    </main>
  );
}
