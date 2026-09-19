/* Bus network lookup, server side.

   The browser loads data/bus-index.json and answers these questions
   locally, which is what keeps the app working underground. This
   endpoint answers the same questions without that download — useful
   for a thin client, for debugging, and for checking a claim in the
   interface against the source data.

     GET /api/bus?stop=83139              which services call here
     GET /api/bus?from=75009&to=03129     which services join two stops
     GET /api/bus?q=tampines              search stops by name or road

   Reads the same generated file the front end does, so the two can
   never disagree. */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const FILE = fileURLToPath(new URL("../../data/bus-index.json", import.meta.url));

let INDEX = null, loadError = null;
async function index() {
  if (INDEX || loadError) return INDEX;
  try {
    INDEX = JSON.parse(await readFile(FILE, "utf8"));
  } catch (e) {
    loadError = e.message;
    console.error("bus-index.json not readable:", e.message);
  }
  return INDEX;
}

const no = key => String(key).split(":")[0];

/* Services joining two stops, boarding at `from` and alighting at `to`
   in that order. Direction matters: a service that passes both stops
   the other way round is not an answer. */
function between(db, from, to) {
  const out = [];
  for (const [key, seq] of Object.entries(db.routes)) {
    const i = seq.indexOf(from);
    if (i < 0) continue;
    const j = seq.indexOf(to, i + 1);
    if (j < 0) continue;
    const d = db.distances[key];
    out.push({
      service: no(key),
      direction: Number(key.split(":")[1]),
      stops: j - i,
      km: d && isFinite(d[i]) && isFinite(d[j]) ? Math.round((d[j] - d[i]) * 10) / 10 : null,
      operator: (db.services[no(key)] || {}).op || null
    });
  }
  return out.sort((a, b) => a.stops - b.stops);
}

export default async (request) => {
  const db = await index();
  if (!db) {
    return Response.json(
      { error: "bus index not built. Run: LTA_ACCOUNT_KEY=... node fetch-bus-data.mjs" },
      { status: 503 }
    );
  }

  const p = new URL(request.url).searchParams;
  const stop = p.get("stop"), from = p.get("from"), to = p.get("to"), q = p.get("q");
  const cache = { "cache-control": "public, max-age=86400" };   // reference data

  if (from && to) {
    if (!db.stops[from] || !db.stops[to])
      return Response.json({ error: "unknown stop code", from, to }, { status: 404 });
    const services = between(db, from, to);
    return Response.json({
      from: { code: from, ...db.stops[from] },
      to:   { code: to,   ...db.stops[to] },
      direct: services.length > 0,
      services
    }, { headers: cache });
  }

  if (stop) {
    const meta = db.stops[stop];
    if (!meta) return Response.json({ error: "unknown stop code", stop }, { status: 404 });
    const services = [...new Set((db.stopServices[stop] || []).map(no))]
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    return Response.json({ stop: { code: stop, ...meta }, services }, { headers: cache });
  }

  if (q) {
    const t = q.toLowerCase().trim();
    const hits = [];
    for (const [code, m] of Object.entries(db.stops)) {
      const n = (m.n || "").toLowerCase(), r = (m.r || "").toLowerCase();
      if (code.startsWith(t) || n.includes(t) || r.includes(t))
        hits.push({ code, ...m });
      if (hits.length >= 25) break;
    }
    return Response.json({ query: q, count: hits.length, stops: hits }, { headers: cache });
  }

  return Response.json({
    generated: db.generated,
    source: db.source,
    stops: Object.keys(db.stops).length,
    services: Object.keys(db.services).length,
    directions: Object.keys(db.routes).length,
    usage: ["?stop=83139", "?from=75009&to=03129", "?q=tampines"]
  }, { headers: cache });
};
