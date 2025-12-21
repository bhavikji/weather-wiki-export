"use client";

import React, { useState } from "react";
import ExportForm from "@/app/components/ExportForm";
import ClimatologyForm from "@/app/components/ClimatologyForm";

type TabKey = "weather" | "climo";

export default function Home() {
  const [tab, setTab] = useState<TabKey>("weather");

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* Tabs header */}
          <div className="border-b border-slate-200 px-6 pt-5">
            <h1 className="text-lg font-semibold text-slate-900">
              Weather → Google Sheets Export
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Export daily weather data or generate climatology from the sheet.
            </p>

            <div className="mt-4 flex gap-2 pb-4">
              <button
                type="button"
                onClick={() => setTab("weather")}
                className={[
                  "rounded-xl px-4 py-2 text-sm font-semibold border",
                  tab === "weather"
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-900 border-slate-200 hover:bg-slate-50",
                ].join(" ")}
              >
                Weather Data
              </button>

              <button
                type="button"
                onClick={() => setTab("climo")}
                className={[
                  "rounded-xl px-4 py-2 text-sm font-semibold border",
                  tab === "climo"
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-900 border-slate-200 hover:bg-slate-50",
                ].join(" ")}
              >
                Climatological Data
              </button>
            </div>
          </div>

          {/* Tab content */}
          <div className="px-6 py-6">
            {tab === "weather" ? <ExportForm /> : <ClimatologyForm />}
          </div>
        </div>
      </div>
    </main>
  );
}
