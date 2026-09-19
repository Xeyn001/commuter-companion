/* The assistant.

   Two jobs, chosen per message:

     PLAN    the commuter wants a journey, or is changing one.
             Returns constraints. The graph search still does the
             routing — the model never picks a route.

     ANSWER  they asked something about the journey on screen, or about
             getting around Singapore. Returns prose, grounded in the
             plan and live state the browser hands over.

   Keeping route choice out of the model is deliberate and worth
   defending: routing stays deterministic, reproducible and
   explainable, while the model does the part it is actually good at —
   reading a messy sentence, and explaining an answer in one.

   Backends, in order:
     1. Vertex AI (Gemini) when GOOGLE_CLOUD_PROJECT is set. On Cloud
        Run the service account gets a token from the metadata server,
        so there is no API key to store, leak or rotate, and it runs on
        the hackathon's own GCP credits.
     2. Anthropic when ANTHROPIC_API_KEY is set.
     3. Neither: the browser's rule-based parser handles it, which is
        why the journey planner works with nothing configured at all. */

const ROUTER = `You are the assistant inside a Singapore public transport app.

Decide what the user wants and reply with ONE JSON object, nothing else.
No prose outside the JSON, no markdown fences.

Asking for a journey, or changing one:

{ "mode":"plan",
  "from": string|null,     // station, bus stop name, 5-digit stop code, or MRT code like NE17
  "to": string|null,
  "depart": number|null,   // minutes past local midnight
  "arrive": number|null,
  "modes": {"rail":boolean,"bus":boolean},
  "prefs": string[],       // fastest | fewest | quiet | lesswalk | stepfree | dry
  "maxTransferWalk": number|null,
  "avoidLines": string[],  // NS EW NE CC DT TE
  "constraints": string[],
  "reply": string          // ONE sentence. Never state a journey time; you do not know it.
}

Asking a question — about the route on screen, a line, a station, a bus,
or anything else about getting around:

{ "mode":"answer",
  "reply": string,         // your answer, 1-4 sentences, plain text
  "needs": string[]        // arrivals | crowd | alerts | fares | accessibility
}

Rules:
- Both modes default true. "bus only" sets rail false; "no bus" sets bus false.
- Wheelchair, stroller, crutches, heavy luggage -> "stepfree".
- Wanting a seat, avoiding crowds or peak -> "quiet".
- Rain, umbrellas, staying dry -> "dry".
- Disliking walking -> "lesswalk"; a stated limit also sets maxTransferWalk.
- No origin given -> null. Never guess one.
- Bus stop names are written as they appear on the pole and are often
  abbreviated: "Amber Gdns", "Marine Pde Stn", "Bt Batok Int". Pass
  through whatever the user typed; the app resolves it.
- Never invent a Singapore station, stop or bus service number. If you
  do not know which bus runs a stretch, say so. A wrong service number
  sends someone to the wrong stop.
- You are given the current plan and live state. Ground answers in it.
  If it lacks what you need, say what you do not know.
- Be brief and concrete. No filler, no "great question", no restating
  the question. Write like someone who knows the network.`;

async function callVertex(system, user) {
  const project  = process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.VERTEX_LOCATION || "asia-southeast1";
  const model    = process.env.VERTEX_MODEL || "gemini-2.0-flash";

  const tokRes = await fetch(
    "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
    { headers: { "Metadata-Flavor": "Google" } });
  if (!tokRes.ok) throw new Error("metadata token " + tokRes.status);
  const { access_token } = await tokRes.json();

  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}` +
              `/locations/${location}/publishers/google/models/${model}:generateContent`;
  const r = await fetch(url, {
    method: "POST",
    headers: { authorization: "Bearer " + access_token, "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 700,
                          responseMimeType: "application/json" }
    })
  });
  if (!r.ok) throw new Error("vertex " + r.status + " " + (await r.text()).slice(0, 200));
  const data = await r.json();
  const parts = (data.candidates && data.candidates[0] &&
                 data.candidates[0].content && data.candidates[0].content.parts) || [];
  return parts.map(p => p.text || "").join("");
}

async function callAnthropic(system, user) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json",
               "x-api-key": process.env.ANTHROPIC_API_KEY,
               "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 700, system,
                           messages: [{ role: "user", content: user }] })
  });
  if (!r.ok) throw new Error("anthropic " + r.status + " " + (await r.text()).slice(0, 200));
  const data = await r.json();
  return (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
}

/* Everything the model may reason from. All of it comes from the app's
   own state, so an answer built on it can be checked against what the
   screen shows. */
function ground(ctx) {
  if (!ctx) return "No journey planned yet.";
  const p = ctx.plan;
  if (!p) return `Origin ${ctx.from || "unset"}, destination ${ctx.to || "unset"}. No plan computed yet.`;
  const legs = (p.legs || []).map(l => {
    if (l.kind === "walk")     return `walk ${Math.round(l.mins)} min (${l.from} to ${l.to})`;
    if (l.kind === "transfer") return `change at ${l.at}, ${Math.round(l.mins)} min`;
    if (l.mode === "bus")
      return `bus ${l.service || "(service unknown)"} from ${l.from} to ${l.to}, ${Math.round(l.mins)} min`;
    return `${l.lineName || l.line} from ${l.from} to ${l.to}, ${Math.round(l.mins)} min`;
  });
  return [
    `Journey: ${p.from} to ${p.to}. ${Math.round(p.total)} min door to door, ${p.changes ?? p.transfers} change(s).`,
    `Legs: ${legs.join("; ")}.`,
    ctx.alerts && ctx.alerts.length
      ? `Live alerts: ${ctx.alerts.map(a => a.headline).join(" | ")}.`
      : "No active service alerts.",
    ctx.busDataLoaded === false
      ? "Real bus service numbers are NOT loaded; do not guess one."
      : "Real bus service numbers are available.",
    ctx.crowdLive ? "Crowding is live from LTA." : "Crowding figures are modelled estimates."
  ].filter(Boolean).join("\n");
}

export default async (request) => {
  const hasVertex = Boolean(process.env.GOOGLE_CLOUD_PROJECT);
  const hasClaude = Boolean(process.env.ANTHROPIC_API_KEY);
  if (!hasVertex && !hasClaude)
    return Response.json({ error: "no model configured" }, { status: 503 });

  let body;
  try { body = await request.json(); }
  catch { return Response.json({ error: "bad request" }, { status: 400 }); }

  const message = String(body.message || "").slice(0, 900);
  if (!message) return Response.json({ error: "empty message" }, { status: 400 });

  const now = Number.isFinite(body.now) ? body.now : 0;
  const hh = String(Math.floor(now / 60)).padStart(2, "0");
  const mm = String(now % 60).padStart(2, "0");

  const user = [
    `Local time ${hh}:${mm} (${now} minutes past midnight).`,
    ground(body.context),
    Array.isArray(body.history) && body.history.length
      ? "Recent turns:\n" + body.history.slice(-6)
          .map(h => `${h.who === "me" ? "User" : "You"}: ${h.text}`).join("\n")
      : "",
    `User: ${message}`
  ].filter(Boolean).join("\n\n");

  let text;
  try {
    text = hasVertex ? await callVertex(ROUTER, user) : await callAnthropic(ROUTER, user);
  } catch (err) {
    if (hasVertex && hasClaude) {
      try { text = await callAnthropic(ROUTER, user); }
      catch (e2) { return Response.json({ error: "upstream", detail: String(e2.message) }, { status: 502 }); }
    } else {
      return Response.json({ error: "upstream", detail: String(err.message) }, { status: 502 });
    }
  }

  let out;
  try { out = JSON.parse(String(text).replace(/^```(?:json)?|```$/g, "").trim()); }
  catch { return Response.json({ error: "unparseable" }, { status: 502 }); }

  if (out.mode === "answer")
    return Response.json({ mode: "answer", reply: out.reply || "", needs: out.needs || [] },
      { headers: { "cache-control": "no-store" } });

  return Response.json({ mode: "plan", intent: out, reply: out.reply || "" },
    { headers: { "cache-control": "no-store" } });
};
