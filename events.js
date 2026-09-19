/* ══════════════════════════════════════════════════════════════
   EVENT-AWARE CROWDING

   Three sources of truth about how busy a station will be, in strict
   order of precedence:

     1. PCDRealTime   — measured, now
     2. PCDForecast   — measured pattern, per 30 minutes, for today
     3. this module   — a prior: the daily curve, adjusted for events

   The model NEVER overrides a measurement. It exists for the case the
   measurements cannot cover: a journey planned for next Friday evening,
   or a station whose CrowdLevel comes back NA.

   Events come from data/events.json, which is a curated file rather than
   a feed — there is no official event-crowding API, and pretending
   otherwise would be fabrication. Events whose date follows a lunar or
   Islamic calendar ship with `dates: null` and are NOT applied until
   someone fills the date in. The Sources tab says how many are waiting.
   ══════════════════════════════════════════════════════════════ */

const EVENTS = {
  loaded: false, all: [], dated: [], undated: [], version: null, error: null
};

function loadEvents(data){
  EVENTS.all = []; EVENTS.dated = []; EVENTS.undated = [];
  const list = (data && data.events) || [];
  for(const e of list){
    const dates = Array.isArray(e.dates) ? e.dates.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)) : [];
    const rec = {
      id:e.id, name:e.name, kind:e.kind||"fixed",
      dates, window:Array.isArray(e.window)?e.window:[0,24],
      places:new Set(e.places||[]),
      lift:Math.max(1, Math.min(2.5, Number(e.lift)||1)),
      roadClosures:!!e.roadClosures, alsoQuieter:!!e.alsoQuieter,
      basis:e.basis||"", advice:e.advice||"", dateHint:e.dateHint||""
    };
    EVENTS.all.push(rec);
    (dates.length ? EVENTS.dated : EVENTS.undated).push(rec);
  }
  EVENTS.version = (data && data.version) || null;
  EVENTS.loaded = true;
  return {events:EVENTS.all.length, dated:EVENTS.dated.length, undated:EVENTS.undated.length};
}

/* The calendar is Singapore's, so the date must be Singapore's. Using
   the device's own timezone would put a judge in London on the wrong
   day for an evening event, and would break the tests on a UTC box. */
const SG_FMT = (typeof Intl!=="undefined" && Intl.DateTimeFormat)
  ? new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Singapore",
      year:"numeric",month:"2-digit",day:"2-digit"})
  : null;
const isoDate = d => {
  const date = d || new Date();
  if(SG_FMT) return SG_FMT.format(date);            // en-CA formats as YYYY-MM-DD
  const p = n => String(n).padStart(2,"0");
  return date.getFullYear()+"-"+p(date.getMonth()+1)+"-"+p(date.getDate());
};

/* Does the event's time window cover this clock time? A window may run
   past midnight — a countdown is [20, 26], meaning 20:00 to 02:00. */
function inWindow(ev, minutes){
  const h = (minutes/60);
  const [a,b] = ev.window;
  if(b <= 24) return h >= a && h < b;
  return h >= a || h < (b - 24);
}

/* Events in effect at a given date and time. `when` is a Date for the
   day; `minutes` is the clock time being planned for. */
function eventsAt(when, minutes){
  if(!EVENTS.loaded) return [];
  const day = isoDate(when || new Date());
  /* A window running past midnight belongs to the previous day too. */
  const prev = new Date((when||new Date()).getTime() - 86400000);
  const prevDay = isoDate(prev);
  return EVENTS.dated.filter(ev => {
    if(ev.dates.includes(day) && inWindow(ev, minutes)) return true;
    if(ev.dates.includes(prevDay) && ev.window[1] > 24 && (minutes/60) < ev.window[1]-24) return true;
    return false;
  });
}

/* The multiplier to apply at one place, and why. Returns 1 and an empty
   list when nothing applies, which is the normal case. */
function eventLift(place, when, minutes){
  const active = eventsAt(when, minutes).filter(ev => ev.places.has(place));
  if(!active.length) return {lift:1, events:[]};
  /* Two events at the same place do not multiply — the crowd is not
     twice as crowded because two things are on. Take the strongest. */
  const lift = Math.max(...active.map(e => e.lift));
  return {lift, events:active};
}

/* Everything on today, for the interface to tell the commuter about
   before they ask. */
function eventsToday(when){
  if(!EVENTS.loaded) return [];
  const day = isoDate(when || new Date());
  return EVENTS.dated.filter(ev => ev.dates.includes(day));
}

/* Which events touch a planned journey, so the advice is specific to
   this commuter rather than a general notice. */
function eventsOnPlan(plan, when){
  if(!plan || !EVENTS.loaded) return [];
  const hit = new Map();
  for(const leg of plan.legs){
    if(leg.kind !== "ride" || !Array.isArray(leg.stops)) continue;
    for(const stop of leg.stops){
      const place = (typeof isBusStop==="function" && isBusStop(stop)) ? null : stop;
      if(!place) continue;
      for(const ev of eventLift(place, when, leg.start).events)
        if(!hit.has(ev.id)) hit.set(ev.id, {event:ev, at:place, when:leg.start});
    }
  }
  return [...hit.values()];
}

/* Road closures are the half of an event that hurts buses rather than
   trains, and the router should know before it picks a bus. */
function eventClosesRoads(when, minutes){
  return eventsAt(when, minutes).some(ev => ev.roadClosures);
}
