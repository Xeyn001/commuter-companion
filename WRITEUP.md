# Commuter Companion — write-up

NebulaX 2026, Problem Statement 2.

## The persona

**Mdm Lim** — the accessibility-constrained occasional traveller. Bedok
to Singapore General Hospital, fortnightly. Walks slowly, avoids stairs,
needs lifts and sheltered walkways, and will not improvise a reroute
standing on a platform.

We picked her because her constraints are the ones that break most
journey planners, and because building for her produces a better app for
everyone else. A route that is genuinely step-free is also the route you
want with a suitcase, a pram, or a knee that is playing up. The
organisers' own FAQ makes the wider point — this is a companion for
ordinary days, not a disruption tool — and for Mdm Lim the ordinary-day
problem is the same as the bad-day problem: *is the lift working, and
how far will I actually have to walk?*

That journey works end to end in the app: Bedok to SGH, door to door,
with a real walking leg at each end, routed around a lift outage when
one is reported.

## Architecture

```
index.html          the whole app, one self-contained file
  └── engine.js     inlined at build time by build.js
server.js           Cloud Run entrypoint; adapts Fetch-style handlers
netlify/functions/  four handlers, unmodified across both hosts
  health.js         per-source capability probe
  feed.js           TrainServiceAlerts
  datamall.js       allow-listed DataMall proxy, holds the key
  chat.js           LLM intent parser
```

`engine.js` has no DOM access and is unit-tested on its own
(`node test.mjs`). The page is tested against a real DOM with jsdom
(`node domtest.mjs`). 16 + 24 checks; `npm test` runs both.

**Routing** is Dijkstra over *(line, station)* nodes rather than
stations, so an interchange is a real edge with a real cost — Dhoby
Ghaut is a 7-minute change, City Hall is 2, and the router knows the
difference. Constraints become edge weights rather than filters: "I hate
walking" raises the transfer multiplier, "step-free" adds lift detour
time and deletes any interchange with a lift reported out.

**Two options, not one.** The same graph search runs twice with
different weights — one with a heavy per-change cost, one without — and
returns both when they differ. On an ordinary day on a network as
well-connected as Singapore's they usually agree, and we show one card
labelled *Recommended* rather than manufacturing a second option. Under
the East West signalling fault they diverge properly: 47 min with 3
transfers against 49 min with none.

**The LLM never picks the route.** It turns a sentence into a constraint
object; the graph search stays deterministic and auditable. Without an
API key a rule-based parser produces the same object, which is why the
assistant still works on a static deploy.

**Notification policy** — four rules run before anything reaches the
commuter: is it on their route, is there still time to act, is any
alternative actually better, and have we already said this. Held alerts
are logged with the rule that held them.

## Data

| Source | Used for |
|---|---|
| DataMall `TrainServiceAlerts` | live disruptions, and the mitigation — `FreePublicBus` / `FreeMRTShuttle` tell us where free boarding is active, so we don't guess |
| DataMall `PCDRealTime` / `PCDForecast` | station crowding, real-time and forecast |
| DataMall `v2/FacilitiesMaintenance` | lift outages, per lift and exit |
| DataMall `RoadWorks`, `TrafficIncidents`, `v4/TrafficSpeedBands` | bus journey impact |
| DataMall `BusStops` / `BusRoutes` / `BusServices` | stop codes and service numbers |
| `AmendmenttoMP2014RailStation.geojson` | station geometry |
| data.gov.sg weather | rain on the walking legs |
| OpenStreetMap via Leaflet, CARTO tiles | the map |

**On the GeoJSON.** It declares `crs: null`. The coordinates are decimal
degrees in EPSG:4326 — we confirmed this by checking known stations
against their real positions before joining anything to it. We take
area-weighted centroids of the polygons, since they are station
footprints rather than points. 118 of our 144 places come from it
directly. The other 26 are stations that opened after the 2014 Master
Plan amendment and are simply absent from the file; those are entered
from published station locations and tagged in `engine.js`. They are
accurate to roughly a building's width — enough to draw a line on a map,
not survey grade.

**On OpenStreetMap.** Tiles come from CARTO's OSM-derived basemaps
rather than `tile.openstreetmap.org`, whose usage policy prohibits
application traffic. `© OpenStreetMap contributors` renders on every
tile layer. If Leaflet fails to load, an inline SVG schematic is drawn
from the same coordinates, so the journey still has a visual with no
network at all — which is also what a commuter has underground.

**We removed a scrape.** An earlier version of `feed.js` read the public
SGMRT Telegram preview page. Section 2.5 is explicit that scraping is
not acceptable here when an official API exists, and one does. It now
reads `TrainServiceAlerts`. The Telegram channel was used offline, as an
archive of how notices are worded; nothing in the running app fetches it.

## Assumptions

Every one of these is a modelling choice, not a measurement, and each is
labelled in the interface where it surfaces.

- **Walking speed** 78 m/min, and 52 m/min when step-free is on, with a
  1.35 straight-line detour factor for a dense street grid. Door-to-door
  times are only as good as these two numbers.
- **Crowding**, where the live feed is unavailable, is derived from a
  ridership curve, direction relative to the CBD, and per-line loading.
  Shown as "estimated" everywhere it appears.
- **Road congestion** is a curve fitted to typical weekday speeds until
  `v4/TrafficSpeedBands` is available.
- **Road-works impact on buses** joins DataMall road names to corridors
  by name matching, and is peak-weighted — a blocked lane costs far more
  at 08:00 than at 23:00. Name matching is only as good as the names LTA
  publishes.
- **Fares** are a distance approximation, shown with "about".
- **Underground**, the app keeps the current journey and marks live
  figures as stale rather than showing a spinner or a wrong number.

## Numbers we claim, and where they come from

- *"47 min with 3 transfers against 49 min with none"* — both produced by
  `planBoth()` for Tampines → City Hall at 08:15 with feed item `f1`
  active. Reproduce: `node -e` against `engine.js`, or toggle the fault
  in the Live tab.
- *"118 of 144 coordinates from the provided GeoJSON"* — counted by the
  extraction script; the remaining 26 are tagged in `engine.js`.
- No accuracy or speed-up figure is claimed anywhere, because we have
  not measured one.

## Known limits

- **Bus service numbers.** The bus layer models twelve road corridors
  with realistic timings, not individual services. Until
  `data/bus-index.json` is built from DataMall `BusRoutes`, the app says
  it does not know the service number rather than inventing one. This is
  the largest gap in the build and the assistant is explicit about it
  when asked.
- **LRT lines are not modelled.**
- **Bus coverage is corridor-level**, so some origin–destination pairs
  have no bus-only route. The app says so rather than fabricating one.
- **Crowding is modelled, not live**, unless `LTA_ACCOUNT_KEY` is set;
  the proxy exposes `PCDRealTime` and `PCDForecast` but the interface
  does not yet consume them.
- **Demand–supply matching** — the organisers' FAQ raises incentivising
  off-peak travel. We surface crowding and offer a quieter route, but we
  do not model incentives. Not attempted, not claimed.

## Privacy

Saved preferences, origin, destination and notification settings live in
`localStorage` on the user's own device. Nothing is transmitted to us and
there is no account. The only outbound requests are to LTA DataMall,
data.gov.sg, the tile provider, and — if a key is configured — the
Anthropic API, which receives the message text and nothing else. No
location is collected. A commuter companion is a privacy-sensitive
product by nature and we have kept the data footprint at zero.

## Running it

Deployed URL and setup: see `README.md`. Cloud deployment: `DEPLOY.md`.
No credentials are in this repository; `.env.example` lists the variable
names.

## Bus timing: one assumption worth stating

Inter-stop time is distance divided by a speed that **rises with hop length**:
about 19 km/h for a short kerbside hop, flattening towards 50 km/h on a long
expressway leg.

A flat 18 km/h was tried first and was clearly wrong — service 646, which runs
down the expressway, came out at 108 minutes for three stops. The curve is
`15 + 40·km/(km+4)`, chosen so a 400 m hop costs ~1.3 min and a 30 km express
run ~36 min. It is a model, not a measurement; `EstTravelTimes` and
`v4/TrafficSpeedBands` would replace it with observed speeds.

Waiting time is likewise modelled by time of day (4 min at peak, 12 min late
evening) and labelled "estimated" in the interface. `BusServices` publishes
`AM_Peak_Freq` as a band like "8-12"; adding those four fields to
`fetch-bus-data.mjs` would replace the model with the published headway.

## Event crowd prediction: what is and is not claimed

The honest position on events is that nobody publishes this data, so the model
is judgement and is labelled as judgement.

**What is evidence:** the locations. Deepavali happens in Little India, the
countdown happens at Marina Bay, the National Stadium holds 55,000 and empties
through one Circle Line station. Each calendar entry carries a `basis` field
recording why it is there.

**What is judgement:** the effect sizes. `lift: 1.9` for National Day is a
considered guess, not a measurement. It is applied as a shift towards a full
train rather than a multiplier, so it cannot predict a platform more than full.

**What would replace it with evidence:** `PV/ODTrain` gives monthly
origin-destination passenger volumes. Comparing Little India's volume in the
Deepavali month against its twelve-month median would turn every `lift` in the
file into a measured figure. That is the right next step and it needs no new
data source — only the key you already have.

**Why a measurement always wins.** `PCDForecast` is published for the day ahead
in 30-minute intervals. Where it exists it is simply better than any prior, and
the code path makes that unconditional: `crowdDetail` returns the measured level
and never consults the calendar. The event model only fills the gap — a journey
planned for next Friday, or a station returning `NA`.

## Bus timing, revised

Waiting time now comes from the **published frequency band** in `BusServices`
(`AM_Peak_Freq` and friends, e.g. `"8-12"`), halved, because the expected wait
for a passenger arriving at random is about half the headway. Services with no
published band fall back to the model, and each leg in the interface says which
of the two it used.

The app also refuses to board a service outside its operating hours, from
`WD_FirstBus` / `WD_LastBus` and the Saturday and Sunday equivalents, including
the wrap when a last bus runs past midnight. Routing someone onto a bus that
stopped at 23:20 is the fastest way to lose a user's trust. Services with no
published hours are assumed to run — we do not invent a restriction either.
