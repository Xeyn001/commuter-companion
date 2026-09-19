/* Natural-language journey intent.

   The browser's rule-based parser handles the common phrasings on its
   own. This function upgrades it: the model reads messier, more human
   requests and returns the same constraint object, so the router
   downstream doesn't change at all.

   The model never picks the route. It only turns a sentence into
   constraints; the graph search stays deterministic and auditable. */

const SYSTEM = `You turn a Singapore commuter's message into routing constraints.

Reply with ONE JSON object and nothing else. No prose, no markdown fences.

{
  "from": string | null,          // origin, as a station or place name, or an MRT code like NE17
  "to": string | null,            // destination, same
  "depart": number | null,        // minutes past local midnight, if they said when they'll leave
  "arrive": number | null,        // minutes past local midnight, if they said when they must arrive
  "modes": { "rail": boolean, "bus": boolean },
  "prefs": string[],              // any of: fastest, fewest, quiet, lesswalk, stepfree, dry
  "maxTransferWalk": number|null, // minutes, if they capped walking
  "avoidLines": string[],         // any of: NS, EW, NE, CC, DT, TE
  "constraints": string[],        // short human-readable labels for what you applied
  "reply": string                 // one friendly sentence. Do not state journey times; you do not know them.
}

Rules:
- Both modes default to true. "bus only" means rail false. "no bus" means bus false.
- Mobility needs — wheelchair, stroller, crutches, heavy luggage — map to "stepfree".
- Wanting a seat, or avoiding crowds or peak hour, maps to "quiet".
- Rain, umbrellas or staying dry maps to "dry".
- Disliking walking maps to "lesswalk". A stated limit also sets maxTransferWalk.
- If they give no origin, return null rather than guessing.
- Never invent a station that does not exist in Singapore.`;

export default async (request) => {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return Response.json({ error: "no key" }, { status: 503 });

  let body;
  try { body = await request.json(); }
  catch { return Response.json({ error: "bad request" }, { status: 400 }); }

  const message = String(body.message || "").slice(0, 600);
  if (!message) return Response.json({ error: "empty message" }, { status: 400 });

  const now = Number.isFinite(body.now) ? body.now : 0;
  const ctx = body.context || {};

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 600,
        system: SYSTEM,
        messages: [{
          role: "user",
          content:
            `Local time is ${String(Math.floor(now / 60)).padStart(2, "0")}:` +
            `${String(now % 60).padStart(2, "0")} (${now} minutes past midnight).\n` +
            (ctx.from ? `Their last journey was ${ctx.from} to ${ctx.to}.\n` : "") +
            `Message: ${message}`
        }]
      })
    });

    if (!r.ok) {
      const detail = await r.text();
      return Response.json({ error: "upstream", detail: detail.slice(0, 300) }, { status: 502 });
    }

    const data = await r.json();
    const text = (data.content || [])
      .filter(b => b.type === "text").map(b => b.text).join("").trim();

    let intent;
    try {
      intent = JSON.parse(text.replace(/^```(?:json)?|```$/g, "").trim());
    } catch {
      // Model drifted off format. Say so; the browser falls back to its own parser.
      return Response.json({ error: "unparseable" }, { status: 502 });
    }

    return Response.json({ intent, reply: intent.reply || "" },
      { headers: { "cache-control": "no-store" } });

  } catch (err) {
    return Response.json({ error: String(err.message) }, { status: 502 });
  }
};
