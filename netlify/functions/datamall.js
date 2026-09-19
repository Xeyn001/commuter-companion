/* LTA DataMall proxy.

   DataMall sends no CORS headers and needs an AccountKey, so a browser
   cannot call it directly and the key must never reach the client.
   This function holds the key and forwards a narrow allow-list.

   Usage:  /.netlify/functions/datamall?path=v3/BusArrival&BusStopCode=83139
           /.netlify/functions/datamall?path=PCDRealTime&TrainLine=NSL
           /.netlify/functions/datamall?path=BusStops&all=1     (auto-pages)

   Responses page 500 rows at a time via $skip. Pass all=1 and the
   proxy walks the pages for you, up to PAGE_CAP, and returns one
   array. That is for reference data only — never for a live feed. */

const ALLOWED = new Map([
  // --- live service state -------------------------------------
  ["TrainServiceAlerts",        {ttl:45}],
  ["PCDRealTime",               {ttl:240}],   // station crowd density, 10 min refresh
  ["PCDForecast",               {ttl:3600}],  // published once a day
  ["v3/BusArrival",             {ttl:20}],
  ["v2/FacilitiesMaintenance",  {ttl:900}],   // lift outages, per lift and exit
  // --- roads: the "planned event" half of the brief -------------
  ["TrafficIncidents",          {ttl:60}],
  ["RoadWorks",                 {ttl:1800}],
  ["RoadOpenings",              {ttl:1800}],
  ["v4/TrafficSpeedBands",      {ttl:120}],
  ["EstTravelTimes",            {ttl:180}],
  ["VMS",                       {ttl:120}],
  ["PlannedBusRoutes",          {ttl:3600}],
  // --- reference data -----------------------------------------
  ["BusServices",               {ttl:86400, pageable:true}],
  ["BusStops",                  {ttl:86400, pageable:true}],
  ["BusRoutes",                 {ttl:86400, pageable:true}],
  ["PV/Train",                  {ttl:86400}],
  ["Taxi-Availability",         {ttl:60}],
  ["CarParkAvailabilityv2",     {ttl:60}]
]);

const BASE = "https://datamall2.mytransport.sg/ltaodataservice/";
const PAGE  = 500;
const PAGE_CAP = 12;          // 6000 rows is the whole bus-stop network

export default async (request) => {
  const key = process.env.LTA_ACCOUNT_KEY;
  if (!key) {
    return Response.json({ error: "LTA_ACCOUNT_KEY is not set on this deploy." },
      { status: 503 });
  }

  const url  = new URL(request.url);
  const path = url.searchParams.get("path");
  const spec = ALLOWED.get(path);
  if (!spec) {
    return Response.json({ error: "Unknown endpoint.", allowed: [...ALLOWED.keys()] },
      { status: 400 });
  }

  const params = new URLSearchParams(url.searchParams);
  const wantAll = params.get("all") === "1" && spec.pageable;
  params.delete("path"); params.delete("all");

  const call = async skip => {
    const p = new URLSearchParams(params);
    if (skip) p.set("$skip", String(skip));
    const target = BASE + path + (p.toString() ? "?" + p : "");
    const r = await fetch(target, { headers: { AccountKey: key, accept: "application/json" } });
    if (!r.ok) throw new Error("datamall " + r.status);
    return r.json();
  };

  try {
    if (!wantAll) {
      const body = await call(0);
      return Response.json(body, { headers: {
        "content-type": "application/json",
        "cache-control": `public, max-age=${spec.ttl}` } });
    }
    const rows = [];
    for (let i = 0; i < PAGE_CAP; i++) {
      const page = await call(i * PAGE);
      const v = Array.isArray(page && page.value) ? page.value : [];
      rows.push(...v);
      if (v.length < PAGE) break;
    }
    return Response.json({ value: rows, count: rows.length }, { headers: {
      "cache-control": `public, max-age=${spec.ttl}` } });
  } catch (err) {
    return Response.json({ error: String(err.message) }, { status: 502 });
  }
};
