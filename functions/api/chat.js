/* Chat-API für das Drihanna-Panel — Cloudflare Pages Function mit KV-Bindung "CHAT". */

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

export async function onRequestGet({ env }) {
  if (!env.CHAT) return json({ error: "setup" }, 503);
  const list = await env.CHAT.list({ prefix: "m:", limit: 1000 });
  const keys = list.keys.slice(-250);
  const msgs = [];
  for (const k of keys) {
    const v = await env.CHAT.get(k.name, "json");
    if (v && v.ts) msgs.push(v);
  }
  msgs.sort((a, b) => a.ts - b.ts);
  return json({ messages: msgs });
}

export async function onRequestPost({ request, env }) {
  if (!env.CHAT) return json({ error: "setup" }, 503);
  let b = null;
  try { b = await request.json(); } catch (e) {}
  const name  = ((b && b.name)  || "").trim().slice(0, 40);
  const text  = ((b && b.text)  || "").trim().slice(0, 1000);
  const topic = ((b && b.topic) || "").trim().slice(0, 90);
  if (!name || !text) return json({ error: "Name und Nachricht sind Pflicht." }, 400);
  const ts = Date.now();
  const id = "m:" + String(ts).padStart(14, "0") + ":" + Math.random().toString(36).slice(2, 8);
  const msg = { ts: ts, name: name, text: text, topic: topic };
  await env.CHAT.put(id, JSON.stringify(msg));
  return json({ ok: true, message: msg });
}
