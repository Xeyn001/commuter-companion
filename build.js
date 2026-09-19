/* Inlines engine.js into index.src.html to produce a single
   self-contained index.html. Keeping the engine separate means it
   stays unit-testable with `npm test`. */
import { readFileSync, writeFileSync } from "node:fs";

const engine = readFileSync("engine.js", "utf8")
  .replace(/\/\* Exported for the test harness[\s\S]*$/, "");   // strip the ESM export
/* bus-index.js is concatenated into the same scope as the engine: the
   router calls isBusStop/busWait, and the bus layer calls link/nid/COORD.
   They are one module split across two files for readability. */
const busIndex = readFileSync("bus-index.js", "utf8")
  .replace(/\/\* Exported for the test harness[\s\S]*$/, "");
const events = readFileSync("events.js", "utf8");
const page = readFileSync("index.src.html", "utf8")
  .replace("/*__ENGINE__*/", () => engine + "\n" + busIndex + "\n" + events);
writeFileSync("index.html", page);
console.log("built index.html — " + (page.length / 1024).toFixed(0) + " kB");

/* Tests need the same single scope the browser gets. */
const bundle = readFileSync("engine.js", "utf8") + "\n" + busIndex + "\n" + events + `
export {BUS_IDX, loadBusIndex, isBusStop, busStop, busStopName, busStopLabel,
        busStopRoad, servicesAt, servicesBetween, stopsNear, serviceNo,
        busWait, busWaitMins, serviceRunning, bandFor, dayTypeOf,
        EVENTS, loadEvents, eventsAt, eventLift, eventsToday, eventsOnPlan,
        eventClosesRoads};
`;
writeFileSync(".engine-bundle.mjs", bundle);
console.log("built .engine-bundle.mjs for tests");
