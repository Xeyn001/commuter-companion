/* Live rail disruptions — LTA DataMall TrainServiceAlerts.

   This is the official structured feed for train service
   unavailability. It replaced an earlier version of this function
   that read the public SGMRT Telegram preview page. That was a
   scrape, and PS2 section 2.5 is explicit that scraping is not
   acceptable for this problem statement when an official API exists.
   One does. We use it.

   The Telegram channel still has a role, but a different one: it is
   an archive of how these notices are actually worded, which we used
   offline while building the advice generator. Nothing in the running
   app fetches it.

   Response shape (DataMall v6.8):
     Status            1 = normal / minor delays, 2 = disrupted
     AffectedSegments  [] on a normal day. One entry per stretch.
     Message           separate list; Content + CreatedDate

   The mitigation is in the feed: when LTA activates free bus boarding
   or a shuttle, FreePublicBus and FreeMRTShuttle say where, so we do
   not have to guess which buses might help. */

const BASE = "https://datamall2.mytransport.sg/ltaodataservice/";

/* TrainServiceAlerts line codes differ from the crowd-density ones.
   engine.js holds the canonical table; this is the alerts half. */
const LINE_MAP = {
  NSL:"NS", EWL:"EW", CGL:"CG", NEL:"NE", CCL:"CC", CEL:"CE",
  DTL:"DT", TEL:"TE", BPL:"BPL", STL:"STL", PTL:"PTL"
};
const codeLine = c => {
  const m = String(c).match(/^([A-Z]+)\d/);
  return m ? ({NS:"NS",EW:"EW",CG:"CG",NE:"NE",CC:"CC",CE:"CE",DT:"DT",TE:"TE"}[m[1]] || null) : null;
};

export default async () => {
  const key = process.env.LTA_ACCOUNT_KEY;
  if (!key) {
    return Response.json([], { status: 200,
      headers: { "x-feed-mode": "no-key", "cache-control": "no-store" } });
  }

  let payload;
  try {
    const r = await fetch(BASE + "TrainServiceAlerts",
      { headers: { AccountKey: key, accept: "application/json" } });
    if (!r.ok) throw new Error("datamall " + r.status);
    payload = await r.json();
  } catch (err) {
    return Response.json([], { status: 200,
      headers: { "x-feed-error": String(err.message) } });
  }

  const value = payload && payload.value ? payload.value : {};
  const status = Number(value.Status != null ? value.Status : 1);
  const segments = Array.isArray(value.AffectedSegments) ? value.AffectedSegments : [];
  const messages = Array.isArray(value.Message) ? value.Message : [];
  const out = [];

  for (const seg of segments) {
    const stations = String(seg.Stations || "").split(",").map(s => s.trim()).filter(Boolean);
    const line = LINE_MAP[seg.Line] || codeLine(stations[0]);
    if (!line) continue;
    const freeBus = String(seg.FreePublicBus || "").trim();
    const shuttle = String(seg.FreeMRTShuttle || "").trim();
    out.push({
      id: "tsa-" + seg.Line + "-" + (stations[0] || "x"),
      kind: "fault",
      line,
      stationCodes: stations,
      direction: seg.Direction || "Both",
      severity: status === 2 ? "suspended" : "delay",
      active: true,
      headline: (status === 2 ? "No service on " : "Delays on ") + (seg.Line || line)
              + (stations.length ? ", " + stations[0] + " to " + stations[stations.length-1] : ""),
      detail: [
        seg.Direction && seg.Direction !== "Both" ? "Towards " + seg.Direction + "." : "",
        freeBus ? "Free bus boarding at: " + freeBus + "." : "",
        shuttle ? "Free MRT shuttle: " + shuttle + "." : ""
      ].filter(Boolean).join(" ") || "Affected stations: " + stations.join(", "),
      freePublicBus: freeBus || null,
      freeMRTShuttle: shuttle || null,
      source: "LTA DataMall TrainServiceAlerts",
      time: new Date().toTimeString().slice(0,5)
    });
  }

  /* Message is populated on ordinary days when AffectedSegments is not. */
  for (const m of messages.slice(0, 6)) {
    const content = String(m.Content || "").trim();
    if (!content) continue;
    out.push({
      id: "tsa-msg-" + String(m.CreatedDate || content.slice(0,12)),
      kind: "advisory", line: null, severity: "notice", active: true,
      headline: content.slice(0, 96),
      detail: content.slice(0, 400),
      source: "LTA DataMall TrainServiceAlerts (Message)",
      time: String(m.CreatedDate || "").slice(11,16)
    });
  }

  return Response.json(out, { headers: {
    "cache-control": "public, max-age=45, s-maxage=45",
    "x-feed-mode": "datamall", "x-feed-status": String(status) } });
};
