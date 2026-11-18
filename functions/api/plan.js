/* Redaktionsplan über die Google Sheets API (liefert auch die HYPERLINK-URLs,
   die der öffentliche CSV-Export verschluckt). Braucht das Secret GSHEET_KEY
   (Google-API-Key mit aktivierter Sheets API); ohne Key antwortet die Route 503
   und das Panel fällt auf den CSV-Weg zurück. Cache: 6h im KV (Binding CHAT). */

const SHEET_ID = "1hxhg57OGHuDFcFMmd4KRUzKX7d3oU3P4Eyy25jHLt2M";
const TABS = { "553549071": "Redaktionsplan", "882255910": "Meta Paid" };
const TTL_MS = 6 * 3600 * 1000;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json;charset=utf-8", "cache-control": "no-store" }
  });
}

async function sheetValues(tab, key, render) {
  const u = "https://sheets.googleapis.com/v4/spreadsheets/" + SHEET_ID + "/values/" +
    encodeURIComponent("'" + tab + "'!A1:R400") +
    "?valueRenderOption=" + render + "&key=" + encodeURIComponent(key);
  const r = await fetch(u);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j.error && j.error.message) || ("sheets http " + r.status));
  return j.values || [];
}

export async function onRequestGet({ env, request }) {
  const url = new URL(request.url);
  const gid = url.searchParams.get("gid") || "553549071";
  const tab = TABS[gid];
  if (!tab) return json({ error: "gid" }, 400);
  if (!env.GSHEET_KEY) return json({ error: "key" }, 503);

  const cacheKey = "plan:" + gid;
  const force = url.searchParams.get("refresh") === "1";
  if (!force && env.CHAT) {
    try {
      const cached = await env.CHAT.get(cacheKey);
      if (cached) {
        const data = JSON.parse(cached);
        if (data.ts && Date.now() - data.ts < TTL_MS) return json(data);
      }
    } catch (e) { /* frisch holen */ }
  }

  try {
    const [rows, formulas] = await Promise.all([
      sheetValues(tab, env.GSHEET_KEY, "FORMATTED_VALUE"),
      sheetValues(tab, env.GSHEET_KEY, "FORMULA")
    ]);
    const links = {};
    const re = /^=HYPERLINK\(\s*"([^"]+)"\s*[;,]/i;
    formulas.forEach((row, ri) => (row || []).forEach((cell, ci) => {
      if (typeof cell === "string") {
        const m = cell.match(re);
        if (m) links[ri + "," + ci] = m[1];
      }
    }));
    const data = { ts: Date.now(), rows, links };
    if (env.CHAT) { try { await env.CHAT.put(cacheKey, JSON.stringify(data)); } catch (e) {} }
    return json(data);
  } catch (e) {
    if (env.CHAT) {
      try {
        const cached = await env.CHAT.get(cacheKey);
        if (cached) return json(JSON.parse(cached));
      } catch (e2) {}
    }
    return json({ error: String((e && e.message) || e) }, 502);
  }
}
