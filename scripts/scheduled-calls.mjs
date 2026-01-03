#!/usr/bin/env node
/*
  Script used by GitHub Actions to call the deployed API for each sheet.
  - Reads `app/data/sheetId.ts` and `app/data/imdSheetId.ts` and extracts
    spreadsheet ids and lat/lon / station ids via lightweight regex parsing.
  - Expects BACKEND_URL env var (e.g. https://your-app.vercel.app).
  - Posts to /api/open-meteo-daily-to-sheets and /api/imd-to-sheets for each entry.

  Recommended hardening:
  - Validate + normalize BACKEND_URL (trim, ensure https, remove trailing slash).
  - Add fetch timeouts (AbortController).
  - Improve network error diagnostics (e.cause, undici codes).
  - Add a lightweight preflight ping to surface connectivity issues early.
  - Add a User-Agent header (sometimes helps with WAF/proxies).
*/

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const BACKEND_URL_RAW = process.env.BACKEND_URL ?? "";
const BACKEND_URL_TRIMMED = BACKEND_URL_RAW.trim();

if (!BACKEND_URL_TRIMMED) {
  console.error(
    "Missing BACKEND_URL environment variable. Set it to your deployed site URL (e.g. https://your-app.vercel.app)"
  );
  process.exit(2);
}

let backendUrl;
try {
  backendUrl = new URL(BACKEND_URL_TRIMMED);
} catch {
  console.error("Invalid BACKEND_URL:", JSON.stringify(BACKEND_URL_RAW));
  console.error(
    "Expected a full URL like: https://weather-wiki-export.vercel.app"
  );
  process.exit(2);
}

if (backendUrl.protocol !== "https:") {
  console.error("BACKEND_URL must be https. Got:", backendUrl.toString());
  process.exit(2);
}

// Normalize: remove trailing slash
const BASE_URL = backendUrl.toString().replace(/\/$/, "");

const DEFAULT_TIMEOUT_MS = 30_000; // 30s per request (tune if needed)
const USER_AGENT = "github-actions-scheduler/1.0";

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

function logFetchError(prefix, sheetId, e) {
  console.error(prefix, sheetId);

  // High-signal fields for Undici/network issues
  console.error("name:", e?.name);
  console.error("message:", e?.message);

  // Node/Undici often puts the real reason here (ENOTFOUND, ETIMEDOUT, etc.)
  if (e?.cause) {
    console.error("cause:", e.cause);
    // common fields on system errors
    if (typeof e.cause === "object" && e.cause) {
      if ("code" in e.cause) console.error("cause.code:", e.cause.code);
      if ("errno" in e.cause) console.error("cause.errno:", e.cause.errno);
      if ("syscall" in e.cause)
        console.error("cause.syscall:", e.cause.syscall);
      if ("address" in e.cause)
        console.error("cause.address:", e.cause.address);
      if ("port" in e.cause) console.error("cause.port:", e.cause.port);
    }
  }

  if (e?.stack) console.error("stack:", e.stack);
}

async function fetchWithTimeout(url, init, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const ac = new AbortController();
  const timer = setTimeout(() => {
    ac.abort(new Error(`Timeout after ${timeoutMs}ms`));
  }, timeoutMs);

  try {
    return await fetch(url, { ...init, signal: ac.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function postJson(url, payload, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
      },
      body: JSON.stringify(payload),
    },
    timeoutMs
  );
}

async function preflight() {
  // A quick GET to verify DNS/TLS/connectivity. Uses a short timeout.
  // We call "/" because Vercel will respond quickly even if your API route is cold.
  const url = `${BASE_URL}/`;
  console.log("Preflight:", url);

  try {
    const res = await fetchWithTimeout(
      url,
      { method: "GET", headers: { "User-Agent": USER_AGENT } },
      15_000
    );
    console.log("Preflight ->", res.status);
    // Drain body to keep Node happy in some environments
    await res.arrayBuffer().catch(() => {});
    return res.ok || (res.status >= 200 && res.status < 500); // treat 4xx as "reachable"
  } catch (e) {
    logFetchError("Preflight failed for", BASE_URL, e);
    return false;
  }
}

async function main() {
  console.log("Using BACKEND_URL:", BASE_URL);

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

  // IMPORTANT: Your GitHub Action runs at 15:30 UTC (21:00 IST),
  // but toISOString() uses UTC date. That can shift the date around midnight.
  // Use Asia/Kolkata date for your "daily record" to match your intent.
  const todayIST = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()); // en-CA => YYYY-MM-DD

  console.log("Using date (Asia/Kolkata):", todayIST);

  const reachable = await preflight();
  if (!reachable) {
    console.error("Backend not reachable in CI. Aborting scheduled run.");
    process.exit(1);
  }

  const results = [];

  // Optional: run sequentially (current behavior). If you later want parallelism,
  // add concurrency control to avoid overwhelming your backend.
  for (const t of openTargets) {
    try {
      console.log("Calling open-meteo for", t.sheetId, t.latitude, t.longitude);

      const res = await postJson(`${BASE_URL}/api/open-meteo-daily-to-sheets`, {
        sheetId: t.sheetId,
        latitude: t.latitude,
        longitude: t.longitude,
        date: todayIST,
        force: true,
      });

      const body = await res.text().catch(() => "");
      console.log("->", res.status, body.substring(0, 1000));
      results.push(res.ok);
    } catch (e) {
      logFetchError("open-meteo call failed for", t.sheetId, e);
      results.push(false);
    }
  }

  for (const t of imdTargets) {
    try {
      console.log("Calling imd for", t.sheetId, t.stationId);

      const res = await postJson(`${BASE_URL}/api/imd-to-sheets`, {
        sheetId: t.sheetId,
        stationId: t.stationId,
        date: todayIST,
        force: true,
      });

      const body = await res.text().catch(() => "");
      console.log("->", res.status, body.substring(0, 1000));
      results.push(res.ok);
    } catch (e) {
      logFetchError("imd call failed for", t.sheetId, e);
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
  console.error("Fatal error", e?.stack || e);
  process.exit(2);
});
