import { JSDOM } from "jsdom";
import { readFileSync } from "fs";
const html = readFileSync("index.html", "utf8");
const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://example.test/",
  beforeParse(w){ w.matchMedia = q => ({matches:false, media:q, onchange:null,
    addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){}, dispatchEvent(){return false;}}); } });
const { window } = dom;

const errs = [];
dom.window.addEventListener("error", e => errs.push(e.message));
await new Promise(r => setTimeout(r, 900));
const d = window.document;
const q = s => d.querySelector(s);
const report = [];
const check = (n, c, x="") => report.push((c?"  ok   ":"  FAIL ")+n+(c?"":"  "+x));

check("no uncaught script errors", errs.length===0, errs.join(" | "));
check("theme toggle present", !!q("#themebtn"));
check("from is a text input (typeahead)", q("#from") && q("#from").tagName==="INPUT");
check("suggestion listbox exists", !!q("#from-sugg ul"));
check("map container exists", !!q("#map"));
check("OSM attribution string in page", html.includes("OpenStreetMap"));
check("leaflet stylesheet linked", html.includes("leaflet"));

// drive a plan
const st = window.CC.state;
st.from="Tampines"; st.to="City Hall"; st.depart=8*60+15;
window.CC.FEED.find(x=>x.id==="f1").active=true;
window.CC.FEED.find(x=>x.id==="f7").active=false;
window.CC.replan(); 
check("two options produced under disruption", st.options.length===2, "got "+st.options.length);
check("option cards rendered", d.querySelectorAll("[data-opt]").length===st.options.length);
check("map section revealed", q("#mapwrap") && q("#mapwrap").hidden===false);
check("map area has content even without Leaflet", q("#map").innerHTML.trim().length>50,
  q("#map").innerHTML.slice(0,60));
check("fallback schematic is an SVG", !!q("#map svg"));
check("trade-off explained", d.body.innerHTML.includes("trade-off"));
check("walk legs present in plan", st.plan.legs.some(l=>l.kind==="walk"));
check("door-to-door total includes walks",
  Math.abs(st.plan.total - st.plan.legs.reduce((a,l)=>a+l.mins,0)) < 0.01);

// landmark destination
st.to="Singapore General Hospital"; st.from="Bedok"; window.CC.replan();
check("routes to a non-station landmark", !!st.plan, "no plan");
check("egress walk is real", st.plan && st.plan.endWalk>0);

// theme switch
window.CC.applyTheme("light");
check("light theme applies", d.documentElement.getAttribute("data-theme")==="light");
window.CC.applyTheme("dark");
check("dark theme applies", d.documentElement.getAttribute("data-theme")==="dark");

// typeahead behaviour
const inp=q("#from"); inp.value="bkt pjg";
inp.dispatchEvent(new window.Event("input",{bubbles:true}));
await new Promise(r=>setTimeout(r,60));
check("typeahead suggests for fuzzy text", d.querySelectorAll("#from-sugg li").length>0,
  d.querySelector("#from-sugg").innerHTML.slice(0,80));


// --- chat follow-ups must answer, not re-dump the route ---
st.from="Marine Parade"; st.to="Changi Airport"; st.depart=8*60; window.CC.replan();
const chatLen=()=>d.querySelectorAll("#chat .msg").length;
const before=chatLen();
const ask=async q=>{ const b=q_("#say"); b.value=q; q_("#send").click(); await new Promise(r=>setTimeout(r,120)); };
function q_(x){return d.querySelector(x);}
await ask("what bus is this");
const lastMsg=()=>{const n=d.querySelectorAll("#chat .msg.cc"); return n.length?n[n.length-1].textContent:"";};
check("answers 'what bus is this' without re-dumping the itinerary",
  lastMsg().length>0 && !lastMsg().includes("door to door"), lastMsg().slice(0,70));
check("admits it lacks service numbers rather than inventing one",
  /service number|don.t know/i.test(lastMsg()), lastMsg().slice(0,70));
await ask("how long is the walk");
check("answers a walk question", /min/i.test(lastMsg()), lastMsg().slice(0,70));
check("no fabricated bus number anywhere in chat",
  !/bus\s+\d{2,3}\b/.test(d.querySelector("#chat").textContent));

console.log(report.join("\n"));
const fails = report.filter(r=>r.startsWith("  FAIL")).length;
console.log("\n"+(report.length-fails)+" passed, "+fails+" failed");
process.exit(fails?1:0);
