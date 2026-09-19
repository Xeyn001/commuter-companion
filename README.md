# Commuter Companion

**Live:** _paste your Cloud Run URL here after deploying — see DEPLOY.md_

A mobile-first journey companion for Singapore. Plans door-to-door across rail, bus
and walking, adapts around live disruptions, and decides when a commuter is better
off not being interrupted.

Built for NebulaX Problem Statement 2.

---


## Run it

Nothing to install. Node 18 or newer is the only requirement.

```bash
node build.js      # assembles index.html from the sources
node server.js     # serves it on http://localhost:8080
```

Or `npm start`, which does both.

Open **http://localhost:8080** — on your phone rather than a desktop window if
you can, because that is where it is designed to be used.

It works immediately at this point, with no API keys: rail routing, the full
bus network, events, weather and the disruption path all run on data that ships
with the repository. Keys only add live feeds, and the Sources tab always shows
which mode each source is in.

**Try this first:** ask *"Tampines to Raffles Place by 8:45"*, then open **Live**
and switch on the East West Line fault. Come back to **Journey** to see the
alternative shown against the original.

### Tests

```bash
npm test           # 50 assertions: routing, bus network, events, parsers
```

`npm install` is only needed if you want the browser-level DOM test; the suite
above needs nothing.

### If the port is taken

```bash
PORT=3000 node server.js
```

### Docker

```bash
docker build -t commuter-companion .
docker run -p 8080:8080 commuter-companion
```


## Running it on Google Cloud

The repository already has a Cloud Run setup: `Dockerfile`, `server.js` as the
entrypoint, and `deploy.sh`. From Cloud Shell, in the project directory:

```bash
bash deploy.sh
```

That enables the APIs, builds from source, deploys to `asia-southeast1`
(Singapore), then checks the deployed URL actually responds before telling you
it worked. It prints the public URL at the end — that is the one you submit.

With a DataMall key:

```bash
LTA_ACCOUNT_KEY='your-key' bash deploy.sh
```

The key goes into **Secret Manager**, not into the service config. `gcloud run
deploy --set-env-vars` stores keys in plaintext where anyone with
`roles/run.viewer` can read them back with `gcloud run services describe`, and
they appear in deployment logs. `deploy.sh` creates the secret, grants the
runtime service account read access, and mounts it with `--set-secrets`.
`USE_ENV_VARS=1` opts out if you need to.

Settings worth knowing:

| Setting | Value | Why |
|---|---|---|
| Region | `asia-southeast1` | Singapore. Change with `REGION=...` |
| Memory | 512 Mi | Measured at ~63 MB resident with the bus index loaded |
| Min instances | 0 | Scales to zero, so an idle demo costs nothing |
| Max instances | 3 | A cap, so a runaway loop cannot bill you |

### Cold starts

`--min-instances 0` means the first request after an idle period waits a few
seconds for the container. Before a live demo, either hit the URL once to warm
it, or set `--min-instances 1` for the day.

### If `--allow-unauthenticated` is refused

Student and organisation projects often carry a policy blocking public access,
and the deploy fails with a 403 or an IAM error. See `DEPLOY.md`. The usual fix
is an exception on `constraints/iam.allowedPolicyMemberDomains` for the project.

### What ships in the image

`.gcloudignore` and `.dockerignore` exclude the three raw DataMall pulls —
`bus-index.json` is derived from them and is the only one read at runtime, so
shipping all four would add 7 MB for nothing. The image build fails outright if
`index.html`, `bus-index.json` or `events.json` is missing, rather than
deploying an app that silently falls back to modelled corridors.

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


## The bus network

`data/bus-index.json` is generated by `fetch-bus-data.mjs` from LTA DataMall
(`BusStops`, `BusRoutes`, `BusServices`) and is what makes the app name the
service a commuter actually boards — "Bus 31", not "a bus along the East Coast
corridor".

```bash
LTA_ACCOUNT_KEY='your-key' node fetch-bus-data.mjs   # once; ~2 minutes
```

Without it the app still runs, on twelve modelled road corridors, and says so
in the Sources tab. With it, 5,208 stops and 602 services load in about 150 ms
and the twelve corridors are switched off entirely — so a leg can never show a
route the app cannot name a service for.

The file is ~1.1 MB, ~230 kB gzipped, and loads after first paint. `server.js`
gzips it. It is held in memory rather than queried, which is what keeps the app
working underground where there is no signal.

**Stop-level lookup is also available server side**, for a thin client or to
check a claim in the interface against the source data:

```
GET /api/bus?stop=83139           which services call at a stop
GET /api/bus?from=75009&to=75059  which services join two stops, in that order
GET /api/bus?q=tampines           search stops by name or road
```

Direction is respected: a service passing both stops the other way round is not
an answer.


## Events and festivals

Crowd predictions account for the days that break the pattern — National Day,
the countdown at Marina Bay, Deepavali in Little India, a concert emptying the
National Stadium.

`data/events.json` is a **curated calendar, not a feed.** There is no official
event-crowding API, and inventing one would be presenting mocked data as live.
Two kinds of entry:

- **fixed** — same date every year. Shipped filled in.
- **moving** — follows a lunar or Islamic calendar and changes annually.
  `dates` is `null` and **the app will not apply the event until you fill it
  in.** The Sources tab names which are waiting.

Fill moving dates from the public holiday list at
[mom.gov.sg](https://www.mom.gov.sg/employment-practices/public-holidays) or the
public holidays dataset on [data.gov.sg](https://data.gov.sg/datasets), as ISO
dates:

```json
{ "id": "deepavali", "dates": ["2026-11-08"] }
```

The *locations* are the stable part and are shipped: Deepavali fills Little
India whichever date it falls on. Each entry records what its effect size is
based on.

**Precedence is strict.** An event prediction is a prior and nothing more:

1. `PCDRealTime` — measured, now
2. `PCDForecast` — measured pattern, per 30 minutes
3. the event model

If LTA says a platform is `l` during Deepavali, it is `l`. Every crowd figure in
the interface says which of the three it came from — *measured now*, *LTA
forecast*, or *predicted, event*.
