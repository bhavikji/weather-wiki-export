import { NextResponse } from "next/server";
import { SHEET_OPTIONS } from "@/app/data/sheetId";
import { IMD_SHEET_OPTIONS } from "@/app/data/imdSheetId";

export const runtime = "nodejs";
// Extend timeout on Vercel Pro (max 300s). Remove or lower if on Hobby plan (max 10s).
export const maxDuration = 300;

type CronResult = {
  type: string;
  sheetId: string;
  status: number;
  ok: boolean;
  body?: string;
};

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const todayIST = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const host = req.headers.get("host") ?? process.env.VERCEL_URL ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const baseUrl = `${protocol}://${host}`;

  console.log(`[cron] date=${todayIST} baseUrl=${baseUrl}`);

  const results: CronResult[] = [];

  for (const t of SHEET_OPTIONS) {
    if (!t.value || t.latitude == null || t.longitude == null) continue;

    try {
      const res = await fetch(`${baseUrl}/api/open-meteo-daily-to-sheets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sheetId: t.value,
          latitude: t.latitude,
          longitude: t.longitude,
          date: todayIST,
          force: true,
        }),
      });
      const body = await res.text().catch(() => "");
      console.log(`[cron] [open-meteo] ${t.label} (${t.latitude}, ${t.longitude}) — sheetId=${t.value} -> ${res.status} ${body.slice(0, 200)}`);
      results.push({ type: "open-meteo", sheetId: t.value, status: res.status, ok: res.ok, body: body.slice(0, 200) });
    } catch (e) {
      console.error(`[cron] [open-meteo] ${t.label} threw:`, e);
      results.push({ type: "open-meteo", sheetId: t.value, status: 0, ok: false });
    }
  }

  for (const t of IMD_SHEET_OPTIONS) {
    if (!t.value || !t.station_id) continue;

    try {
      const res = await fetch(`${baseUrl}/api/imd-to-sheets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sheetId: t.value,
          stationId: String(t.station_id),
          date: todayIST,
          force: true,
        }),
      });
      const body = await res.text().catch(() => "");
      console.log(`[cron] [imd] ${t.label} (stationId=${t.station_id}) — sheetId=${t.value} -> ${res.status} ${body.slice(0, 200)}`);
      results.push({ type: "imd", sheetId: t.value, status: res.status, ok: res.ok, body: body.slice(0, 200) });
    } catch (e) {
      console.error(`[cron] [imd] ${t.label} threw:`, e);
      results.push({ type: "imd", sheetId: t.value, status: 0, ok: false });
    }
  }

  const allOk = results.every((r) => r.ok);
  console.log(`[cron] done date=${todayIST} allOk=${allOk} total=${results.length}`);

  return NextResponse.json(
    { date: todayIST, allOk, total: results.length, results },
    { status: allOk ? 200 : 207 },
  );
}
