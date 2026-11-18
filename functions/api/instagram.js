/* Instagram Insights über die Meta Graph API.
   Token liegt als Secret IG_TOKEN auf dem Pages-Projekt (nie im Client-Code).
   Antwort wird 6h im KV (Binding CHAT) gecacht, damit die Graph API nicht bei jedem
   Seitenaufruf angefragt wird. ?refresh=1 erzwingt einen frischen Abruf. */

const IG_ID = "17841475906249079"; // drihanna_by_ana (Instagram Business Account)
const V = "v23.0";
const CACHE_KEY = "ig:cache:v1";
const TTL_MS = 6 * 3600 * 1000;
const MAX_POSTS = 40;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json;charset=utf-8", "cache-control": "no-store" }
  });
}

async function gfetch(path, token, params) {
  const u = new URL("https://graph.facebook.com/" + V + "/" + path);
  for (const k in (params || {})) u.searchParams.set(k, params[k]);
  u.searchParams.set("access_token", token);
  const r = await fetch(u.toString());
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) {
    const e = new Error((j.error && j.error.message) || ("graph http " + r.status));
    e.code = j.error && j.error.code;
    throw e;
  }
  return j;
}

async function mediaInsights(id, token) {
  const sets = [
    "views,reach,likes,comments,saved,shares,total_interactions",
    "reach,saved,shares,total_interactions",
    "reach"
  ];
  for (const metric of sets) {
    try {
      const j = await gfetch(id + "/insights", token, { metric });
      const out = {};
      for (const m of (j.data || [])) {
        const v = m.values && m.values[0] && m.values[0].value;
        if (typeof v === "number") out[m.name] = v;
      }
      return out;
    } catch (e) { /* nächster, kleinerer Metrik-Satz */ }
  }
  return {};
}

async function fetchAll(token) {
  const account = await gfetch(IG_ID, token, { fields: "username,followers_count,media_count" });

  const media = await gfetch(IG_ID + "/media", token, {
    fields: "id,caption,timestamp,media_type,media_product_type,permalink,like_count,comments_count",
    limit: String(MAX_POSTS)
  });

  const posts = [];
  for (const m of (media.data || []).slice(0, MAX_POSTS)) {
    const ins = await mediaInsights(m.id, token);
    posts.push({
      id: m.id,
      date: m.timestamp,
      caption: m.caption || "",
      type: m.media_type,
      product: m.media_product_type,
      permalink: m.permalink,
      likes: typeof ins.likes === "number" ? ins.likes : (m.like_count ?? null),
      comments: typeof ins.comments === "number" ? ins.comments : (m.comments_count ?? null),
      reach: ins.reach ?? null,
      saved: ins.saved ?? null,
      shares: ins.shares ?? null,
      views: ins.views ?? null,
      total_interactions: ins.total_interactions ?? null
    });
  }

  // Neue Follower: Tageswerte der letzten 30 Tage (Graph-Limit), Summe
  let followerGain = null;
  try {
    const until = Math.floor(Date.now() / 1000);
    const since = until - 30 * 86400;
    const j = await gfetch(IG_ID + "/insights", token, {
      metric: "follower_count", period: "day", since: String(since), until: String(until)
    });
    const vals = j.data && j.data[0] && j.data[0].values || [];
    if (vals.length) followerGain = vals.reduce((s, v) => s + (typeof v.value === "number" ? v.value : 0), 0);
  } catch (e) { /* Konto evtl. unter 100 Follower oder Metrik nicht verfügbar */ }

  return {
    account: {
      username: account.username,
      followers: account.followers_count ?? null,
      media_count: account.media_count ?? null
    },
    follower_gain_30d: followerGain,
    posts
  };
}

export async function onRequestGet({ env, request }) {
  if (!env.CHAT) return json({ error: "setup" }, 503);
  if (!env.IG_TOKEN) return json({ error: "token" }, 503);

  const force = new URL(request.url).searchParams.get("refresh") === "1";
  if (!force) {
    try {
      const cached = await env.CHAT.get(CACHE_KEY);
      if (cached) {
        const data = JSON.parse(cached);
        if (data.ts && Date.now() - data.ts < TTL_MS) return json(data);
      }
    } catch (e) { /* Cache defekt -> frisch holen */ }
  }

  try {
    const data = await fetchAll(env.IG_TOKEN);
    data.ts = Date.now();
    await env.CHAT.put(CACHE_KEY, JSON.stringify(data));
    return json(data);
  } catch (e) {
    // Fallback: lieber alter Stand als gar keiner
    try {
      const cached = await env.CHAT.get(CACHE_KEY);
      if (cached) return json(JSON.parse(cached));
    } catch (e2) { /* ignore */ }
    return json({ error: String((e && e.message) || e) }, 502);
  }
}
