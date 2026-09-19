# Commuter Companion

**Live:** _paste your Cloud Run URL here after deploying — see DEPLOY.md_

A mobile-first journey companion for Singapore. Plans door-to-door across rail, bus
and walking, adapts around live disruptions, and decides when a commuter is better
off not being interrupted.

Built for NebulaX Problem Statement 2.

---

## Deploying to Netlify

> Deploying to Google Cloud (required for NebulaX judging) is covered in
> **[DEPLOY.md](DEPLOY.md)**. The Netlify instructions below still work and are
> kept as a fallback.

**Drag and drop** — the fastest route. Open [app.netlify.com/drop](https://app.netlify.com/drop)
and drop this whole folder in. It works immediately, with no keys and no build step,
because `index.html` is already built and self-contained.

**Netlify CLI** — if you want the functions and the build step:

```bash
npm install -g netlify-cli
netlify deploy --prod
```

**Git** — push this folder to a repo and connect it. `netlify.toml` already declares
the build command and the functions directory.

### Optional environment variables

Set these under *Site settings → Environment variables*. Neither is required.

| Variable | What it unlocks |
|---|---|
| `LTA_ACCOUNT_KEY` | Live bus arrivals, traffic incidents and speed bands, via the DataMall proxy |
| `ANTHROPIC_API_KEY` | The LLM journey assistant, replacing the built-in parser |

The app probes `/.netlify/functions/health` on load. If the functions answer, it
switches to live sources; if they don't, it stays on its embedded snapshot. The
Sources tab always shows which mode it's in, per source.

---

## What's here

```
index.html              the built app — self-contained, this is what ships
index.src.html          source: markup, styles, interface logic
engine.js               network model, routing, intent parsing (no DOM, testable)
build.js                inlines engine.js into index.src.html
test.mjs                routing and parser tests — node test.mjs
netlify.toml            build config and security headers
netlify/functions/
  health.js             capability probe
  feed.js               SGMRT Telegram scraper
  datamall.js           LTA DataMall proxy, holds the AccountKey server-side
  chat.js               LLM intent interpreter
```

Edit `engine.js` or `index.src.html`, then run `node build.js`. Don't edit
`index.html` directly; it's generated.

---

## How it works

**Routing** is Dijkstra over *(line, station)* nodes rather than stations, so an
interchange is a real edge with a real cost. Dhoby Ghaut is a 7-minute change and
City Hall is 2, and the router knows the difference. 144 places, 266 platform nodes,
eight rail segments and twelve bus corridors.

**Constraints** become edge weights, not filters. "I hate walking" raises the
transfer multiplier and caps interchange walks; "step-free" adds lift detour time and
removes any interchange with a lift out of service; "bus only" drops rail edges
entirely. The same graph search serves all of them.

**The assistant** parses a message into a constraint object, then hands it to that
router. The model — when one is configured — never chooses the route. It only turns
a sentence into constraints, so the routing stays deterministic and auditable.
Without a key, a rule-based parser produces the same object, which is why the chat
works in a static deploy.

**Notification policy** is the part the brief asks for that's easiest to miss. Four
rules run before anything reaches the commuter: is it on their route, is there still
time to act, is any alternative actually better, and have we already said this. Held
alerts are logged with the rule that held them, so nothing is lost — it just doesn't
buzz.

---

## What's real and what's modelled

Being straight about this matters more than the demo looking complete.

**Real:** the rail network — every station in running order with its official code,
including the gaps that exist in reality (NE2 was never built, CC18 is unopened,
TE10 is unopened). Interchange walking times. The Telegram scraper, which parses the
live public channel. The DataMall proxy and its endpoint allow-list.

**Modelled, and labelled as such in the interface:**

- *Crowding.* Station crowd density **is** published by LTA — `PCDRealTime` and
  `PCDForecast` — and both are exposed through the proxy. The interface does not
  consume them yet, so what you see is derived from a ridership curve, direction
  relative to the CBD, and line loading. Every place it appears says "estimated".
  Per-*train* load is not published by anyone; per-*bus* load is, via the `Load`
  field on `v3/BusArrival`.
- *Road traffic.* A congestion curve fitted to typical weekday speeds, until
  `LTA_ACCOUNT_KEY` is set and `TrafficSpeedBandsv2` takes over.
- *Bus corridors.* Twelve road spines with realistic timings. Service numbers and
  stop sequences are **not** invented — those come from DataMall `BusRoutes` and
  `BusStops`. The interface says "check the app for the service number" rather than
  guessing.
- *Station positions.* Schematic. `AmendmenttoMP2014RailStation.geojson` supplies
  true coordinates when a map is added.
- *Fares.* A distance approximation, shown with "about".

---

## Things worth demonstrating

1. **Live tab → switch on the North South Line suspension**, then plan Yishun to
   City Hall. It reroutes via Woodlands and the Thomson line, and the banner names
   the fault and its source.
2. **Live tab → lift out of service at Dhoby Ghaut**, with step-free switched on.
   Step-free journeys move to Serangoon; everyone else still routes through Dhoby
   Ghaut. Switch it off and they come back.
3. **Ask tab → "bus only from Bedok to City Hall, I hate walking"**. Both constraints
   apply, and the bus legs carry a live traffic reading.
4. **Nudges tab → turn on do-not-disturb**, then switch on a delay. It's held, and
   the log says why. Switch on the suspension instead and it gets through.

---

## Known limits

- Bus coverage is corridor-level, so some origin-destination pairs have no bus-only
  route. The app says so rather than inventing one.
- `feed.js` parses free-form Telegram prose. It fails soft: on a parse miss the app
  keeps its existing state rather than showing something wrong.
- LRT lines aren't modelled.
