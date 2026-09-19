/* Inlines engine.js into index.src.html to produce a single
   self-contained index.html. Keeping the engine separate means it
   stays unit-testable with `npm test`. */
import { readFileSync, writeFileSync } from "node:fs";

const engine = readFileSync("engine.js", "utf8")
  .replace(/\/\* Exported for the test harness[\s\S]*$/, "");   // strip the ESM export
const page = readFileSync("index.src.html", "utf8")
  .replace("/*__ENGINE__*/", () => engine);
writeFileSync("index.html", page);
console.log("built index.html — " + (page.length / 1024).toFixed(0) + " kB");
