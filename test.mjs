/* Routing and parser checks.  node test.mjs  */
import {route,parseIntent,PROFILES,FEED,PLACES,GRAPH,estimateFare,codeOf} from "./engine.js";

let pass=0, fail=0;
const ok=(name,cond,extra="")=>{ cond?pass++:fail++;
  console.log((cond?"  ok  ":"  FAIL")+"  "+name+(cond?"":"  "+extra)); };

console.log(`network: ${PLACES.length} places, ${GRAPH.size} platform nodes\n`);

const r1=route("Punggol","Raffles Place",8*60,PROFILES.balanced,{});
ok("plans a normal rail journey", r1 && r1.total>20 && r1.total<50, r1&&r1.total);
ok("station codes resolve", codeOf("Dhoby Ghaut")==="NS24 NE6 CC1", codeOf("Dhoby Ghaut"));

const r2=route("Punggol","Raffles Place",8*60,PROFILES.fastest,{modes:{rail:false,bus:true}});
ok("bus-only route uses no rail", r2 && r2.legs.every(l=>l.kind!=="ride"||l.mode==="bus"));
ok("bus-only is slower than rail", r2 && r1 && r2.total>r1.total);

const r3=route("Bukit Merah","Ang Mo Kio",14*60,PROFILES.balanced,{});
ok("reaches a place rail doesn't serve", !!r3);

const ns=FEED.find(d=>d.id==="f3"); ns.active=true;
const r4=route("Yishun","City Hall",8*60,PROFILES.balanced,{modes:{rail:true,bus:false}});
ok("routes around a suspended stretch",
   r4 && !r4.legs.some(l=>l.kind==="ride"&&l.line==="NS"&&l.stops.includes("Braddell")));
ns.active=false;

const lift=FEED.find(d=>d.id==="f5");
const railOnly={modes:{rail:true,bus:false}};
lift.active=true;
const a=route("Punggol","Bras Basah",9*60,PROFILES.stepfree,railOnly);
lift.active=false;
const b=route("Punggol","Bras Basah",9*60,PROFILES.stepfree,railOnly);
ok("lift outage moves the step-free interchange",
   a&&b&&a.legs.find(l=>l.kind==="transfer").at!==b.legs.find(l=>l.kind==="transfer").at,
   a&&b&&`${a.legs.find(l=>l.kind==="transfer").at} vs ${b.legs.find(l=>l.kind==="transfer").at}`);
lift.active=true;

const w=route("Yishun","City Hall",8*60,PROFILES.lesswalk,{maxTransferWalk:4});
ok("least-walking keeps interchange walking down", w && w.walkMins<=8, w&&w.walkMins);

ok("fare estimate is plausible", r1 && estimateFare(r1)>0.9 && estimateFare(r1)<3.0);

const cases=[
  ["I'm at Punggol and need to get to Raffles Place by 9am",
    i=>i.from==="Punggol"&&i.to==="Raffles Place"&&i.arrive===540],
  ["bus only from Bedok to City Hall, I hate walking",
    i=>i.modes.rail===false&&i.modesExplicit&&i.prefs.has("lesswalk")],
  ["wheelchair from NE17 to CC2",
    i=>i.from==="Punggol"&&i.to==="Bras Basah"&&i.prefs.has("stepfree")],
  ["tampines to orchard, avoid crowds, it's raining",
    i=>i.prefs.has("quiet")&&i.prefs.has("dry")],
  ["no more than 3 minutes walking, woodlands to newton",
    i=>i.maxTransferWalk===3],
  ["avoid the east west line, pasir ris to bugis",
    i=>i.avoidLines.includes("EW")],
  ["i want a seat, amk to cbd at 6pm",
    i=>i.from==="Ang Mo Kio"&&i.depart===1080&&i.prefs.has("quiet")]
];
for(const [q,check] of cases){
  let got; try{ got=parseIntent(q,9*60); }catch(e){ got=null; }
  ok(`parses: "${q.slice(0,42)}${q.length>42?"…":""}"`, !!got&&check(got),
     got?JSON.stringify({from:got.from,to:got.to,prefs:[...got.prefs]}):"threw");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
