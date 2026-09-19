/* ══════════════════════════════════════════════════════════════
   THE REAL BUS NETWORK

   Consumes data/bus-index.json as written by fetch-bus-data.mjs:

     stops        { code: {n, r, la, lo} }
     services     { serviceNo: {op, cat} }
     routes       { "service:direction": [stopCode, …] }   in order
     distances    { "service:direction": [km, …] }         cumulative
     stopServices { code: ["service:direction", …] }

   Until this loads, routing uses the twelve modelled corridors and the
   interface says "check the app for the service number". Once it loads,
   every bus leg names the service the commuter actually boards.

   Roughly 5,200 stops and 800 service-directions become ~30,000 graph
   nodes, which is why routing needs a real priority queue.
   ══════════════════════════════════════════════════════════════ */

const BUS_IDX = {
  loaded:false, stops:new Map(), services:new Map(),
  routes:new Map(), dists:new Map(), atStop:new Map(),
  grid:new Map(), edges:0, railJoins:0, builtMs:0, source:null,
  /* name -> [code]. Built with the rest of the index so a commuter can
     type "amber gardens" and be understood. Without it matchPlace only
     ever saw the 144 rail places, and every bus stop in Singapore was
     unreachable by name. */
  byName:new Map(), names:[]
};

/* Stop names are written for a pole, not a search box: "Opp Blk 157A",
   "Bef Jln Eunos", "Aft Braddell Rd". Strip the positional prefixes so
   the name the commuter knows is what matches. */
const STOP_PREFIX = /^(opp|opposite|bef|before|aft|after|bet|between|blk|block)\s+/i;
/* LTA writes stop names for a pole, not a search box: "Amber Gdns",
   "Marine Pde Stn", "Bt Batok Int". A commuter types "Amber Gardens".
   Both are normalised to the same key so either finds the stop. */
const ABBREV = {
  gdns:"gardens", gdn:"garden", pde:"parade", stn:"station", rd:"road",
  ave:"avenue", av:"avenue", st:"street", dr:"drive", cl:"close",
  cres:"crescent", ter:"terrace", pl:"place", lk:"link", wk:"walk",
  int:"interchange", ctr:"centre", cte:"centre", cplx:"complex",
  blk:"block", sch:"school", hosp:"hospital", pk:"park", mkt:"market",
  bt:"bukit", jln:"jalan", lor:"lorong", tg:"tanjong", kg:"kampong",
  upp:"upper", nth:"north", sth:"south", est:"estate", ind:"industrial",
  cmnty:"community", cc:"community club", pri:"primary", sec:"secondary",
  hts:"heights", gr:"grove", vw:"view", ri:"rise", ctrl:"central",
  mrt:"station", ns:"north south", ew:"east west"
};
function normStopName(s){
  return String(s||"").toLowerCase()
    .replace(/[^a-z0-9 ]+/g," ")
    .replace(/\s+/g," ").trim()
    .split(" ").map(w => ABBREV[w] || w).join(" ");
}
function rawStopName(s){
  return String(s||"").toLowerCase().replace(/[^a-z0-9 ]+/g," ")
    .replace(/\s+/g," ").trim();
}
function stopNameKeys(name){
  const full = normStopName(name);
  /* Both the expanded and the literal form. "Ter" is Terrace in a street
     name and Terminal at the airport; indexing both means neither
     reading loses. */
  const keys = new Set([full, rawStopName(name)]);
  let stripped = full;
  while(STOP_PREFIX.test(stripped)) stripped = stripped.replace(STOP_PREFIX,"").trim();
  if(stripped && stripped !== full) keys.add(stripped);
  /* "Marine Pde Stn Exit 2" should also answer to "marine pde stn" */
  const noExit = stripped.replace(/\s+exit\s+\w+$/,"").trim();
  if(noExit && noExit !== stripped) keys.add(noExit);
  return [...keys].filter(Boolean);
}

/* Best matching bus stop for a free-text name, or null. Exact first,
   then prefix, then containment — never a fuzzy guess, because sending
   someone to the wrong stop is worse than saying you do not know. */
function matchBusStop(query){
  if(!BUS_IDX.loaded) return null;
  const raw = normStopName(query);
  /* "opposite amber gardens" is a real, different stop from "amber
     gardens" — the other side of the road. Honour it when the pair
     exists rather than quietly sending them across the street. */
  const wantsOpp = /^(opp|opposite)\s+/.test(raw);
  const q = raw.replace(/^(opp|opposite)\s+/,"").trim();
  if(q.length < 3) return null;
  if(wantsOpp){
    const opp = BUS_IDX.byName.get("opp " + q) || BUS_IDX.byName.get("opposite " + q);
    if(opp && opp.length) return opp[0];
  }
  const hit = BUS_IDX.byName.get(q) || BUS_IDX.byName.get(raw);
  if(hit && hit.length) return hit[0];
  let best=null, bestLen=Infinity;
  for(const [name, codes] of BUS_IDX.byName){
    if(name.length >= bestLen) continue;
    if(name.startsWith(q) || q.startsWith(name) || name.includes(q)){
      best = codes[0]; bestLen = name.length;
    }
  }
  return best;
}
function searchBusStops(query, limit){
  if(!BUS_IDX.loaded) return [];
  const q = normStopName(query);
  if(q.length < 2) return [];
  const out=[];
  for(const [name, codes] of BUS_IDX.byName){
    if(name.startsWith(q)) out.push({code:codes[0], name, score:0});
    else if(name.includes(q)) out.push({code:codes[0], name, score:1});
    if(out.length > 400) break;
  }
  out.sort((a,b)=>a.score-b.score || a.name.length-b.name.length);
  return out.slice(0, limit||8);
}

/* ---- spatial index ------------------------------------------
   A flat grid. Singapore is 50 km across and we only ever ask for
   small radii, so this beats anything cleverer. ~0.0018° ≈ 200 m. */
const BCELL = 0.0018;
function gridPut(code, la, lo){
  const k = Math.round(la/BCELL)+":"+Math.round(lo/BCELL);
  if(!BUS_IDX.grid.has(k)) BUS_IDX.grid.set(k,[]);
  BUS_IDX.grid.get(k).push(code);
}
/* Every stop within `radius` metres of a point, nearest first. */
function stopsNear(la, lo, radius){
  const span = Math.ceil(radius/(BCELL*111000));
  const cy = Math.round(la/BCELL), cx = Math.round(lo/BCELL);
  const out = [];
  for(let dy=-span; dy<=span; dy++) for(let dx=-span; dx<=span; dx++){
    const bucket = BUS_IDX.grid.get((cy+dy)+":"+(cx+dx));
    if(!bucket) continue;
    for(const code of bucket){
      const s = BUS_IDX.stops.get(code);
      if(!s) continue;
      const m = haversine([la,lo],[s.la,s.lo]);
      if(m!=null && m<=radius) out.push({code, metres:m, stop:s});
    }
  }
  return out.sort((a,b)=>a.metres-b.metres);
}

/* ---- identity ------------------------------------------------
   A stop is addressed by its five-digit code. Descriptions repeat all
   over the island — there are dozens of stops called "Blk 123". */
const isBusStop   = x => BUS_IDX.loaded && BUS_IDX.stops.has(String(x));
const busStop     = x => BUS_IDX.stops.get(String(x)) || null;
const busStopName = x => { const s = busStop(x); return s ? s.n : String(x); };
const busStopLabel= x => { const s = busStop(x); return s ? `${s.n} (${x})` : String(x); };
const busStopRoad = x => { const s = busStop(x); return s ? s.r : ""; };
const serviceNo   = key => String(key).split(":")[0];

/* Which services call at a stop. Indexed on load, so this is a lookup
   rather than a scan of 26,000 route rows. */
function servicesAt(code){
  const set = BUS_IDX.atStop.get(String(code));
  return set ? [...set].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})) : [];
}

/* The question the brief actually poses: given two stops, which single
   service joins them, boarding at A and alighting at B, in that order?
   Backs both the route renderer and the /api/bus endpoint. */
function servicesBetween(fromCode, toCode){
  const a = String(fromCode), b = String(toCode);
  const out = [];
  for(const key of (BUS_IDX.atStop.get(a) ? routesThrough(a) : [])){
    const seq = BUS_IDX.routes.get(key);
    if(!seq) continue;
    const i = seq.indexOf(a);
    if(i < 0) continue;
    const j = seq.indexOf(b, i+1);          // must come AFTER boarding
    if(j < 0) continue;
    const d = BUS_IDX.dists.get(key);
    out.push({
      service: serviceNo(key), direction: Number(key.split(":")[1]),
      stops: j - i,
      km: d ? Math.round((d[j]-d[i])*10)/10 : null,
      operator: (BUS_IDX.services.get(serviceNo(key))||{}).op || null
    });
  }
  return out.sort((x,y)=>x.stops-y.stops);
}
/* service-directions calling at a stop, as keys */
function routesThrough(code){
  const svcs = BUS_IDX.atStop.get(String(code));
  if(!svcs) return [];
  const keys = [];
  for(const key of BUS_IDX.routes.keys())
    if(svcs.has(serviceNo(key)) && BUS_IDX.routes.get(key).includes(String(code))) keys.push(key);
  return keys;
}

/* ---- loading -------------------------------------------------- */
function loadBusIndex(data, opts){
  opts = opts || {};
  const t0 = (typeof performance!=="undefined" ? performance.now() : Date.now());

  BUS_IDX.stops.clear(); BUS_IDX.services.clear(); BUS_IDX.routes.clear();
  BUS_IDX.dists.clear(); BUS_IDX.atStop.clear(); BUS_IDX.grid.clear();
  BUS_IDX.edges = 0; BUS_IDX.railJoins = 0;

  let dropped = 0;
  for(const [code, s] of Object.entries(data.stops||{})){
    const la = Number(s.la), lo = Number(s.lo);
    // A few rows carry 0,0. Dropping them beats plotting the Gulf of Guinea.
    if(!isFinite(la) || !isFinite(lo) || (la===0 && lo===0)){ dropped++; continue; }
    BUS_IDX.stops.set(code, {n:s.n||code, r:s.r||"", la, lo});
    for(const k of stopNameKeys(s.n||code)){
      if(!BUS_IDX.byName.has(k)) BUS_IDX.byName.set(k, []);
      BUS_IDX.byName.get(k).push(code);
    }
    gridPut(code, la, lo);
  }
  for(const [no, meta] of Object.entries(data.services||{})) BUS_IDX.services.set(no, meta);
  for(const [key, seq] of Object.entries(data.routes||{}))
    if(Array.isArray(seq) && seq.length>1) BUS_IDX.routes.set(key, seq.map(String));
  for(const [key, d] of Object.entries(data.distances||{})) BUS_IDX.dists.set(key, d);

  /* stopServices in the file is stop -> ["svc:dir"]. We want the plain
     service numbers for display, and keep the keys for routing. */
  for(const [code, keys] of Object.entries(data.stopServices||{})){
    if(!BUS_IDX.stops.has(code)) continue;
    BUS_IDX.atStop.set(code, new Set(keys.map(serviceNo)));
  }

  BUS_IDX.dropped = dropped;
  BUS_IDX.source = data.source || "LTA DataMall";
  BUS_IDX.generated = data.generated || null;

  buildBusGraph(opts);

  BUS_IDX.loaded = BUS_IDX.stops.size > 0 && BUS_IDX.routes.size > 0;
  BUS_IDX.builtMs = Math.round((typeof performance!=="undefined" ? performance.now() : Date.now()) - t0);
  return {
    stops:BUS_IDX.stops.size,
    services:new Set([...BUS_IDX.routes.keys()].map(serviceNo)).size,
    directions:BUS_IDX.routes.size,
    edges:BUS_IDX.edges, railJoins:BUS_IDX.railJoins, ms:BUS_IDX.builtMs, dropped
  };
}

/* node ids. `route()` splits on the first "|" to get the place, so the
   stop code must sit on the right of it in both forms. */
const stopNode = code        => "S|" + code;
const rideNode = (key, code) => "V:" + key + "|" + code;

/* Speed is not a constant. A 400 m hop between two kerbside stops is
   dominated by dwell and traffic lights; a 12 km run down the PIE on an
   express service is not. A flat figure made express services absurd —
   service 646 came out at 108 minutes for three stops.

   So speed rises with hop length and flattens out: about 19 km/h for a
   short urban hop, rising towards 50 km/h on a long expressway leg. The
   road factor in route() then moves the whole thing with time of day. */
function busKmh(km){ return 15 + 40*(km/(km+4)); }

function buildBusGraph(opts){
  const add = (a,b,w,meta) => { link(a,b,w,meta); BUS_IDX.edges++; };

  /* 1. Riding between consecutive stops on one service-direction. */
  for(const [key, seq] of BUS_IDX.routes){
    const d = BUS_IDX.dists.get(key);
    for(let i=0; i<seq.length-1; i++){
      const a = seq[i], b = seq[i+1];
      if(!BUS_IDX.stops.has(a) || !BUS_IDX.stops.has(b)) continue;
      let km = (d && isFinite(d[i]) && isFinite(d[i+1])) ? Math.max(0, d[i+1]-d[i]) : 0;
      if(!km){
        const A = BUS_IDX.stops.get(a), B = BUS_IDX.stops.get(b);
        km = (haversine([A.la,A.lo],[B.la,B.lo])||400)/1000 * 1.25;  // roads are not straight
      }
      add(rideNode(key,a), rideNode(key,b), Math.max(0.6, km*(60/busKmh(km))),
          {kind:"ride", mode:"bus", line:key, real:true});
    }
    /* 2. Boarding and alighting. The wait on boarding is what stops the
          router hopping between services to shave a minute. The service
          key travels on the edge so the router can look up its published
          headway and its operating hours at the time of travel. */
    for(const code of seq){
      if(!BUS_IDX.stops.has(code)) continue;
      add(stopNode(code), rideNode(key,code), 0,
          {kind:"board",  mode:"bus", line:key, at:code});
      add(rideNode(key,code), stopNode(code), 0.5,
          {kind:"alight", mode:"bus", line:key, at:code});
    }
  }

  /* 3. Walking between nearby stops, so a change can cross a road.
        Capped at 180 m and six neighbours: past that it is edges nobody
        would walk and a slower search. */
  const NEAR = opts.stopWalkRadius ?? 180;
  for(const [code, s] of BUS_IDX.stops){
    const near = stopsNear(s.la, s.lo, NEAR).filter(n=>n.code!==code).slice(0,6);
    for(const n of near)
      add(stopNode(code), stopNode(n.code), Math.max(1, (n.metres/80)),
          {kind:"transfer", mode:"bus", at:n.code, from:"bus", toMode:"bus", line:"WALKSTOP"});
  }

  /* 4. Joining bus to rail. COORD already holds real station positions,
        so this is a distance join rather than a name guess. */
  const RAIL_R = opts.railRadius ?? 350;
  for(const [station, c] of Object.entries(COORD)){
    if(!STATIONS.has(station)) continue;
    for(const n of stopsNear(c[0], c[1], RAIL_R).slice(0,5)){
      const mins = Math.max(2, n.metres/80 + 1);     // +1 to get out of the concourse
      for(const k of STATIONS.get(station)){
        add(nid(k,station), stopNode(n.code), mins,
            {kind:"transfer", mode:"bus",  at:n.code,  from:"rail", toMode:"bus",  line:"TOBUS"});
        add(stopNode(n.code), nid(k,station), mins,
            {kind:"transfer", mode:"rail", at:station, from:"bus",  toMode:"rail", line:k});
      }
      BUS_IDX.railJoins++;
    }
  }
}

/* ---- waiting, and whether the bus is running at all ------------
   Two questions the published data answers and a model cannot. */

const dayTypeOf = d => { const x=(d||new Date()).getDay(); return x===0?"sun":x===6?"sat":"wd"; };

/* Which of the four published bands applies at this time. */
function bandFor(freq, minutes){
  if(!freq) return null;
  const h = Math.floor(minutes/60)%24;
  if(h>=6  && h<9)  return freq.amPeak || freq.amOff;
  if(h>=17 && h<20) return freq.pmPeak || freq.pmOff;
  if(h<12)          return freq.amOff  || freq.amPeak;
  return freq.pmOff || freq.pmPeak || freq.amOff;
}

/* Expected wait for a passenger turning up at random is about half the
   headway. BusServices publishes the headway as a band, so use it; the
   modelled figure is only a fallback for services with no band, and the
   interface says which one it used. */
function busWait(key, minutes, dayType){
  const meta = BUS_IDX.services.get(String(key));
  const band = bandFor(meta && meta.freq, minutes);
  if(band){
    const mid = (band[0] + band[1]) / 2;
    return { mins: Math.max(1.5, mid/2), source: "published", band };
  }
  const h = Math.floor(minutes/60)%24;
  const mins = (h>=7&&h<10) ? 4 : (h>=17&&h<20) ? 4.5 : (h>=23||h<6) ? 12 : 7;
  return { mins, source: "modelled", band: null };
}
/* The router only wants the number. */
const busWaitMins = (key, minutes) => busWait(key, minutes).mins;

/* Is this service running at this time, on this kind of day?

   Routing someone onto a bus that stopped at 23:20 is worse than
   offering no bus at all, and it is the single most common way a
   transit app loses a user's trust. Services with no published hours
   are assumed to run — we do not invent a restriction either. */
function serviceRunning(key, minutes, dayType){
  const meta = BUS_IDX.services.get(String(key));
  const hours = meta && meta.hours && meta.hours[dayType || BUS_IDX.dayType || "wd"];
  if(!hours) return true;
  const [first, last] = hours;
  if(first == null || last == null) return true;
  const t = ((minutes % 1440) + 1440) % 1440;
  /* A last bus after midnight wraps: 0530–0015 is a normal span. */
  return last >= first ? (t >= first && t <= last) : (t >= first || t <= last);
}
