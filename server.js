/* Cloud Run entrypoint.

   NebulaX requires the submission to be running on Google Cloud. The
   four serverless functions were written against the Web Fetch API
   (export default async (request) => Response), which is what Netlify
   Functions expects. Rather than fork them, this is a thin adapter:
   a plain Node http server that turns an IncomingMessage into a Fetch
   Request, calls the same handler, and writes the Response back.

   So the identical function files run unmodified on Cloud Run and on
   Netlify. Nothing in netlify/functions/ is GCP-specific, and nothing
   here duplicates their logic.

   Routes:
     GET  /                          index.html
     GET  /.netlify/functions/<name> the functions, at their existing paths
     GET  /api/<name>                the same functions, at a sane path
     GET  /healthz                   container liveness

   The old /.netlify/ paths are kept because the front end already
   calls them and a judge should not have to care where it is hosted. */

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const PORT = Number(process.env.PORT) || 8080;   // Cloud Run injects PORT

const FUNCTIONS = {};
for (const name of ["health", "feed", "datamall", "chat"]) {
  try {
    FUNCTIONS[name] = (await import(`./netlify/functions/${name}.js`)).default;
  } catch (e) {
    console.error(`could not load function ${name}:`, e.message);
  }
}

const MIME = {
  ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8",
  ".css":"text/css; charset=utf-8",   ".json":"application/json; charset=utf-8",
  ".geojson":"application/json; charset=utf-8",
  ".svg":"image/svg+xml", ".png":"image/png", ".ico":"image/x-icon",
  ".webmanifest":"application/manifest+json"
};

/* node IncomingMessage -> Fetch Request */
async function toRequest(req) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const init = { method: req.method, headers: req.headers };
  if (req.method !== "GET" && req.method !== "HEAD") {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    init.body = Buffer.concat(chunks);
  }
  return new Request(url, init);
}

async function serveStatic(pathname, res) {
  /* normalize() then reject any traversal that survived it. */
  const rel = normalize(pathname === "/" ? "/index.html" : pathname).replace(/^(\.\.[/\\])+/, "");
  const file = join(ROOT, rel);
  if (!file.startsWith(ROOT)) { res.writeHead(403).end("forbidden"); return; }
  try {
    const s = await stat(file);
    if (!s.isFile()) throw new Error("not a file");
    const body = await readFile(file);
    const ext = extname(file).toLowerCase();
    res.writeHead(200, {
      "content-type": MIME[ext] || "application/octet-stream",
      /* index.html must never be cached: it is the whole app. */
      "cache-control": ext === ".html" ? "public, max-age=0, must-revalidate"
                                       : "public, max-age=3600",
      "x-content-type-options": "nosniff",
      "referrer-policy": "strict-origin-when-cross-origin"
    });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" }).end("not found");
  }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    let p = url.pathname;

    if (p === "/healthz") { res.writeHead(200).end("ok"); return; }

    const m = p.match(/^\/(?:\.netlify\/functions|api)\/([a-z]+)$/);
    if (m) {
      const fn = FUNCTIONS[m[1]];
      if (!fn) { res.writeHead(404, {"content-type":"application/json"})
                    .end(JSON.stringify({ error: "no such function" })); return; }
      const out = await fn(await toRequest(req));
      const headers = {};
      out.headers.forEach((v, k) => { headers[k] = v; });
      res.writeHead(out.status, headers);
      res.end(Buffer.from(await out.arrayBuffer()));
      return;
    }

    await serveStatic(p, res);
  } catch (err) {
    console.error("request failed:", err);
    if (!res.headersSent) res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "internal error" }));
  }
});

server.listen(PORT, () => console.log(`commuter-companion listening on ${PORT}`));

/* Cloud Run sends SIGTERM before it stops an instance. */
process.on("SIGTERM", () => server.close(() => process.exit(0)));
