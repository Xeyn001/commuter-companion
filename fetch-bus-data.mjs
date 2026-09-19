/* Pulls the static bus reference data out of LTA DataMall, once.

   Run:
     # macOS / Linux
     LTA_ACCOUNT_KEY='your-key-here' node fetch-bus-data.mjs

     # Windows PowerShell
     $env:LTA_ACCOUNT_KEY='your-key-here'; node fetch-bus-data.mjs

   Writes into ./data/ :
     bus-stops.json     ~5,000 stops   code, road, description, lat, lon
     bus-routes.json    ~26,000 rows   service number + stop sequence
     bus-services.json  ~700 services  operator, category, termini
     bus-index.json     the derived lookup the app actually uses

   The three raw files are public reference data and are safe to
   commit. Your AccountKey is read from the environment and is never
   written to any of them — check before you push if you like.

   This is deliberately a build-time step, not a runtime one. The
   network is 30,000 rows; a commuter standing on a platform should
   not be downloading it. */

import { writeFileSync, mkdirSync, existsSync } from "node:fs";

const KEY = process.env.LTA_ACCOUNT_KEY;
if (!KEY) {
  console.error("\n  LTA_ACCOUNT_KEY is not set.\n");
  console.error("  macOS/Linux : LTA_ACCOUNT_KEY='...' node fetch-bus-data.mjs");
  console.error("  PowerShell  : $env:LTA_ACCOUNT_KEY='...'; node fetch-bus-data.mjs\n");
  process.exit(1);
}

const BASE = "https://datamall2.mytransport.sg/ltaodataservice/";
const PAGE = 500;

/* DataMall pages 500 rows at a time via $skip and simply returns a
   short page when it runs out. Cap is a guard against an endless
   loop if that ever changes. */
async function pull(path, cap = 80) {
  const rows = [];
  for (let i = 0; i < cap; i++) {
    const url = `${BASE}${path}?$skip=${i * PAGE}`;
    let r;
    try {
      r = await fetch(url, { headers: { AccountKey: KEY, accept: "application/json" } });
    } catch (e) {
      throw new Error(`network error on ${path}: ${e.message}`);
    }
    if (r.status === 401 || r.status === 403)
      throw new Error(`${path}: ${r.status} — key rejected. Is it active yet?`);
    if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
    const body = await r.json();
    const page = Array.isArray(body.value) ? body.value : [];
    rows.push(...page);
    process.stdout.write(`\r  ${path}: ${rows.length} rows`);
    if (page.length < PAGE) break;
    await new Promise(s => setTimeout(s, 120));   // be polite
  }
  process.stdout.write("\n");
  return rows;
}

if (!existsSync("data")) mkdirSync("data");

console.log("\nFetching from LTA DataMall\n");
const stops    = await pull("BusStops");
const routes   = await pull("BusRoutes");
const services = await pull("BusServices");

writeFileSync("data/bus-stops.json",    JSON.stringify(stops));
writeFileSync("data/bus-routes.json",   JSON.stringify(routes));
writeFileSync("data/bus-services.json", JSON.stringify(services));

/* ---- derive the lookup the app needs ----------------------------
   Two questions have to be answerable in a few milliseconds on a
   phone:
     1. which services call at this stop, and in what order
     2. given stop A and stop B, which single service joins them,
        boarding at A and alighting at B, in that direction
   A forward index (stop -> services) and a per-service ordered stop
   list answer both without scanning 26,000 rows each time. */
const byStop = new Map();          // BusStopCode -> Set("service:direction")
const byService = new Map();       // "service:direction" -> [{seq, code, dist}]

for (const r of routes) {
  const code = String(r.BusStopCode || "").trim();
  const svc  = String(r.ServiceNo   || "").trim();
  if (!code || !svc) continue;
  const key = svc + ":" + r.Direction;
  if (!byStop.has(code)) byStop.set(code, new Set());
  byStop.get(code).add(key);
  if (!byService.has(key)) byService.set(key, []);
  byService.get(key).push({
    seq: Number(r.StopSequence), code, dist: Number(r.Distance) || 0
  });
}
for (const list of byService.values()) list.sort((a, b) => a.seq - b.seq);

const stopMeta = {};
for (const s of stops) {
  const code = String(s.BusStopCode || "").trim();
  if (!code) continue;
  stopMeta[code] = {
    n: s.Description || s.RoadName || code,
    r: s.RoadName || "",
    la: Number(s.Latitude),  lo: Number(s.Longitude)
  };
}

const svcMeta = {};
for (const s of services) {
  const k = String(s.ServiceNo || "").trim();
  if (!k) continue;
  svcMeta[k] = { op: s.Operator || "", cat: s.Category || "" };
}

writeFileSync("data/bus-index.json", JSON.stringify({
  generated: new Date().toISOString(),
  source: "LTA DataMall BusStops / BusRoutes / BusServices",
  stops: stopMeta,
  services: svcMeta,
  routes: Object.fromEntries([...byService].map(([k, v]) => [k, v.map(x => x.code)])),
  distances: Object.fromEntries([...byService].map(([k, v]) => [k, v.map(x => x.dist)])),
  stopServices: Object.fromEntries([...byStop].map(([k, v]) => [k, [...v]]))
}));

const bytes = n => (n / 1024 / 1024).toFixed(1) + " MB";
console.log(`
  stops      ${stops.length}
  routes     ${routes.length}
  services   ${services.length}
  distinct service-directions ${byService.size}

  written to ./data/ — bus-index.json is the one the app loads.
  Commit all four. None of them contains your key.
`);

/* A quick sanity check you can eyeball: two stops that should be
   joined by a direct service. */
const sample = [...byService.entries()].find(([, v]) => v.length > 12);
if (sample) {
  const [key, list] = sample;
  const a = list[0].code, b = list[Math.min(8, list.length - 1)].code;
  console.log(`  sanity: service ${key.split(":")[0]} runs`,
    `${stopMeta[a]?.n || a} (${a}) -> ${stopMeta[b]?.n || b} (${b})\n`);
}
