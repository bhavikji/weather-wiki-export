#!/usr/bin/env node
/*
  Script used by GitHub Actions to call the deployed API for each sheet.
  - Reads `app/data/sheetId.ts` and `app/data/imdSheetId.ts` and extracts
    spreadsheet ids and lat/lon / station ids via lightweight regex parsing.
  - Expects BACKEND_URL env var (e.g. https://your-app.vercel.app).
  - Posts to /api/open-meteo-daily-to-sheets and /api/imd-to-sheets for each entry.
*/

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const BACKEND_URL = process.env.BACKEND_URL;
if (!BACKEND_URL) {
  console.error(
    "Missing BACKEND_URL environment variable. Set it to your deployed site URL (e.g. https://your-app.vercel.app)"
  );
  process.exit(2);
}

function extractOpenMeteoTargets(src) {
  const re =
    /value:\s*"([^"]+)"[\s\S]*?latitude:\s*([0-9.+-]+)[\s\S]*?longitude:\s*([0-9.+-]+)/g;
  const out = [];
  let m;
  while ((m = re.exec(src))) {
    const [, value, lat, lon] = m;
    if (value && value.trim()) {
      out.push({
        sheetId: value.trim(),
        latitude: Number(lat),
        longitude: Number(lon),
      });
    }
  }
  return out;
}

function extractImdTargets(src) {
  const re = /value:\s*"([^"]+)"[\s\S]*?station_id:\s*([0-9]+)/g;
  const out = [];
  let m;
  while ((m = re.exec(src))) {
    const [, value, station_id] = m;
    if (value && value.trim()) {
      out.push({ sheetId: value.trim(), stationId: String(station_id) });
    }
  }
  return out;
}

async function main() {
  // __dirname is not available in ESM modules. Derive it from import.meta.url.
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const base = path.resolve(__dirname, "..");
  const openFile = path.join(base, "app", "data", "sheetId.ts");
  const imdFile = path.join(base, "app", "data", "imdSheetId.ts");

  const openSrc = fs.readFileSync(openFile, "utf8");
  const imdSrc = fs.readFileSync(imdFile, "utf8");

  const openTargets = extractOpenMeteoTargets(openSrc);
  const imdTargets = extractImdTargets(imdSrc);

  console.log(
    "Found",
    openTargets.length,
    "open-meteo targets and",
    imdTargets.length,
    "imd targets"
  );

  const today = new Date().toISOString().slice(0, 10);

  const results = [];

  for (const t of openTargets) {
    try {
      console.log("Calling open-meteo for", t.sheetId, t.latitude, t.longitude);
      const res = await fetch(`${BACKEND_URL}/api/open-meteo-daily-to-sheets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sheetId: t.sheetId,
          latitude: t.latitude,
          longitude: t.longitude,
          date: today,
          force: true,
        }),
      });
      const body = await res.text();
      console.log("->", res.status, body.substring(0, 1000));
      results.push(res.ok);
    } catch (e) {
      console.error("open-meteo call failed for", t.sheetId, e && e.message);
      results.push(false);
    }
  }

  for (const t of imdTargets) {
    try {
      console.log("Calling imd for", t.sheetId, t.stationId);
      const res = await fetch(`${BACKEND_URL}/api/imd-to-sheets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sheetId: t.sheetId,
          stationId: t.stationId,
          date: today,
          force: true,
        }),
      });
      const body = await res.text();
      console.log("->", res.status, body.substring(0, 1000));
      results.push(res.ok);
    } catch (e) {
      console.error("imd call failed for", t.sheetId, e && e.message);
      results.push(false);
    }
  }

  const ok = results.every(Boolean);
  if (!ok) {
    console.error("One or more scheduled calls failed");
    process.exit(1);
  }
  console.log("All scheduled calls finished successfully");
}

main().catch((e) => {
  console.error("Fatal error", e && e.stack);
  process.exit(2);
});
