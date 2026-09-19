/* ══════════════════════════════════════════════════════════════
   COMMUTER COMPANION — engine
   Network model, bus corridors, traffic, routing, intent parsing.
   No DOM access in this file; it is unit-testable on its own.
   ══════════════════════════════════════════════════════════════ */

/* ---- 1. RAIL ------------------------------------------------
   [station name, official station code]. Codes include the real
   gaps: NE2 was never built, CC18 (Bukit Brown) is unopened,
   TE10 (Mount Pleasant) is unopened, NS6 is reserved.
   ------------------------------------------------------------- */
const LINES = {
  NS:{name:"North South Line",short:"North South",color:"#D42E12",hop:2.2,load:1.00,stations:[
    ["Jurong East","NS1"],["Bukit Batok","NS2"],["Bukit Gombak","NS3"],["Choa Chu Kang","NS4"],
    ["Yew Tee","NS5"],["Kranji","NS7"],["Marsiling","NS8"],["Woodlands","NS9"],["Admiralty","NS10"],
    ["Sembawang","NS11"],["Canberra","NS12"],["Yishun","NS13"],["Khatib","NS14"],["Yio Chu Kang","NS15"],
    ["Ang Mo Kio","NS16"],["Bishan","NS17"],["Braddell","NS18"],["Toa Payoh","NS19"],["Novena","NS20"],
    ["Newton","NS21"],["Orchard","NS22"],["Somerset","NS23"],["Dhoby Ghaut","NS24"],["City Hall","NS25"],
    ["Raffles Place","NS26"],["Marina Bay","NS27"],["Marina South Pier","NS28"]]},

  EW:{name:"East West Line",short:"East West",color:"#009645",hop:2.2,load:1.00,stations:[
    ["Pasir Ris","EW1"],["Tampines","EW2"],["Simei","EW3"],["Tanah Merah","EW4"],["Bedok","EW5"],
    ["Kembangan","EW6"],["Eunos","EW7"],["Paya Lebar","EW8"],["Aljunied","EW9"],["Kallang","EW10"],
    ["Lavender","EW11"],["Bugis","EW12"],["City Hall","EW13"],["Raffles Place","EW14"],
    ["Tanjong Pagar","EW15"],["Outram Park","EW16"],["Tiong Bahru","EW17"],["Redhill","EW18"],
    ["Queenstown","EW19"],["Commonwealth","EW20"],["Buona Vista","EW21"],["Dover","EW22"],
    ["Clementi","EW23"],["Jurong East","EW24"],["Chinese Garden","EW25"],["Lakeside","EW26"],
    ["Boon Lay","EW27"],["Pioneer","EW28"],["Joo Koon","EW29"],["Gul Circle","EW30"],
    ["Tuas Crescent","EW31"],["Tuas West Road","EW32"],["Tuas Link","EW33"]]},

  CG:{name:"Changi Airport Branch",short:"Airport branch",color:"#009645",hop:3.4,load:0.55,stations:[
    ["Tanah Merah","CG"],["Expo","CG1"],["Changi Airport","CG2"]]},

  NE:{name:"North East Line",short:"North East",color:"#9900AA",hop:2.1,load:0.95,stations:[
    ["HarbourFront","NE1"],["Outram Park","NE3"],["Chinatown","NE4"],["Clarke Quay","NE5"],
    ["Dhoby Ghaut","NE6"],["Little India","NE7"],["Farrer Park","NE8"],["Boon Keng","NE9"],
    ["Potong Pasir","NE10"],["Woodleigh","NE11"],["Serangoon","NE12"],["Kovan","NE13"],
    ["Hougang","NE14"],["Buangkok","NE15"],["Sengkang","NE16"],["Punggol","NE17"]]},

  CC:{name:"Circle Line",short:"Circle",color:"#FA9E0D",hop:2.0,load:0.80,stations:[
    ["Dhoby Ghaut","CC1"],["Bras Basah","CC2"],["Esplanade","CC3"],["Promenade","CC4"],
    ["Nicoll Highway","CC5"],["Stadium","CC6"],["Mountbatten","CC7"],["Dakota","CC8"],
    ["Paya Lebar","CC9"],["MacPherson","CC10"],["Tai Seng","CC11"],["Bartley","CC12"],
    ["Serangoon","CC13"],["Lorong Chuan","CC14"],["Bishan","CC15"],["Marymount","CC16"],
    ["Caldecott","CC17"],["Botanic Gardens","CC19"],["Farrer Road","CC20"],["Holland Village","CC21"],
    ["Buona Vista","CC22"],["one-north","CC23"],["Kent Ridge","CC24"],["Haw Par Villa","CC25"],
    ["Pasir Panjang","CC26"],["Labrador Park","CC27"],["Telok Blangah","CC28"],["HarbourFront","CC29"]]},

  CE:{name:"Circle Line (Marina Bay)",short:"Circle",color:"#FA9E0D",hop:2.2,load:0.60,stations:[
    ["Promenade","CC4"],["Bayfront","CE1"],["Marina Bay","CE2"]]},

  DT:{name:"Downtown Line",short:"Downtown",color:"#005EC4",hop:2.0,load:0.85,stations:[
    ["Bukit Panjang","DT1"],["Cashew","DT2"],["Hillview","DT3"],["Hume","DT4"],["Beauty World","DT5"],
    ["King Albert Park","DT6"],["Sixth Avenue","DT7"],["Tan Kah Kee","DT8"],["Botanic Gardens","DT9"],
    ["Stevens","DT10"],["Newton","DT11"],["Little India","DT12"],["Rochor","DT13"],["Bugis","DT14"],
    ["Promenade","DT15"],["Bayfront","DT16"],["Downtown","DT17"],["Telok Ayer","DT18"],
    ["Chinatown","DT19"],["Fort Canning","DT20"],["Bencoolen","DT21"],["Jalan Besar","DT22"],
    ["Bendemeer","DT23"],["Geylang Bahru","DT24"],["Mattar","DT25"],["MacPherson","DT26"],
    ["Ubi","DT27"],["Kaki Bukit","DT28"],["Bedok North","DT29"],["Bedok Reservoir","DT30"],
    ["Tampines West","DT31"],["Tampines","DT32"],["Tampines East","DT33"],["Upper Changi","DT34"],
    ["Expo","DT35"]]},

  TE:{name:"Thomson–East Coast Line",short:"Thomson–East Coast",color:"#9D5B25",hop:2.1,load:0.75,stations:[
    ["Woodlands North","TE1"],["Woodlands","TE2"],["Woodlands South","TE3"],["Springleaf","TE4"],
    ["Lentor","TE5"],["Mayflower","TE6"],["Bright Hill","TE7"],["Upper Thomson","TE8"],
    ["Caldecott","TE9"],["Stevens","TE11"],["Napier","TE12"],["Orchard Boulevard","TE13"],
    ["Orchard","TE14"],["Great World","TE15"],["Havelock","TE16"],["Outram Park","TE17"],
    ["Maxwell","TE18"],["Shenton Way","TE19"],["Marina Bay","TE20"],["Marina South","TE21"],
    ["Gardens by the Bay","TE22"],["Tanjong Rhu","TE23"],["Katong Park","TE24"],
    ["Tanjong Katong","TE25"],["Marine Parade","TE26"],["Marine Terrace","TE27"],["Siglap","TE28"],
    ["Bayshore","TE29"]]}
};

/* ---- 1b. GEOMETRY -------------------------------------------
   Coordinates for every place in the network, WGS84 (lat, lon).

   118 of these are area-weighted centroids computed from the
   provided PS2/data/AmendmenttoMP2014RailStation.geojson. That file
   declares crs: null; the coordinates in it are decimal degrees in
   EPSG:4326, which we confirmed by checking known stations against
   their real positions before using them.

   The 26 tagged with an m-comment are stations that opened after
   the 2014 Master Plan amendment and are absent from that dataset.
   They are entered from published station locations, and are
   accurate to roughly a building's width — enough to draw a line on
   a map, not survey grade. WRITEUP.md says so too.
   ------------------------------------------------------------- */
const COORD = {
  "Admiralty"             :[1.44059,103.80097],
  "Aljunied"              :[1.31643,103.88291],
  "Ang Mo Kio"            :[1.36995,103.84962],
  "Bartley"               :[1.34285,103.87972],
  "Bayfront"              :[1.28187,103.85907],
  "Bayshore"              :[1.31220,103.94340], /*m*/
  "Beauty World"          :[1.34123,103.77579],
  "Bedok"                 :[1.32401,103.93018],
  "Bedok North"           :[1.33500,103.91800], /*m*/
  "Bedok Reservoir"       :[1.33659,103.93230],
  "Bencoolen"             :[1.29874,103.85027],
  "Bendemeer"             :[1.31390,103.86290], /*m*/
  "Bishan"                :[1.35105,103.84868],
  "Boon Keng"             :[1.31945,103.86168],
  "Boon Lay"              :[1.33860,103.70606],
  "Botanic Gardens"       :[1.32211,103.81499],
  "Braddell"              :[1.34044,103.84680],
  "Bras Basah"            :[1.29683,103.85066],
  "Bright Hill"           :[1.36314,103.83285],
  "Buangkok"              :[1.38277,103.89309],
  "Bugis"                 :[1.30000,103.85627],
  "Bukit Batok"           :[1.34900,103.74954],
  "Bukit Gombak"          :[1.35867,103.75191],
  "Bukit Merah"           :[1.28190,103.82390], /*m*/
  "Bukit Panjang"         :[1.37849,103.76235],
  "Buona Vista"           :[1.30687,103.79029],
  "Caldecott"             :[1.33766,103.83954],
  "Canberra"              :[1.44320,103.82960], /*m*/
  "Cashew"                :[1.36937,103.76470],
  "Changi Airport"        :[1.35731,103.98837],
  "Chinatown"             :[1.28435,103.84348],
  "Chinese Garden"        :[1.34214,103.73282],
  "Choa Chu Kang"         :[1.38500,103.74446],
  "City Hall"             :[1.29293,103.85261],
  "Clarke Quay"           :[1.28861,103.84664],
  "Clementi"              :[1.31508,103.76523],
  "Commonwealth"          :[1.30245,103.79829],
  "Dakota"                :[1.30838,103.88867],
  "Dhoby Ghaut"           :[1.29915,103.84581],
  "Dover"                 :[1.31140,103.77865],
  "Downtown"              :[1.27950,103.85290], /*m*/
  "Esplanade"             :[1.29370,103.85523],
  "Eunos"                 :[1.31976,103.90326],
  "Expo"                  :[1.33490,103.96196],
  "Farrer Park"           :[1.31245,103.85427],
  "Farrer Road"           :[1.31746,103.80749],
  "Fort Canning"          :[1.29190,103.84460], /*m*/
  "Gardens by the Bay"    :[1.27940,103.86760], /*m*/
  "Geylang Bahru"         :[1.32150,103.87140], /*m*/
  "Great World"           :[1.29447,103.83343],
  "Gul Circle"            :[1.31970,103.66074],
  "HarbourFront"          :[1.26531,103.82151],
  "Havelock"              :[1.28844,103.83359],
  "Haw Par Villa"         :[1.28250,103.78182],
  "Hillview"              :[1.36234,103.76742],
  "Holland Village"       :[1.31195,103.79623],
  "Hougang"               :[1.37128,103.89235],
  "Hume"                  :[1.34570,103.76860], /*m*/
  "Jalan Besar"           :[1.30952,103.85920],
  "Joo Koon"              :[1.32774,103.67828],
  "Jurong East"           :[1.33311,103.74232],
  "Kaki Bukit"            :[1.33500,103.90880], /*m*/
  "Kallang"               :[1.31140,103.87132],
  "Katong Park"           :[1.29840,103.88530], /*m*/
  "Kembangan"             :[1.32104,103.91295],
  "Kent Ridge"            :[1.29340,103.78450],
  "Khatib"                :[1.41758,103.83304],
  "King Albert Park"      :[1.33550,103.78380], /*m*/
  "Kovan"                 :[1.36018,103.88509],
  "Kranji"                :[1.42519,103.76206],
  "Labrador Park"         :[1.27232,103.80293],
  "Lakeside"              :[1.34426,103.72097],
  "Lavender"              :[1.30737,103.86284],
  "Lentor"                :[1.38498,103.83629],
  "Little India"          :[1.30720,103.84986],
  "Lorong Chuan"          :[1.35162,103.86414],
  "MacPherson"            :[1.32622,103.88981],
  "Marina Bay"            :[1.27603,103.85481],
  "Marina South"          :[1.27410,103.86330], /*m*/
  "Marina South Pier"     :[1.27120,103.86320], /*m*/
  "Marine Parade"         :[1.30270,103.90530], /*m*/
  "Marine Terrace"        :[1.30650,103.91510], /*m*/
  "Marsiling"             :[1.43258,103.77404],
  "Marymount"             :[1.34878,103.83940],
  "Mattar"                :[1.32686,103.88326],
  "Maxwell"               :[1.28060,103.84440], /*m*/
  "Mayflower"             :[1.37216,103.83682],
  "Mountbatten"           :[1.30619,103.88255],
  "Napier"                :[1.30667,103.81908],
  "Newton"                :[1.31232,103.83801],
  "Nicoll Highway"        :[1.29980,103.86363],
  "Novena"                :[1.32043,103.84382],
  "Orchard"               :[1.30346,103.83188],
  "Orchard Boulevard"     :[1.30220,103.82480], /*m*/
  "Outram Park"           :[1.28060,103.83928],
  "Pasir Panjang"         :[1.27623,103.79135],
  "Pasir Ris"             :[1.37295,103.94926],
  "Paya Lebar"            :[1.31774,103.89267],
  "Pioneer"               :[1.33760,103.69741],
  "Potong Pasir"          :[1.33139,103.86907],
  "Promenade"             :[1.29314,103.86095],
  "Punggol"               :[1.40513,103.90237],
  "Queenstown"            :[1.29461,103.80604],
  "Raffles Place"         :[1.28407,103.85146],
  "Redhill"               :[1.28963,103.81676],
  "Rochor"                :[1.30393,103.85244],
  "Sembawang"             :[1.44907,103.82019],
  "Sengkang"              :[1.39153,103.89541],
  "Serangoon"             :[1.35007,103.87305],
  "Shenton Way"           :[1.27759,103.85067],
  "Siglap"                :[1.30950,103.92800], /*m*/
  "Simei"                 :[1.34320,103.95338],
  "Sixth Avenue"          :[1.33080,103.79726],
  "Somerset"              :[1.30026,103.83907],
  "Springleaf"            :[1.39814,103.81792],
  "Stadium"               :[1.30285,103.87535],
  "Stevens"               :[1.31990,103.82590], /*m*/
  "Tai Seng"              :[1.33545,103.88816],
  "Tampines"              :[1.35422,103.94409],
  "Tampines East"         :[1.35621,103.95478],
  "Tampines West"         :[1.34551,103.93843],
  "Tan Kah Kee"           :[1.32590,103.80760], /*m*/
  "Tanah Merah"           :[1.32725,103.94655],
  "Tanjong Katong"        :[1.29950,103.89550], /*m*/
  "Tanjong Pagar"         :[1.27663,103.84602],
  "Tanjong Rhu"           :[1.29370,103.87400], /*m*/
  "Telok Ayer"            :[1.28228,103.84832],
  "Telok Blangah"         :[1.27058,103.80974],
  "Tiong Bahru"           :[1.28622,103.82704],
  "Toa Payoh"             :[1.33268,103.84742],
  "Tuas Crescent"         :[1.32114,103.64898],
  "Tuas Link"             :[1.34027,103.63675],
  "Tuas West Road"        :[1.33004,103.63957],
  "Ubi"                   :[1.32995,103.89925],
  "Upper Changi"          :[1.34174,103.96147],
  "Upper Thomson"         :[1.35441,103.83291],
  "Woodlands"             :[1.43683,103.78617],
  "Woodlands North"       :[1.44820,103.78570], /*m*/
  "Woodlands South"       :[1.42720,103.79380], /*m*/
  "Woodleigh"             :[1.33921,103.87081],
  "Yew Tee"               :[1.39755,103.74740],
  "Yio Chu Kang"          :[1.38176,103.84480],
  "Yishun"                :[1.42958,103.83497],
  "one-north"             :[1.29966,103.78739]
};

const R_EARTH = 6371000;
function haversine(a, b){
  if(!a || !b) return null;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(b[0]-a[0]), dLon = toRad(b[1]-a[1]);
  const s = Math.sin(dLat/2)**2 +
            Math.cos(toRad(a[0]))*Math.cos(toRad(b[0]))*Math.sin(dLon/2)**2;
  return 2 * R_EARTH * Math.asin(Math.sqrt(s));
}
/* Street walking is not straight-line. 1.35 is the usual detour
   factor for a dense grid; 78 m/min is an unhurried adult pace.
   Both are stated in WRITEUP.md as assumptions, not measurements. */
const WALK_DETOUR = 1.35, WALK_MPM = 78, WALK_MPM_SLOW = 52;
function walkMinutes(a, b, slow){
  const m = haversine(a, b);
  if(m == null) return null;
  return (m * WALK_DETOUR) / (slow ? WALK_MPM_SLOW : WALK_MPM);
}

/* ---- 1c. DOOR-TO-DOOR ENDPOINTS -----------------------------
   The brief is explicit: a route that starts at a station and ends
   at a station is not a commuter's journey. These are real places
   people actually travel to, each with its own coordinate. The
   walking leg at each end is computed from that coordinate to the
   boarding point, not assumed.
   ------------------------------------------------------------- */
const LANDMARKS = {
  "Singapore General Hospital":{lat:1.27939,lon:103.83507,kind:"hospital",
    note:"Outram Road entrance. Sheltered link from Outram Park Exit 3."},
  "Tan Tock Seng Hospital":{lat:1.32152,lon:103.84585,kind:"hospital"},
  "Changi General Hospital":{lat:1.34035,lon:103.94918,kind:"hospital"},
  "National University Hospital":{lat:1.29424,lon:103.78327,kind:"hospital"},
  "Raffles Place offices":{lat:1.28437,lon:103.85159,kind:"work"},
  "Marina Bay Financial Centre":{lat:1.27972,lon:103.85432,kind:"work"},
  "one-north business park":{lat:1.29931,lon:103.78764,kind:"work"},
  "Changi Business Park":{lat:1.33450,lon:103.96460,kind:"work"},
  "Jurong Innovation District":{lat:1.34120,lon:103.70150,kind:"work"},
  "NUS Kent Ridge campus":{lat:1.29657,lon:103.77640,kind:"school"},
  "NTU Jurong West campus":{lat:1.34830,lon:103.68310,kind:"school"},
  "Singapore Polytechnic":{lat:1.30990,lon:103.77900,kind:"school"},
  "Singapore Management University":{lat:1.29610,lon:103.85040,kind:"school"},
  "Changi Airport Terminal 3":{lat:1.35570,lon:103.98650,kind:"transport"},
  "VivoCity":{lat:1.26440,lon:103.82200,kind:"shops"},
  "Jewel Changi":{lat:1.36020,lon:103.98950,kind:"shops"},
  "Singapore Sports Hub":{lat:1.30450,lon:103.87430,kind:"venue"},
  "Gardens by the Bay domes":{lat:1.28160,lon:103.86360,kind:"venue"}
};

/* Walking distance beyond which we stop offering a stop as an
   access point. 1.2 km is about 20 unhurried minutes. */
const MAX_ACCESS_M = 1200, MAX_ACCESS_STOPS = 4;

function pointOf(place){
  if(COORD[place]) return COORD[place];
  if(typeof isBusStop==="function" && isBusStop(place)){
    const s = busStop(place);
    return [s.la, s.lo];
  }
  const L = LANDMARKS[place];
  return L ? [L.lat, L.lon] : null;
}
/* The boarding points worth considering for a given origin or
   destination, nearest first. A station is its own access point
   (you still have to walk in), a landmark is not. */
function accessPoints(place, slow){
  const out = [];
  const p = pointOf(place);
  if(!p) return [];

  /* Standing at the place itself, when the place is somewhere you can
     board: a station, or a bus stop. */
  if(COORD[place]) out.push({stop:place, mins: slow ? 3 : 2, self:true});
  else if(typeof isBusStop==="function" && isBusStop(place))
    out.push({stop:place, mins: slow ? 2 : 1, self:true});
  else {
    for(const [name, c] of Object.entries(COORD)){
      const m = haversine(p, c);
      if(m == null || m > MAX_ACCESS_M) continue;
      out.push({stop:name, mins: walkMinutes(p, c, slow), metres:m, self:false});
    }
  }
  /* Real bus stops are access points too, and usually the nearest thing
     to a front door. This runs for stations as well as landmarks: a
     station is a fine place to start a bus journey, and without this a
     bus-only trip from a station has nowhere to board. */
  if(typeof stopsNear==="function" && typeof BUS_IDX!=="undefined" && BUS_IDX.loaded){
    for(const n of stopsNear(p[0], p[1], MAX_ACCESS_M).slice(0, 6)){
      if(n.code === place) continue;
      out.push({stop:n.code, mins: walkMinutes(p, [n.stop.la, n.stop.lo], slow),
                metres:n.metres, self:false, bus:true});
    }
  }
  out.sort((a,b)=>a.mins-b.mins);
  return out.slice(0, MAX_ACCESS_STOPS);
}

/* ---- 2. BUS -------------------------------------------------
   Corridors, not services. Each corridor is a road spine that
   buses actually run along; timings are modelled from distance
   and typical road speed. Exact service numbers and stop
   sequences come from DataMall BusRoutes / BusStops — this build
   does not guess them.
   ------------------------------------------------------------- */
const BUS_CORRIDORS = {
  B1:{name:"Thomson Road corridor",type:"arterial",hop:4.2,stops:[
    "Woodlands","Admiralty","Sembawang","Yishun","Khatib","Yio Chu Kang","Ang Mo Kio","Bishan",
    "Toa Payoh","Novena","Newton","Dhoby Ghaut","City Hall"]},
  B2:{name:"Bukit Timah Road corridor",type:"arterial",hop:4.0,stops:[
    "Bukit Panjang","Beauty World","King Albert Park","Sixth Avenue","Botanic Gardens","Newton",
    "Orchard","Somerset","Dhoby Ghaut"]},
  B3:{name:"Changi–Geylang corridor",type:"arterial",hop:4.4,stops:[
    "Changi Airport","Expo","Tampines","Bedok","Eunos","Paya Lebar","Kallang","Lavender","Bugis",
    "City Hall"]},
  B4:{name:"Jurong–Holland corridor",type:"arterial",hop:4.3,stops:[
    "Boon Lay","Jurong East","Clementi","Buona Vista","Holland Village","Napier","Orchard"]},
  B5:{name:"Upper Serangoon corridor",type:"arterial",hop:4.1,stops:[
    "Punggol","Sengkang","Hougang","Kovan","Serangoon","Potong Pasir","Boon Keng","Lavender","Bugis"]},
  B6:{name:"Paya Lebar cross-town",type:"arterial",hop:3.9,stops:[
    "Serangoon","Bartley","Tai Seng","MacPherson","Paya Lebar","Dakota","Mountbatten",
    "Nicoll Highway","Esplanade"]},
  B7:{name:"Southern corridor",type:"arterial",hop:3.8,stops:[
    "HarbourFront","Telok Blangah","Bukit Merah","Outram Park","Tanjong Pagar","Raffles Place",
    "Marina Bay"]},
  B8:{name:"Tampines–Bedok corridor",type:"arterial",hop:4.0,stops:[
    "Pasir Ris","Tampines","Simei","Tanah Merah","Bedok"]},
  B9:{name:"Choa Chu Kang corridor",type:"arterial",hop:4.2,stops:[
    "Choa Chu Kang","Bukit Gombak","Bukit Batok","Jurong East"]},
  B10:{name:"East Coast corridor",type:"arterial",hop:4.0,stops:[
    "Bedok","Siglap","Marine Parade","Tanjong Katong","Mountbatten","Nicoll Highway","Esplanade"]},
  B11:{name:"City circulation",type:"city",hop:3.2,stops:[
    "City Hall","Raffles Place","Tanjong Pagar","Chinatown","Clarke Quay","Dhoby Ghaut","Bras Basah",
    "Esplanade"]},
  B12:{name:"Woodlands–Bukit Panjang corridor",type:"arterial",hop:4.5,stops:[
    "Woodlands","Marsiling","Kranji","Choa Chu Kang","Bukit Panjang"]}
};

/* Places reachable by bus but not by rail. Rail-less town centres
   are exactly where the bus layer earns its place. */
const BUS_ONLY = new Set(["Bukit Merah"]);

/* ---- 3. INTERCHANGE WALKS ----------------------------------- */
const TRANSFER = {
  "City Hall":2,"Raffles Place":2,"Jurong East":3,"Tanah Merah":3,"Bayfront":3,
  "Bishan":4,"Chinatown":4,"Little India":4,"Stevens":4,"MacPherson":4,"Expo":4,
  "Serangoon":5,"Paya Lebar":5,"Bugis":5,"Botanic Gardens":5,"Buona Vista":5,
  "HarbourFront":5,"Caldecott":5,"Woodlands":5,
  "Promenade":6,"Outram Park":6,"Marina Bay":6,"Newton":6,"Orchard":6,
  "Dhoby Ghaut":7,"Tampines":7
};
/* Extra minutes when every step must be step-free. Lifts are often
   at the far ends of a concourse. */
const STEPFREE_EXTRA = {"Dhoby Ghaut":3,"Tampines":3,"Promenade":2,"Outram Park":2,"Newton":2,
  "Marina Bay":2,"Orchard":2,"Bugis":2,"Botanic Gardens":2,"Serangoon":2};
/* Walk from rail concourse out to the bus stop. */
const RAIL_TO_BUS = 4;

/* ---- 4. DEMAND & TRAFFIC ------------------------------------ */
/* Rail ridership shape, hourly 0–23, normalised. */
const DAYCURVE=[.05,.03,.02,.02,.04,.14,.38,.72,.97,.80,.55,.48,.58,.52,.48,.52,.66,.88,.95,.74,.52,.38,.26,.13];
/* Road congestion multiplier applied to bus running time, hourly. */
const ROADCURVE=[1.00,1.00,1.00,1.00,1.00,1.05,1.22,1.48,1.62,1.36,1.16,1.12,1.22,1.16,1.12,1.18,1.34,1.54,1.58,1.36,1.16,1.06,1.02,1.00];

const CBD = new Set(["Raffles Place","City Hall","Tanjong Pagar","Downtown","Telok Ayer","Marina Bay",
  "Shenton Way","Maxwell","Bugis","Dhoby Ghaut","Orchard","Somerset","Chinatown","Clarke Quay",
  "Promenade","Bayfront","Esplanade","Bras Basah","Newton","Novena","Bencoolen","Fort Canning"]);

function curveAt(curve, minutes){
  const h=Math.floor(minutes/60)%24, nx=(h+1)%24, f=(minutes%60)/60;
  return curve[h]*(1-f)+curve[nx]*f;
}
/* Human traffic on a rail leg: base demand × peak direction × line loading. */
/* The day the journey is planned for. Set by the interface when the
   commuter picks a date; defaults to today. Events need it — the model
   does not otherwise know that next Friday is Deepavali. */
let PLAN_DATE = null;
const planDate = () => PLAN_DATE || new Date();
function setPlanDate(d){ PLAN_DATE = d instanceof Date ? d : null; }

/* Crowding at a station, 0 to 1, and where the figure came from.

   Precedence is strict: a measurement always beats the model. Events
   only ever adjust the model, never a measured level — if LTA says a
   platform is `l` during Deepavali, it is `l`. */
function crowdDetail(lineKey, fromSt, toSt, minutes){
  if(typeof measuredCrowd==="function"){
    const m = measuredCrowd(fromSt, minutes);
    if(m) return {value:(LEVEL_VALUE[m.level]??0.6), source:m.source, events:[]};
  }
  const h=Math.floor(minutes/60)%24;
  const base=curveAt(DAYCURVE,minutes);
  let dir=1;
  if(h>=7&&h<10) dir = CBD.has(toSt)?1.25:(CBD.has(fromSt)?0.7:1);
  if(h>=17&&h<20) dir = CBD.has(fromSt)?1.25:(CBD.has(toSt)?0.7:1);
  let v = base*dir*(LINES[lineKey]?.load??0.8);

  let events=[];
  if(typeof eventLift==="function"){
    const boarding = eventLift(fromSt, planDate(), minutes);
    const alighting = eventLift(toSt,   planDate(), minutes);
    const lift = Math.max(boarding.lift, alighting.lift);
    if(lift>1){
      /* An event lifts the level towards full rather than multiplying
         past it: a platform cannot be 180% crowded. */
      v = v + (1-v)*( (lift-1)/1.5 ) + v*(lift-1)*0.35;
      events = boarding.lift>=alighting.lift ? boarding.events : alighting.events;
    }
  }
  return {value:Math.max(0,Math.min(1,v)), source:events.length?"event model":"modelled", events};
}

function crowdScore(lineKey, fromSt, toSt, minutes){
  return crowdDetail(lineKey, fromSt, toSt, minutes).value;
}
/* Bus load runs a little behind rail and never gets quite as extreme. */
function busLoad(minutes){ return Math.max(0,Math.min(1, curveAt(DAYCURVE,minutes)*0.85)); }
function roadFactor(minutes){ return curveAt(ROADCURVE,minutes); }

/* ---- LIVE CROWDING FROM DATAMALL -----------------------------
   Station Crowd Density, real-time and forecast: CrowdLevel is l, m, h
   or NA, per station, per line. PCDForecast is the one that makes
   proactive advice possible — it is published for the day ahead in
   30-minute intervals, so the app can warn a commuter at 07:30 that
   their 08:15 platform will be `h`.

   One call per line; the codes differ from the alert codes, which is
   what LINE_CODES is for.
   ------------------------------------------------------------- */
const CROWD_LIVE=new Map();        // "EW13"      -> "l" | "m" | "h"
const CROWD_FORECAST=new Map();    // "EW13@480"  -> "l" | "m" | "h"
const LEVEL_VALUE={l:0.28,m:0.6,h:0.9};

/* GET /ltaodataservice/PCDRealTime?TrainLine=<code> */
function ingestCrowdRealTime(payload){
  const v=payload&&payload.value?payload.value:payload;
  if(!Array.isArray(v)) return 0;
  let n=0;
  for(const r of v){
    if(!r.Station||!r.CrowdLevel||r.CrowdLevel==="NA") continue;
    CROWD_LIVE.set(r.Station,r.CrowdLevel); n++;
  }
  return n;
}
/* GET /ltaodataservice/PCDForecast?TrainLine=<code>
   Keyed to the half hour, so a journey planned for later today can
   still be advised on. */
function ingestCrowdForecast(payload){
  const v=payload&&payload.value?payload.value:payload;
  if(!Array.isArray(v)) return 0;
  let n=0;
  for(const day of v){
    for(const iv of (day.Stations||day.Intervals||[])){
      const t=iv.Start||iv.StartTime;
      if(!t) continue;
      const d=new Date(t); if(isNaN(d)) continue;
      const slot=d.getHours()*60+(d.getMinutes()<30?0:30);
      for(const s of (iv.Stations||[])){
        if(!s.Station||!s.CrowdLevel||s.CrowdLevel==="NA") continue;
        CROWD_FORECAST.set(s.Station+"@"+slot,s.CrowdLevel); n++;
      }
    }
  }
  return n;
}
/* A measured level for a station at a time, or null if we have none.
   Forecast first for a future time, live otherwise. */
function measuredCrowd(stationName,minutes){
  const codes=CODES.get(stationName)||[];
  const slot=Math.floor(minutes/30)*30;
  for(const c of codes){
    const f=CROWD_FORECAST.get(c+"@"+slot);
    if(f) return {level:f,source:"forecast"};
  }
  for(const c of codes){
    const l=CROWD_LIVE.get(c);
    if(l) return {level:l,source:"live"};
  }
  return null;
}
const hasLiveCrowd=()=>CROWD_LIVE.size>0||CROWD_FORECAST.size>0;

/* ---- 5. WEATHER --------------------------------------------- */
const WEATHER_SNAPSHOT = {
  updated:"2026-09-18T06:00:00+08:00",
  periods:[
    {start:6,end:8,text:"Partly cloudy",rain:0.10},
    {start:8,end:10,text:"Partly cloudy",rain:0.15},
    {start:10,end:12,text:"Cloudy",rain:0.30},
    {start:12,end:14,text:"Passing showers",rain:0.55},
    {start:14,end:16,text:"Thundery showers",rain:0.80},
    {start:16,end:18,text:"Thundery showers",rain:0.70},
    {start:18,end:20,text:"Showers easing",rain:0.40},
    {start:20,end:22,text:"Partly cloudy",rain:0.20},
    {start:22,end:24,text:"Fair",rain:0.10},
    {start:0,end:2,text:"Fair",rain:0.05},
    {start:2,end:4,text:"Fair",rain:0.05},
    {start:4,end:6,text:"Fair",rain:0.10}]
};
function rainAt(minutes){
  const h=Math.floor(minutes/60)%24;
  return WEATHER_SNAPSHOT.periods.find(p=> p.end>p.start?(h>=p.start&&h<p.end):(h>=p.start||h<p.end))
      || {text:"Fair",rain:0.1};
}

/* ---- 6. SERVICE CHANGES ------------------------------------
   Four kinds, four different real sources. Kept in one feed
   because the commuter does not care which office issued it.
   ------------------------------------------------------------- */
const FEED = [
  {id:"f1",kind:"fault",line:"EW",from:"Bugis",to:"Tanah Merah",severity:"delay",active:true,
   headline:"East West Line running slow, Bugis to Tanah Merah",
   detail:"Signalling fault. Add about 15 minutes between Bugis and Tanah Merah.",
   source:"SGMRT Telegram",time:"09:12",at:552},

  {id:"f2",kind:"fault",line:"DT",from:"Bukit Panjang",to:"Beauty World",severity:"delay",active:false,
   headline:"Downtown Line delays, Bukit Panjang to Beauty World",
   detail:"Train fault clearing. Expect roughly 10 extra minutes.",
   source:"SGMRT Telegram",time:"08:47",at:527},

  {id:"f3",kind:"fault",line:"NS",from:"Ang Mo Kio",to:"Toa Payoh",severity:"suspended",active:false,
   headline:"No North South Line service, Ang Mo Kio to Toa Payoh",
   detail:"Track obstruction. Free bridging buses are running along the stretch.",
   source:"SGMRT Telegram",time:"07:58",at:478},

  {id:"f4",kind:"works",line:"CC",from:"Marymount",to:"HarbourFront",severity:"closure",active:false,
   headline:"Circle Line closing early, Marymount to HarbourFront",
   detail:"Renewal works. Last trains from 11pm this weekend; shuttle buses replace the stretch.",
   source:"LTA service advisory",time:"Weekend",at:1380},

  {id:"f5",kind:"lift",line:null,station:"Dhoby Ghaut",severity:"accessibility",active:true,
   headline:"Lift out of service at Dhoby Ghaut",
   detail:"The lift between the North East and Circle line concourses is under repair until Friday. Step-free journeys are routed around this interchange.",
   source:"Station notice",time:"Since Mon"},

  {id:"f6",kind:"lift",line:null,station:"Outram Park",severity:"accessibility",active:false,
   headline:"Escalator works at Outram Park",
   detail:"Two escalators to the Thomson–East Coast platforms are down. Lifts are unaffected.",
   source:"Station notice",time:"Since Wed"},

  {id:"f7",kind:"road",corridor:"B3",severity:"congestion",active:true,
   headline:"Accident on the PIE towards Changi",
   detail:"One lane blocked near Eunos. Buses along the Changi–Geylang corridor are running about 8 minutes late.",
   source:"DataMall TrafficIncidents",time:"09:05"},

  {id:"f8",kind:"works",line:"NS",from:"Jurong East",to:"Bukit Batok",severity:"closure",active:false,
   headline:"Bukit Batok station upgrading works",
   detail:"Platform A is hoarded off for lift installation. Trains run, but boarding is slower at peak.",
   source:"LTA service advisory",time:"Until Nov",at:600}
];

/* ---- 7. GRAPH ----------------------------------------------- */
const STATIONS=new Map();      // name -> Set(lineKeys)
const CODES=new Map();         // name -> [codes]
for(const [k,l] of Object.entries(LINES)){
  for(const [name,code] of l.stations){
    if(!STATIONS.has(name)) STATIONS.set(name,new Set());
    STATIONS.get(name).add(k);
    if(!CODES.has(name)) CODES.set(name,[]);
    if(!CODES.get(name).includes(code)) CODES.get(name).push(code);
  }
}
const BUS_STOPS=new Map();     // name -> Set(corridorKeys)
for(const [k,c] of Object.entries(BUS_CORRIDORS))   /* modelled fallback */
  for(const s of c.stops){
    if(!BUS_STOPS.has(s)) BUS_STOPS.set(s,new Set());
    BUS_STOPS.get(s).add(k);
  }
const PLACES=[...new Set([...STATIONS.keys(),...BUS_STOPS.keys()])].sort((a,b)=>a.localeCompare(b));
const codeOf=n=>(CODES.get(n)||[]).join(" ");

const nid=(k,s)=>k+"|"+s;
const GRAPH=new Map();
const link=(a,b,w,meta)=>{ if(!GRAPH.has(a))GRAPH.set(a,[]); GRAPH.get(a).push({to:b,w,...meta}); };

for(const [k,l] of Object.entries(LINES))
  for(let i=0;i<l.stations.length-1;i++){
    const a=nid(k,l.stations[i][0]), b=nid(k,l.stations[i+1][0]);
    link(a,b,l.hop,{kind:"ride",mode:"rail",line:k});
    link(b,a,l.hop,{kind:"ride",mode:"rail",line:k});
  }
for(const [k,c] of Object.entries(BUS_CORRIDORS))
  for(let i=0;i<c.stops.length-1;i++){
    const a=nid("BUS:"+k,c.stops[i]), b=nid("BUS:"+k,c.stops[i+1]);
    link(a,b,c.hop,{kind:"ride",mode:"bus",line:k,corridor:true});
    link(b,a,c.hop,{kind:"ride",mode:"bus",line:k,corridor:true});
  }
/* interchanges: rail↔rail, bus↔bus, rail↔bus */
for(const place of PLACES){
  const rail=[...(STATIONS.get(place)||[])].map(k=>({k,mode:"rail"}));
  const bus =[...(BUS_STOPS.get(place)||[])].map(k=>({k:"BUS:"+k,mode:"bus"}));
  const all=[...rail,...bus];
  for(const a of all) for(const b of all){
    if(a.k===b.k) continue;
    let w;
    if(a.mode==="rail"&&b.mode==="rail") w=TRANSFER[place]??5;
    else if(a.mode==="bus"&&b.mode==="bus") w=2;
    else w=RAIL_TO_BUS;
    link(nid(a.k,place),nid(b.k,place),w,{kind:"transfer",mode:b.mode,line:b.k,at:place,
      corridor:(a.mode==="bus"||b.mode==="bus"),
      from:a.mode,toMode:b.mode});
  }
}

/* ---- 8. DISRUPTION MATCHING --------------------------------- */
function railHit(d,lineKey,a,b){
  if(!d.active||d.line!==lineKey||!d.from) return false;
  const seq=LINES[lineKey].stations.map(s=>s[0]);
  const lo=Math.min(seq.indexOf(d.from),seq.indexOf(d.to));
  const hi=Math.max(seq.indexOf(d.from),seq.indexOf(d.to));
  const ia=seq.indexOf(a), ib=seq.indexOf(b);
  return Math.min(ia,ib)>=lo&&Math.max(ia,ib)<=hi;
}
const busHit=(d,corridorKey)=>d.active&&d.kind==="road"&&d.corridor===corridorKey;
const liftOut=station=>FEED.some(d=>d.active&&d.kind==="lift"&&d.station===station&&d.severity==="accessibility");

/* ---- 9. ROUTING --------------------------------------------- */
const PROFILES={
  /* changeCost defaults to 0; only the two plan shapes set it. */
  balanced:{label:"Balanced",     transfer:1.0,crowd:6, rain:3, traffic:4,stepfree:false},
  fastest: {label:"Fastest",      transfer:0.7,crowd:1, rain:0, traffic:2,stepfree:false},
  fewest:  {label:"Fewer changes",transfer:2.8,crowd:3, rain:2, traffic:4,stepfree:false},
  quiet:   {label:"Quieter",      transfer:1.2,crowd:22,rain:3, traffic:4,stepfree:false},
  stepfree:{label:"Step-free",    transfer:1.6,crowd:6, rain:4, traffic:4,stepfree:true},
  dry:     {label:"Driest",       transfer:1.3,crowd:5, rain:16,traffic:4,stepfree:false},
  lesswalk:{label:"Least walking",transfer:3.4,crowd:5, rain:5, traffic:4,stepfree:false}
};

/* opts: {modes:{rail,bus}, avoidLines:[], maxTransferWalk:number} */
/* Binary min-heap. The previous version re-sorted an array on every
   push, which is fine for a few hundred rail nodes and quadratic once
   the real bus network is loaded — that is ~30,000 nodes. */
class MinHeap{
  constructor(){ this.a=[]; }
  get size(){ return this.a.length; }
  push(cost,node){
    const a=this.a; a.push([cost,node]);
    let i=a.length-1;
    while(i>0){ const p=(i-1)>>1;
      if(a[p][0]<=a[i][0]) break;
      [a[p],a[i]]=[a[i],a[p]]; i=p; }
  }
  pop(){
    const a=this.a;
    if(!a.length) return null;
    const top=a[0], last=a.pop();
    if(a.length){
      a[0]=last;
      for(let i=0;;){
        const l=2*i+1, r=l+1; let s=i;
        if(l<a.length&&a[l][0]<a[s][0]) s=l;
        if(r<a.length&&a[r][0]<a[s][0]) s=r;
        if(s===i) break;
        [a[s],a[i]]=[a[i],a[s]]; i=s;
      }
    }
    return top;
  }
}

function route(fromSt,toSt,departMin,prof,opts){
  opts=opts||{};
  const modes=opts.modes||{rail:true,bus:true};
  const avoid=new Set(opts.avoidLines||[]);
  if(fromSt===toSt) return null;
  const slow = !!prof.stepfree;

  /* Door to door. The origin and destination may be a station, a bus
     stop, or a landmark that is neither. Either way the journey opens
     and closes with a walk, and that walk is part of the time. */
  const originAccess = accessPoints(fromSt, slow);
  const destAccess   = accessPoints(toSt,   slow);
  if(!originAccess.length || !destAccess.length) return null;

  /* Once the real network is loaded the twelve modelled corridors are
     switched off completely. Leaving them in would let the router pick a
     corridor it cannot name a service for, which is exactly the bug this
     replaces — and they are artificially cheap, having no boarding wait. */
  const realBus = typeof BUS_IDX!=="undefined" && BUS_IDX.loaded;
  const platformsAt = place => {
    const out=[];
    /* A five-digit code is a real DataMall stop; it has its own node. */
    if(modes.bus && typeof isBusStop==="function" && isBusStop(place)) out.push("S|"+place);
    if(modes.rail) for(const k of (STATIONS.get(place)||[])) out.push(nid(k,place));
    if(modes.bus && !realBus)
      for(const k of (BUS_STOPS.get(place)||[])) out.push(nid("BUS:"+k,place));
    return out;
  };
  const destStops = new Map(destAccess.map(a=>[a.stop,a.mins]));

  const dist=new Map(),prev=new Map(),realT=new Map();
  const pq=new MinHeap();
  const push=(n,c)=>pq.push(c,n);
  const access=new Map();          // node -> access walk minutes used to reach it
  let seeded=false;
  for(const a of originAccess){
    for(const n of platformsAt(a.stop)){
      const w=a.mins;
      if(w < (dist.get(n)??Infinity)){
        dist.set(n,w); realT.set(n,w); access.set(n,{mins:w,at:a.stop,self:a.self});
        push(n,w); seeded=true;
      }
    }
  }
  if(!seeded) return null;

  /* A virtual destination node sits one walk-edge beyond every
     destination access point. Without it the search would stop at the
     first access point it happened to reach, which is not necessarily
     the one with the shortest walk on the far side. */
  const DEST="\u0000DEST";
  let goal=null, goalEgress=0, goalStop=null;
  while(pq.size){
    const [cost,node]=pq.pop();
    if(cost>(dist.get(node)??Infinity)) continue;
    if(node===DEST){ const p=prev.get(DEST); goal=p[0]; goalEgress=p[2]; goalStop=goal.split("|")[1]; break; }
    const st=node.split("|")[1];
    if(destStops.has(st)){
      const w=destStops.get(st), nc=cost+w+(w>6?(w-6)*1.5:0);
      if(nc<(dist.get(DEST)??Infinity)){
        dist.set(DEST,nc); realT.set(DEST,(realT.get(node)||0)+w);
        prev.set(DEST,[node,{kind:"egress"},w]); push(DEST,nc);
      }
    }
    for(const e of (GRAPH.get(node)||[])){
      if(e.mode==="rail"&&!modes.rail) continue;
      if(e.mode==="bus" &&!modes.bus)  continue;
      if(realBus&&e.corridor) continue;          // superseded by the real network
      const nst=e.to.split("|")[1];
      const elapsed=realT.get(node)||0, clock=departMin+elapsed;
      let mins=e.w,pen=0;

      if(e.kind==="ride"){
        if(e.mode==="rail"){
          if(avoid.has(e.line)) continue;
          let blocked=false;
          for(const d of FEED){
            if(!railHit(d,e.line,st,nst)) continue;
            if(d.severity==="suspended"){ blocked=true; break; }
            if(d.severity==="closure"){ mins+=2; pen+=5; }
            else { mins+=3.5; pen+=8; }
          }
          if(blocked) continue;
          pen += crowdScore(e.line,st,nst,clock)*prof.crowd*0.34;
        } else {
          const cKey=e.line;
          const tf=roadFactor(clock);
          mins *= tf;
          pen += (tf-1)*prof.traffic*2.2;
          for(const d of FEED) if(busHit(d,cKey)){ mins+=2.7; pen+=4; }
          pen += busLoad(clock)*prof.crowd*0.18;
        }
      } else if(e.kind==="board"){
        /* Never board a service that is not running at this hour. */
        if(typeof serviceRunning==="function" && !serviceRunning(e.line, clock)) continue;
        /* Waiting for a bus is the honest cost of changing bus, and the
           reason staying on one service usually beats a clever hop. It
           comes from the published headway where DataMall gives one. */
        mins = (typeof busWaitMins==="function") ? busWaitMins(e.line, clock) : 6;
        pen += (prof.changeCost||0) + Math.max(0, prof.transfer-1)*mins*0.5;
      } else if(e.kind==="alight"){
        mins = e.w;
      } else {
        if(prof.stepfree){
          if(e.from==="rail"&&e.toMode==="rail"){
            if(liftOut(e.at)) continue;              // no step-free path through here
            mins += (STEPFREE_EXTRA[e.at]||1);
          } else mins += 2;
        }
        if(opts.maxTransferWalk!=null && mins>opts.maxTransferWalk) pen += (mins-opts.maxTransferWalk)*6;
        /* Flat cost on a stop-to-stop walk, or the router strings three
           short walks together to save a minute nobody would walk for. */
        if(e.line==="WALKSTOP") pen += 1.5;
        pen += mins*Math.max(0, prof.transfer-1) + prof.transfer*2.2;
        /* A flat cost per change, independent of how short the walk is.
           Getting off a train and onto another one has a cost in
           attention and risk that a walking time does not capture. */
        pen += (prof.changeCost||0);
        /* Changing between modes — rail to bus, bus to rail — is a
           bigger ask than crossing a platform. */
        if(prof.changeCost && e.from && e.toMode && e.from!==e.toMode) pen += prof.changeCost*0.6;
      }
      const nc=cost+mins+pen, nt=elapsed+mins;
      if(nc<(dist.get(e.to)??Infinity)){
        dist.set(e.to,nc); realT.set(e.to,nt); prev.set(e.to,[node,e,mins]); push(e.to,nc);
      }
    }
  }
  if(!goal) return null;

  const steps=[]; let cur=goal;
  while(prev.has(cur)&&cur!==DEST){ const [p,e,m]=prev.get(cur); steps.unshift({from:p,to:cur,e,m}); cur=p; }

  const legs=[];
  const acc=access.get(steps.length?steps[0].from:goal)||{mins:0,at:fromSt,self:true};
  let t=departMin;
  /* opening walk */
  legs.push({kind:"walk",phase:"access",from:fromSt,to:acc.at,mins:acc.mins,start:t,
             self:acc.self});
  t+=acc.mins;
  for(const s of steps){
    const aSt=s.from.split("|")[1], bSt=s.to.split("|")[1];
    if(s.e.kind==="board"){
      /* Show the wait as its own step only when it is a change of
         service. The wait before the first bus belongs to the start of
         the journey, not to a transfer nobody made. */
      const prev0=legs[legs.length-1];
      if(prev0&&prev0.kind==="ride")
        legs.push({kind:"transfer",at:aSt,mode:"bus",line:s.e.line,
                   service:serviceNo(s.e.line),mins:s.m,start:t,wait:true,
                   waitSource:(typeof busWait==="function"
                     ? busWait(s.e.line,t).source : "modelled")});
      t+=s.m; continue;
    }
    if(s.e.kind==="alight"){ t+=s.m; continue; }
    if(s.e.kind==="transfer"){
      legs.push({kind:"transfer",at:s.e.at,mode:s.e.toMode,line:s.e.line,mins:s.m,start:t});
      t+=s.m; continue;
    }
    const last=legs[legs.length-1];
    if(last&&last.kind==="ride"&&last.line===s.e.line){
      last.stops.push(bSt); last.mins+=s.m; last.to=bSt;
    } else {
      legs.push({kind:"ride",mode:s.e.mode,line:s.e.line,from:aSt,to:bSt,stops:[aSt,bSt],
                 mins:s.m,start:t,real:!!s.e.real,
                 service:s.e.real?serviceNo(s.e.line):null});
    }
    t+=s.m;
  }
  for(const l of legs){
    if(l.kind!=="ride") continue;
    if(l.mode==="rail"){
      const cd=crowdDetail(l.line,l.from,l.to,l.start);
      l.crowd=cd.value; l.crowdSource=cd.source; l.crowdEvents=cd.events;
      l.issues=FEED.filter(d=>{
        for(let i=0;i<l.stops.length-1;i++) if(railHit(d,l.line,l.stops[i],l.stops[i+1])) return true;
        return false;
      });
    } else {
      l.crowd=busLoad(l.start);
      l.traffic=roadFactor(l.start);
      l.issues=l.real?[]:FEED.filter(d=>busHit(d,l.line));
    }
  }
  /* closing walk */
  legs.push({kind:"walk",phase:"egress",from:goalStop,to:toSt,mins:goalEgress,start:t,
             self:destAccess.find(a=>a.stop===goalStop)?.self});
  t+=goalEgress;

  const total=legs.reduce((a,l)=>a+l.mins,0);
  const transferWalk=legs.filter(l=>l.kind==="transfer").reduce((a,l)=>a+l.mins,0);
  const endWalk=legs.filter(l=>l.kind==="walk").reduce((a,l)=>a+l.mins,0);
  const rides=legs.filter(l=>l.kind==="ride");
  /* A "change" is anything the commuter has to physically do mid-journey:
     get off one vehicle and onto another. The opening and closing walks
     are not changes; they happen either way. */
  const changes=legs.filter(l=>l.kind==="transfer").length;
  return {legs,total,
          walkMins:transferWalk+endWalk, transferWalk, endWalk,
          profile:prof,opts,from:fromSt,to:toSt,depart:departMin,arrive:departMin+total,
          transfers:changes, changes,
          modes:[...new Set(rides.map(l=>l.mode))],
          modeCount:new Set(rides.map(l=>l.mode)).size,
          vehicles:rides.length};
}

function routeIgnoringFeed(a,b,t,prof,opts){
  const saved=FEED.map(d=>d.active);
  FEED.forEach(d=>d.active=false);
  const r=route(a,b,t,prof||PROFILES.fastest,opts);
  FEED.forEach((d,i)=>d.active=saved[i]);
  return r;
}

/* Approximate distance-based fare. Singapore fares are distance
   banded; this is a rough estimate, labelled as one in the UI. */
function estimateFare(plan){
  const km = plan.legs.filter(l=>l.kind==="ride")
    .reduce((a,l)=>a + (l.stops.length-1)*(l.mode==="rail"?1.25:1.05),0);
  const f = km<=3.2 ? 1.19 : 1.19 + Math.min(1.5, (km-3.2)*0.043);
  return Math.round(f*100)/100;
}

/* ---- 10. INTENT PARSING ------------------------------------
   Works with no API key. An LLM, when configured, produces the
   same shape and this becomes the fallback.
   ------------------------------------------------------------ */
const ALIAS={
  "cbd":"Raffles Place","town":"Orchard","city":"City Hall","airport":"Changi Airport",
  "changi":"Changi Airport","harbourfront":"HarbourFront","vivo":"HarbourFront",
  "vivocity":"HarbourFront","amk":"Ang Mo Kio","cck":"Choa Chu Kang","bp":"Bukit Panjang",
  "jurong":"Jurong East","tpy":"Toa Payoh","mbs":"Bayfront","marina bay sands":"Bayfront",
  "nus":"Kent Ridge","ntu":"Pioneer","smu":"Bras Basah","expo":"Expo","one north":"one-north",
  "esplanade":"Esplanade","botanic":"Botanic Gardens","gardens by the bay":"Gardens by the Bay"
};
const norm=s=>s.toLowerCase().replace(/[^a-z0-9\- ]/g," ").replace(/\s+/g," ").trim();

function matchPlace(text){
  const t=norm(text);
  if(!t) return null;
  if(ALIAS[t]) return ALIAS[t];
  const codeHit=[...CODES.entries()].find(([,cs])=>cs.some(c=>c.toLowerCase()===t));
  if(codeHit) return codeHit[0];
  let best=null,bestLen=0;
  for(const p of PLACES){
    const np=norm(p);
    if(t===np) return p;
    if(t.includes(np)&&np.length>bestLen){ best=p; bestLen=np.length; }
  }
  if(best) return best;
  for(const [k,v] of Object.entries(ALIAS)) if(t.includes(k)) return v;
  /* Nothing in the 144 rail places matched. Once the real bus network is
     loaded there are another 5,200 stops that are perfectly valid
     origins and destinations — "Amber Gardens" is a bus stop, not a
     station, and refusing it made the app look broken. Rail is still
     tried first, because a commuter typing "Bedok" means the station. */
  if(typeof matchBusStop === "function"){
    const stop = matchBusStop(text);
    if(stop) return stop;
  }
  return null;
}

function parseTime(text,nowMin){
  const t=text.toLowerCase();
  let m=t.match(/(?:in)\s+(\d{1,3})\s*(?:min|mins|minutes)/);
  if(m) return {depart:nowMin+ +m[1]};
  m=t.match(/(?:at|by|before|around)\s*(\d{1,2})[:.](\d{2})\s*(am|pm)?/);
  if(!m) m=t.match(/(?:at|by|before|around)\s*(\d{1,2})\s*(am|pm)/);
  if(m){
    let h=+m[1], mi=m[2]&&/^\d+$/.test(m[2])?+m[2]:0;
    const ap=(m[3]||m[2]||"").toString().toLowerCase();
    if(ap==="pm"&&h<12) h+=12;
    if(ap==="am"&&h===12) h=0;
    const mins=h*60+mi;
    return /\b(by|before)\b/.test(t) ? {arrive:mins} : {depart:mins};
  }
  if(/\b(tonight|this evening)\b/.test(t)) return {depart:19*60};
  if(/\btomorrow morning\b/.test(t)) return {depart:8*60};
  return {};
}

function parseIntent(text,nowMin){
  const t=norm(text);
  const out={constraints:[],modes:{rail:true,bus:true},modesExplicit:false,
            prefs:new Set(),avoidLines:[]};

  /* origin / destination */
  let m=text.match(/from\s+(.+?)\s+(?:to|→|->)\s+([^,.?!]+)/i);
  if(!m) m=text.match(/\b([\w\-' ]{3,28}?)\s+(?:to|→|->)\s+([\w\-' ]{3,28})/i);
  if(m){ out.from=matchPlace(m[1]); out.to=matchPlace(m[2]); }
  if(!out.to){
    const g=text.match(/\b(?:to|towards|get to|reach|heading to|going to)\s+([\w\-' ]{3,28})/i);
    if(g) out.to=matchPlace(g[1]);
  }
  if(!out.from){
    const g=text.match(/\b(?:from|i'?m at|im at|at|starting at|leaving)\s+([\w\-' ]{3,28})/i);
    if(g) out.from=matchPlace(g[1]);
  }

  Object.assign(out,parseTime(text,nowMin));

  /* mode constraints */
  if(/\b(bus only|only bus|just bus|no train|without train|avoid train|trains? are down)\b/.test(t)){
    out.modes={rail:false,bus:true}; out.modesExplicit=true; out.constraints.push("bus only");
  }
  if(/\b(train only|only train|mrt only|no bus|without bus)\b/.test(t)){
    out.modes={rail:true,bus:false}; out.modesExplicit=true; out.constraints.push("rail only");
  }
  /* walking */
  const w=t.match(/(?:no more than|under|less than|max|maximum|at most)\s*(\d{1,2})\s*(?:min|mins|minutes)?\s*(?:of\s*)?walk/);
  if(w){ out.maxTransferWalk=+w[1]; out.prefs.add("lesswalk"); out.constraints.push(`under ${w[1]} min walking`); }
  else if(/\b(don'?t|dont|do not|hate|avoid|minimal|less|least|not much|no)\b[^.]{0,18}\bwalk/.test(t)
       || /\bwalk(ing)?\b[^.]{0,12}\b(hurts|sore|painful|tired)\b/.test(t)){
    out.prefs.add("lesswalk"); out.maxTransferWalk=4; out.constraints.push("as little walking as possible");
  }
  /* accessibility */
  if(/\b(step-?free|wheelchair|stroller|pram|lift|elevator|crutch|luggage|suitcase)\b/.test(t)){
    out.prefs.add("stepfree"); out.constraints.push("step-free");
  }
  /* crowding */
  if(/\b(crowds?|crowded|crowding|packed|squeezy?|jam|jammed|quiet|quieter|empty|seats?|sit down|less people|fewer people|avoid people|peak hour|rush hour)\b/.test(t)){
    out.prefs.add("quiet"); out.constraints.push("quieter trains");
  }
  /* weather */
  if(/\b(rain|raining|wet|umbrella|dry|shelter|sheltered|pour|storm)\b/.test(t)){
    out.prefs.add("dry"); out.constraints.push("stay dry");
  }
  /* transfers */
  if(/\b(no transfer|direct|one train|without changing|fewest change|less change|no change|straight through)\b/.test(t)){
    out.prefs.add("fewest"); out.constraints.push("fewest changes");
  }
  /* speed */
  if(/\b(fast|fastest|quick|quickest|hurry|rush|late|asap|urgent)\b/.test(t)){
    out.prefs.add("fastest"); out.constraints.push("fastest");
  }
  /* avoid a named line */
  for(const [k,l] of Object.entries(LINES)){
    const n=norm(l.short);
    if(new RegExp(`avoid[^.]{0,20}${n}|no ${n}|${n}[^.]{0,12}(down|broken|stuck|delayed)`).test(t))
      out.avoidLines.push(k);
  }
  return out;
}

/* Pick a weight profile from a set of preference keys. */
function profileFor(prefs){
  if(prefs.has("stepfree")) return PROFILES.stepfree;
  if(prefs.has("lesswalk")) return PROFILES.lesswalk;
  if(prefs.has("dry")&&prefs.has("quiet")) return {...PROFILES.quiet,rain:14,label:"Quiet and dry"};
  if(prefs.has("dry")) return PROFILES.dry;
  if(prefs.has("quiet")) return PROFILES.quiet;
  if(prefs.has("fewest")) return PROFILES.fewest;
  if(prefs.has("fastest")) return PROFILES.fastest;
  return PROFILES.balanced;
}

/* ---- 11. ROAD WORKS AND INCIDENTS -> BUS IMPACT --------------
   DataMall gives road works and incidents against road names, not
   bus corridors. This table is the join: the roads each modelled
   corridor actually runs along. Matching is on road name, so it is
   only as good as the names LTA publishes — misses are logged in the
   Sources tab rather than silently dropped.
   ------------------------------------------------------------- */
const CORRIDOR_ROADS = {
  B1:["THOMSON RD","UPPER THOMSON RD","SEMBAWANG RD","YISHUN AVE","LORONG 6 TOA PAYOH","BUKIT TIMAH RD"],
  B2:["BUKIT TIMAH RD","UPPER BUKIT TIMAH RD","DUNEARN RD","ORCHARD RD"],
  B3:["CHANGI RD","SIMS AVE","GEYLANG RD","EAST COAST PKWY","ECP","PAN ISLAND EXPRESSWAY","PIE","AIRPORT BLVD"],
  B4:["JURONG TOWN HALL RD","COMMONWEALTH AVE WEST","HOLLAND RD","NAPIER RD","AYE","AYER RAJAH EXPRESSWAY"],
  B5:["UPPER SERANGOON RD","SERANGOON RD","PUNGGOL RD","SENGKANG EAST WAY","KALLANG BAHRU"],
  B6:["BARTLEY RD","PAYA LEBAR RD","MACPHERSON RD","MOUNTBATTEN RD","NICOLL HIGHWAY"],
  B7:["TELOK BLANGAH RD","JALAN BUKIT MERAH","CANTONMENT RD","ROBINSON RD","SHENTON WAY"],
  B8:["TAMPINES AVE","BEDOK NORTH RD","NEW UPPER CHANGI RD","PASIR RIS DR"],
  B9:["CHOA CHU KANG RD","BUKIT BATOK RD","UPPER BUKIT TIMAH RD","JURONG EAST AVE"],
  B10:["EAST COAST RD","MARINE PARADE RD","MOUNTBATTEN RD","NICOLL HIGHWAY","UPPER EAST COAST RD"],
  B11:["NORTH BRIDGE RD","SOUTH BRIDGE RD","EU TONG SEN ST","VICTORIA ST","STAMFORD RD"],
  B12:["WOODLANDS RD","MARSILING RD","KRANJI RD","CHOA CHU KANG WAY","BUKIT PANJANG RD"]
};
const normRoad = s => String(s||"").toUpperCase()
  .replace(/\bROAD\b/g,"RD").replace(/\bAVENUE\b/g,"AVE").replace(/\bSTREET\b/g,"ST")
  .replace(/\bDRIVE\b/g,"DR").replace(/[^A-Z0-9 ]/g," ").replace(/\s+/g," ").trim();

/* Which corridors a free-text road description touches. */
function corridorsForRoad(text){
  const t = normRoad(text);
  if(!t) return [];
  const hits = [];
  for(const [k, roads] of Object.entries(CORRIDOR_ROADS))
    if(roads.some(r => t.includes(normRoad(r)))) hits.push(k);
  return hits;
}

/* Minutes a corridor loses, and how confident we are. Road works are
   planned and usually mild; an incident is unplanned and worse. The
   numbers are a model, and every place they surface says so. */
const IMPACT = {works:{mins:3, label:"road works"}, incident:{mins:8, label:"incident"},
                closure:{mins:12,label:"road closed"}};
function busImpact(corridorKey, clock){
  let mins = 0; const causes = [];
  for(const d of FEED){
    if(!d.active) continue;
    if(d.kind!=="road" && d.kind!=="works") continue;
    const hit = d.corridor===corridorKey ||
                (d.road && corridorsForRoad(d.road).includes(corridorKey));
    if(!hit) continue;
    const band = IMPACT[d.impact||(d.severity==="congestion"?"incident":"works")]||IMPACT.works;
    let m = band.mins;
    /* A blocked lane costs far more at peak than at 11pm. */
    m *= 0.55 + 0.75*(roadFactor(clock)-1)/0.62;
    mins += m; causes.push({id:d.id, headline:d.headline, kind:band.label, mins:m});
  }
  return {mins, causes};
}

/* ---- 12. TWO WAYS TO GET THERE ------------------------------
   The brief asks for an alternative shown against the original so
   the commuter can judge the trade-off. Two axes matter to real
   people and they genuinely conflict:

     simplest  — fewest times you have to get off a vehicle
     efficient — least total time, however many changes that takes

   Both are produced by the same graph search with different edge
   weights, so they are comparable by construction.
   ------------------------------------------------------------- */
const PLAN_SHAPES = {
  simple:{key:"simple", label:"Fewest transfers", blurb:"",
          weights:{transfer:3.0, crowd:4, rain:3, traffic:4, changeCost:11}},
  efficient:{key:"efficient", label:"Fastest", blurb:"",
          weights:{transfer:0.9, crowd:3, rain:2, traffic:3, changeCost:2.5}}
};

function planBoth(fromSt, toSt, departMin, basePrefs, opts){
  const prefs = basePrefs instanceof Set ? basePrefs : new Set(basePrefs||[]);
  const base = profileFor(prefs);
  const out = [];
  for(const shape of [PLAN_SHAPES.simple, PLAN_SHAPES.efficient]){
    /* The persona's own preferences still govern; the shape only
       moves the transfer/time trade-off around them. Step-free stays
       step-free in both. */
    const prof = {...base, ...shape.weights,
                  stepfree: base.stepfree,
                  label: base.stepfree ? shape.label+", step-free" : shape.label};
    const r = route(fromSt, toSt, departMin, prof, opts);
    if(r){ r.shape = shape.key; r.shapeLabel = shape.label; r.shapeBlurb = shape.blurb; out.push(r); }
  }
  /* On a well-connected metro the fewest-change route is very often
     also the quickest. When that happens, saying so is more useful
     than inventing a second option — so we collapse to one card and
     label it. Two cards only appear when there is a real trade-off. */
  if(out.length === 2 && sameRoute(out[0], out[1])){
    out[0].alsoFastest = true;
    out[0].shapeLabel = "Recommended";
    out[0].shapeBlurb = "";
    return [out[0]];
  }
  if(out.length === 2){
    const [simple, eff] = out;
    simple.deltaMins = Math.round(simple.total - eff.total);
    eff.deltaChanges = eff.changes - simple.changes;
    /* Present the quicker one first, but keep both: the trade-off is
       the point, and the commuter decides. */
    return simple.total <= eff.total ? [simple, eff] : [eff, simple];
  }
  return out;
}
function sameRoute(a, b){
  const sig = r => r.legs.filter(l=>l.kind==="ride").map(l=>l.mode+":"+l.line+":"+l.from+">"+l.to).join("|");
  return sig(a) === sig(b);
}

/* ---- 13. FUZZY PLACE SEARCH ---------------------------------
   Typeahead over stations, bus stops, landmarks and station codes.
   Subsequence matching, so "bkt pjg" finds Bukit Panjang and "ne17"
   finds Punggol. Ranked, capped, and it never returns everything.
   ------------------------------------------------------------- */
function subseqScore(needle, hay){
  let i = 0, run = 0, best = 0, first = -1;
  for(let j = 0; j < hay.length && i < needle.length; j++){
    if(hay[j] === needle[i]){
      if(first < 0) first = j;
      i++; run++; best = Math.max(best, run);
    } else run = 0;
  }
  if(i < needle.length) return -1;
  return best*3 - first*0.5 - (hay.length - needle.length)*0.12;
}

/* extraStops: live DataMall bus stops, [{code, description, road, lat, lon}] */
function suggestPlaces(query, extraStops, limit){
  limit = limit || 8;
  const q = norm(query);
  if(!q) return [];
  const rows = [];
  const seen = new Set();

  const add = (name, kind, meta, bonus) => {
    if(seen.has(kind+"|"+name)) return;
    const hay = norm(name);
    let sc = -1;
    if(hay.startsWith(q)) sc = 100 - hay.length*0.1;
    else if(hay.includes(q)) sc = 70 - hay.indexOf(q);
    else sc = subseqScore(q, hay);
    /* also match the station code: "ne17", "ew 24" */
    if(meta && meta.codes){
      for(const c of meta.codes){
        const cc = norm(c);
        if(cc === q) sc = Math.max(sc, 120);
        else if(cc.startsWith(q)) sc = Math.max(sc, 95);
      }
    }
    if(meta && meta.code && norm(meta.code).startsWith(q)) sc = Math.max(sc, 110);
    /* initials: "sgh" -> Singapore General Hospital, "cck" -> Choa Chu Kang */
    const initials = hay.split(/[\s-]+/).filter(Boolean).map(w => w[0]).join("");
    if(q.length >= 2 && initials === q) sc = Math.max(sc, 108);
    else if(q.length >= 3 && initials.startsWith(q)) sc = Math.max(sc, 88);
    if(sc < 0) return;
    seen.add(kind+"|"+name);
    rows.push({name, kind, score: sc + (bonus||0), ...meta});
  };

  for(const [k, v] of Object.entries(ALIAS)) if(norm(k).startsWith(q)) add(v, "station", {codes:CODES.get(v)||[], via:k}, 8);
  for(const p of PLACES){
    const isRail = STATIONS.has(p);
    add(p, isRail ? "station" : "busstop",
        {codes: CODES.get(p) || [], lines: [...(STATIONS.get(p)||[])]}, isRail ? 4 : 0);
  }
  for(const [n, L] of Object.entries(LANDMARKS)) add(n, "place", {kind2:L.kind}, 2);
  if(extraStops) for(const b of extraStops)
    add(b.description || b.road, "busstop", {code:b.code, road:b.road, lat:b.lat, lon:b.lon}, -6);

  rows.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return rows.slice(0, limit);
}

/* Exported for the test harness. build.js strips this line out when
   inlining the engine into the page, where it runs as a classic script. */
export {LINES,BUS_CORRIDORS,BUS_ONLY,FEED,PLACES,STATIONS,BUS_STOPS,CODES,CBD,STEPFREE_EXTRA,
  WEATHER_SNAPSHOT,PROFILES,GRAPH,route,routeIgnoringFeed,railHit,liftOut,parseIntent,
  profileFor,crowdScore,busLoad,roadFactor,rainAt,estimateFare,matchPlace,codeOf,
  COORD,LANDMARKS,pointOf,accessPoints,walkMinutes,haversine,
  CORRIDOR_ROADS,corridorsForRoad,busImpact,PLAN_SHAPES,planBoth,sameRoute,suggestPlaces,
  MinHeap,crowdDetail,setPlanDate,planDate,DAYCURVE,curveAt,
  CROWD_LIVE,CROWD_FORECAST,LEVEL_VALUE,ingestCrowdRealTime,ingestCrowdForecast,
  measuredCrowd,hasLiveCrowd};

/* ══════════════════════════════════════════════════════════════
   THE REAL BUS NETWORK

   Consumes data/bus-index.json as written by fetch-bus-data.mjs:

     stops        { code: {n, r, la, lo} }
     services     { serviceNo: {op, cat} }
     routes       { "service:direction": [stopCode, …] }   in order
     distances    { "service:direction": [km, …] }         cumulative
     stopServices { code: ["service:direction", …] }

   Until this loads, routing uses the twelve modelled corridors and the
   interface says "check the app for the service number". Once it loads,
   every bus leg names the service the commuter actually boards.

   Roughly 5,200 stops and 800 service-directions become ~30,000 graph
   nodes, which is why routing needs a real priority queue.
   ══════════════════════════════════════════════════════════════ */

const BUS_IDX = {
  loaded:false, stops:new Map(), services:new Map(),
  routes:new Map(), dists:new Map(), atStop:new Map(),
  grid:new Map(), edges:0, railJoins:0, builtMs:0, source:null,
  /* name -> [code]. Built with the rest of the index so a commuter can
     type "amber gardens" and be understood. Without it matchPlace only
     ever saw the 144 rail places, and every bus stop in Singapore was
     unreachable by name. */
  byName:new Map(), names:[]
};

/* Stop names are written for a pole, not a search box: "Opp Blk 157A",
   "Bef Jln Eunos", "Aft Braddell Rd". Strip the positional prefixes so
   the name the commuter knows is what matches. */
const STOP_PREFIX = /^(opp|opposite|bef|before|aft|after|bet|between|blk|block)\s+/i;
/* LTA writes stop names for a pole, not a search box: "Amber Gdns",
   "Marine Pde Stn", "Bt Batok Int". A commuter types "Amber Gardens".
   Both are normalised to the same key so either finds the stop. */
const ABBREV = {
  gdns:"gardens", gdn:"garden", pde:"parade", stn:"station", rd:"road",
  ave:"avenue", av:"avenue", st:"street", dr:"drive", cl:"close",
  cres:"crescent", ter:"terrace", pl:"place", lk:"link", wk:"walk",
  int:"interchange", ctr:"centre", cte:"centre", cplx:"complex",
  blk:"block", sch:"school", hosp:"hospital", pk:"park", mkt:"market",
  bt:"bukit", jln:"jalan", lor:"lorong", tg:"tanjong", kg:"kampong",
  upp:"upper", nth:"north", sth:"south", est:"estate", ind:"industrial",
  cmnty:"community", cc:"community club", pri:"primary", sec:"secondary",
  hts:"heights", gr:"grove", vw:"view", ri:"rise", ctrl:"central",
  mrt:"station", ns:"north south", ew:"east west"
};
function normStopName(s){
  return String(s||"").toLowerCase()
    .replace(/[^a-z0-9 ]+/g," ")
    .replace(/\s+/g," ").trim()
    .split(" ").map(w => ABBREV[w] || w).join(" ");
}
function rawStopName(s){
  return String(s||"").toLowerCase().replace(/[^a-z0-9 ]+/g," ")
    .replace(/\s+/g," ").trim();
}
function stopNameKeys(name){
  const full = normStopName(name);
  /* Both the expanded and the literal form. "Ter" is Terrace in a street
     name and Terminal at the airport; indexing both means neither
     reading loses. */
  const keys = new Set([full, rawStopName(name)]);
  let stripped = full;
  while(STOP_PREFIX.test(stripped)) stripped = stripped.replace(STOP_PREFIX,"").trim();
  if(stripped && stripped !== full) keys.add(stripped);
  /* "Marine Pde Stn Exit 2" should also answer to "marine pde stn" */
  const noExit = stripped.replace(/\s+exit\s+\w+$/,"").trim();
  if(noExit && noExit !== stripped) keys.add(noExit);
  return [...keys].filter(Boolean);
}

/* Best matching bus stop for a free-text name, or null. Exact first,
   then prefix, then containment — never a fuzzy guess, because sending
   someone to the wrong stop is worse than saying you do not know. */
function matchBusStop(query){
  if(!BUS_IDX.loaded) return null;
  const raw = normStopName(query);
  /* "opposite amber gardens" is a real, different stop from "amber
     gardens" — the other side of the road. Honour it when the pair
     exists rather than quietly sending them across the street. */
  const wantsOpp = /^(opp|opposite)\s+/.test(raw);
  const q = raw.replace(/^(opp|opposite)\s+/,"").trim();
  if(q.length < 3) return null;
  if(wantsOpp){
    const opp = BUS_IDX.byName.get("opp " + q) || BUS_IDX.byName.get("opposite " + q);
    if(opp && opp.length) return opp[0];
  }
  const hit = BUS_IDX.byName.get(q) || BUS_IDX.byName.get(raw);
  if(hit && hit.length) return hit[0];
  let best=null, bestLen=Infinity;
  for(const [name, codes] of BUS_IDX.byName){
    if(name.length >= bestLen) continue;
    if(name.startsWith(q) || q.startsWith(name) || name.includes(q)){
      best = codes[0]; bestLen = name.length;
    }
  }
  return best;
}
function searchBusStops(query, limit){
  if(!BUS_IDX.loaded) return [];
  const q = normStopName(query);
  if(q.length < 2) return [];
  const out=[];
  for(const [name, codes] of BUS_IDX.byName){
    if(name.startsWith(q)) out.push({code:codes[0], name, score:0});
    else if(name.includes(q)) out.push({code:codes[0], name, score:1});
    if(out.length > 400) break;
  }
  out.sort((a,b)=>a.score-b.score || a.name.length-b.name.length);
  return out.slice(0, limit||8);
}

/* ---- spatial index ------------------------------------------
   A flat grid. Singapore is 50 km across and we only ever ask for
   small radii, so this beats anything cleverer. ~0.0018° ≈ 200 m. */
const BCELL = 0.0018;
function gridPut(code, la, lo){
  const k = Math.round(la/BCELL)+":"+Math.round(lo/BCELL);
  if(!BUS_IDX.grid.has(k)) BUS_IDX.grid.set(k,[]);
  BUS_IDX.grid.get(k).push(code);
}
/* Every stop within `radius` metres of a point, nearest first. */
function stopsNear(la, lo, radius){
  const span = Math.ceil(radius/(BCELL*111000));
  const cy = Math.round(la/BCELL), cx = Math.round(lo/BCELL);
  const out = [];
  for(let dy=-span; dy<=span; dy++) for(let dx=-span; dx<=span; dx++){
    const bucket = BUS_IDX.grid.get((cy+dy)+":"+(cx+dx));
    if(!bucket) continue;
    for(const code of bucket){
      const s = BUS_IDX.stops.get(code);
      if(!s) continue;
      const m = haversine([la,lo],[s.la,s.lo]);
      if(m!=null && m<=radius) out.push({code, metres:m, stop:s});
    }
  }
  return out.sort((a,b)=>a.metres-b.metres);
}

/* ---- identity ------------------------------------------------
   A stop is addressed by its five-digit code. Descriptions repeat all
   over the island — there are dozens of stops called "Blk 123". */
const isBusStop   = x => BUS_IDX.loaded && BUS_IDX.stops.has(String(x));
const busStop     = x => BUS_IDX.stops.get(String(x)) || null;
const busStopName = x => { const s = busStop(x); return s ? s.n : String(x); };
const busStopLabel= x => { const s = busStop(x); return s ? `${s.n} (${x})` : String(x); };
const busStopRoad = x => { const s = busStop(x); return s ? s.r : ""; };
const serviceNo   = key => String(key).split(":")[0];

/* Which services call at a stop. Indexed on load, so this is a lookup
   rather than a scan of 26,000 route rows. */
function servicesAt(code){
  const set = BUS_IDX.atStop.get(String(code));
  return set ? [...set].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})) : [];
}

/* The question the brief actually poses: given two stops, which single
   service joins them, boarding at A and alighting at B, in that order?
   Backs both the route renderer and the /api/bus endpoint. */
function servicesBetween(fromCode, toCode){
  const a = String(fromCode), b = String(toCode);
  const out = [];
  for(const key of (BUS_IDX.atStop.get(a) ? routesThrough(a) : [])){
    const seq = BUS_IDX.routes.get(key);
    if(!seq) continue;
    const i = seq.indexOf(a);
    if(i < 0) continue;
    const j = seq.indexOf(b, i+1);          // must come AFTER boarding
    if(j < 0) continue;
    const d = BUS_IDX.dists.get(key);
    out.push({
      service: serviceNo(key), direction: Number(key.split(":")[1]),
      stops: j - i,
      km: d ? Math.round((d[j]-d[i])*10)/10 : null,
      operator: (BUS_IDX.services.get(serviceNo(key))||{}).op || null
    });
  }
  return out.sort((x,y)=>x.stops-y.stops);
}
/* service-directions calling at a stop, as keys */
function routesThrough(code){
  const svcs = BUS_IDX.atStop.get(String(code));
  if(!svcs) return [];
  const keys = [];
  for(const key of BUS_IDX.routes.keys())
    if(svcs.has(serviceNo(key)) && BUS_IDX.routes.get(key).includes(String(code))) keys.push(key);
  return keys;
}

/* ---- loading -------------------------------------------------- */
function loadBusIndex(data, opts){
  opts = opts || {};
  const t0 = (typeof performance!=="undefined" ? performance.now() : Date.now());

  BUS_IDX.stops.clear(); BUS_IDX.services.clear(); BUS_IDX.routes.clear();
  BUS_IDX.dists.clear(); BUS_IDX.atStop.clear(); BUS_IDX.grid.clear();
  BUS_IDX.edges = 0; BUS_IDX.railJoins = 0;

  let dropped = 0;
  for(const [code, s] of Object.entries(data.stops||{})){
    const la = Number(s.la), lo = Number(s.lo);
    // A few rows carry 0,0. Dropping them beats plotting the Gulf of Guinea.
    if(!isFinite(la) || !isFinite(lo) || (la===0 && lo===0)){ dropped++; continue; }
    BUS_IDX.stops.set(code, {n:s.n||code, r:s.r||"", la, lo});
    for(const k of stopNameKeys(s.n||code)){
      if(!BUS_IDX.byName.has(k)) BUS_IDX.byName.set(k, []);
      BUS_IDX.byName.get(k).push(code);
    }
    gridPut(code, la, lo);
  }
  for(const [no, meta] of Object.entries(data.services||{})) BUS_IDX.services.set(no, meta);
  for(const [key, seq] of Object.entries(data.routes||{}))
    if(Array.isArray(seq) && seq.length>1) BUS_IDX.routes.set(key, seq.map(String));
  for(const [key, d] of Object.entries(data.distances||{})) BUS_IDX.dists.set(key, d);

  /* stopServices in the file is stop -> ["svc:dir"]. We want the plain
     service numbers for display, and keep the keys for routing. */
  for(const [code, keys] of Object.entries(data.stopServices||{})){
    if(!BUS_IDX.stops.has(code)) continue;
    BUS_IDX.atStop.set(code, new Set(keys.map(serviceNo)));
  }

  BUS_IDX.dropped = dropped;
  BUS_IDX.source = data.source || "LTA DataMall";
  BUS_IDX.generated = data.generated || null;

  buildBusGraph(opts);

  BUS_IDX.loaded = BUS_IDX.stops.size > 0 && BUS_IDX.routes.size > 0;
  BUS_IDX.builtMs = Math.round((typeof performance!=="undefined" ? performance.now() : Date.now()) - t0);
  return {
    stops:BUS_IDX.stops.size,
    services:new Set([...BUS_IDX.routes.keys()].map(serviceNo)).size,
    directions:BUS_IDX.routes.size,
    edges:BUS_IDX.edges, railJoins:BUS_IDX.railJoins, ms:BUS_IDX.builtMs, dropped
  };
}

/* node ids. `route()` splits on the first "|" to get the place, so the
   stop code must sit on the right of it in both forms. */
const stopNode = code        => "S|" + code;
const rideNode = (key, code) => "V:" + key + "|" + code;

/* Speed is not a constant. A 400 m hop between two kerbside stops is
   dominated by dwell and traffic lights; a 12 km run down the PIE on an
   express service is not. A flat figure made express services absurd —
   service 646 came out at 108 minutes for three stops.

   So speed rises with hop length and flattens out: about 19 km/h for a
   short urban hop, rising towards 50 km/h on a long expressway leg. The
   road factor in route() then moves the whole thing with time of day. */
function busKmh(km){ return 15 + 40*(km/(km+4)); }

function buildBusGraph(opts){
  const add = (a,b,w,meta) => { link(a,b,w,meta); BUS_IDX.edges++; };

  /* 1. Riding between consecutive stops on one service-direction. */
  for(const [key, seq] of BUS_IDX.routes){
    const d = BUS_IDX.dists.get(key);
    for(let i=0; i<seq.length-1; i++){
      const a = seq[i], b = seq[i+1];
      if(!BUS_IDX.stops.has(a) || !BUS_IDX.stops.has(b)) continue;
      let km = (d && isFinite(d[i]) && isFinite(d[i+1])) ? Math.max(0, d[i+1]-d[i]) : 0;
      if(!km){
        const A = BUS_IDX.stops.get(a), B = BUS_IDX.stops.get(b);
        km = (haversine([A.la,A.lo],[B.la,B.lo])||400)/1000 * 1.25;  // roads are not straight
      }
      add(rideNode(key,a), rideNode(key,b), Math.max(0.6, km*(60/busKmh(km))),
          {kind:"ride", mode:"bus", line:key, real:true});
    }
    /* 2. Boarding and alighting. The wait on boarding is what stops the
          router hopping between services to shave a minute. The service
          key travels on the edge so the router can look up its published
          headway and its operating hours at the time of travel. */
    for(const code of seq){
      if(!BUS_IDX.stops.has(code)) continue;
      add(stopNode(code), rideNode(key,code), 0,
          {kind:"board",  mode:"bus", line:key, at:code});
      add(rideNode(key,code), stopNode(code), 0.5,
          {kind:"alight", mode:"bus", line:key, at:code});
    }
  }

  /* 3. Walking between nearby stops, so a change can cross a road.
        Capped at 180 m and six neighbours: past that it is edges nobody
        would walk and a slower search. */
  const NEAR = opts.stopWalkRadius ?? 180;
  for(const [code, s] of BUS_IDX.stops){
    const near = stopsNear(s.la, s.lo, NEAR).filter(n=>n.code!==code).slice(0,6);
    for(const n of near)
      add(stopNode(code), stopNode(n.code), Math.max(1, (n.metres/80)),
          {kind:"transfer", mode:"bus", at:n.code, from:"bus", toMode:"bus", line:"WALKSTOP"});
  }

  /* 4. Joining bus to rail. COORD already holds real station positions,
        so this is a distance join rather than a name guess. */
  const RAIL_R = opts.railRadius ?? 350;
  for(const [station, c] of Object.entries(COORD)){
    if(!STATIONS.has(station)) continue;
    for(const n of stopsNear(c[0], c[1], RAIL_R).slice(0,5)){
      const mins = Math.max(2, n.metres/80 + 1);     // +1 to get out of the concourse
      for(const k of STATIONS.get(station)){
        add(nid(k,station), stopNode(n.code), mins,
            {kind:"transfer", mode:"bus",  at:n.code,  from:"rail", toMode:"bus",  line:"TOBUS"});
        add(stopNode(n.code), nid(k,station), mins,
            {kind:"transfer", mode:"rail", at:station, from:"bus",  toMode:"rail", line:k});
      }
      BUS_IDX.railJoins++;
    }
  }
}

/* ---- waiting, and whether the bus is running at all ------------
   Two questions the published data answers and a model cannot. */

const dayTypeOf = d => { const x=(d||new Date()).getDay(); return x===0?"sun":x===6?"sat":"wd"; };

/* Which of the four published bands applies at this time. */
function bandFor(freq, minutes){
  if(!freq) return null;
  const h = Math.floor(minutes/60)%24;
  if(h>=6  && h<9)  return freq.amPeak || freq.amOff;
  if(h>=17 && h<20) return freq.pmPeak || freq.pmOff;
  if(h<12)          return freq.amOff  || freq.amPeak;
  return freq.pmOff || freq.pmPeak || freq.amOff;
}

/* Expected wait for a passenger turning up at random is about half the
   headway. BusServices publishes the headway as a band, so use it; the
   modelled figure is only a fallback for services with no band, and the
   interface says which one it used. */
function busWait(key, minutes, dayType){
  const meta = BUS_IDX.services.get(String(key));
  const band = bandFor(meta && meta.freq, minutes);
  if(band){
    const mid = (band[0] + band[1]) / 2;
    return { mins: Math.max(1.5, mid/2), source: "published", band };
  }
  const h = Math.floor(minutes/60)%24;
  const mins = (h>=7&&h<10) ? 4 : (h>=17&&h<20) ? 4.5 : (h>=23||h<6) ? 12 : 7;
  return { mins, source: "modelled", band: null };
}
/* The router only wants the number. */
const busWaitMins = (key, minutes) => busWait(key, minutes).mins;

/* Is this service running at this time, on this kind of day?

   Routing someone onto a bus that stopped at 23:20 is worse than
   offering no bus at all, and it is the single most common way a
   transit app loses a user's trust. Services with no published hours
   are assumed to run — we do not invent a restriction either. */
function serviceRunning(key, minutes, dayType){
  const meta = BUS_IDX.services.get(String(key));
  const hours = meta && meta.hours && meta.hours[dayType || BUS_IDX.dayType || "wd"];
  if(!hours) return true;
  const [first, last] = hours;
  if(first == null || last == null) return true;
  const t = ((minutes % 1440) + 1440) % 1440;
  /* A last bus after midnight wraps: 0530–0015 is a normal span. */
  return last >= first ? (t >= first && t <= last) : (t >= first || t <= last);
}

/* ══════════════════════════════════════════════════════════════
   EVENT-AWARE CROWDING

   Three sources of truth about how busy a station will be, in strict
   order of precedence:

     1. PCDRealTime   — measured, now
     2. PCDForecast   — measured pattern, per 30 minutes, for today
     3. this module   — a prior: the daily curve, adjusted for events

   The model NEVER overrides a measurement. It exists for the case the
   measurements cannot cover: a journey planned for next Friday evening,
   or a station whose CrowdLevel comes back NA.

   Events come from data/events.json, which is a curated file rather than
   a feed — there is no official event-crowding API, and pretending
   otherwise would be fabrication. Events whose date follows a lunar or
   Islamic calendar ship with `dates: null` and are NOT applied until
   someone fills the date in. The Sources tab says how many are waiting.
   ══════════════════════════════════════════════════════════════ */

const EVENTS = {
  loaded: false, all: [], dated: [], undated: [], version: null, error: null
};

function loadEvents(data){
  EVENTS.all = []; EVENTS.dated = []; EVENTS.undated = [];
  const list = (data && data.events) || [];
  for(const e of list){
    const dates = Array.isArray(e.dates) ? e.dates.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)) : [];
    const rec = {
      id:e.id, name:e.name, kind:e.kind||"fixed",
      dates, window:Array.isArray(e.window)?e.window:[0,24],
      places:new Set(e.places||[]),
      lift:Math.max(1, Math.min(2.5, Number(e.lift)||1)),
      roadClosures:!!e.roadClosures, alsoQuieter:!!e.alsoQuieter,
      basis:e.basis||"", advice:e.advice||"", dateHint:e.dateHint||""
    };
    EVENTS.all.push(rec);
    (dates.length ? EVENTS.dated : EVENTS.undated).push(rec);
  }
  EVENTS.version = (data && data.version) || null;
  EVENTS.loaded = true;
  return {events:EVENTS.all.length, dated:EVENTS.dated.length, undated:EVENTS.undated.length};
}

/* The calendar is Singapore's, so the date must be Singapore's. Using
   the device's own timezone would put a judge in London on the wrong
   day for an evening event, and would break the tests on a UTC box. */
const SG_FMT = (typeof Intl!=="undefined" && Intl.DateTimeFormat)
  ? new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Singapore",
      year:"numeric",month:"2-digit",day:"2-digit"})
  : null;
const isoDate = d => {
  const date = d || new Date();
  if(SG_FMT) return SG_FMT.format(date);            // en-CA formats as YYYY-MM-DD
  const p = n => String(n).padStart(2,"0");
  return date.getFullYear()+"-"+p(date.getMonth()+1)+"-"+p(date.getDate());
};

/* Does the event's time window cover this clock time? A window may run
   past midnight — a countdown is [20, 26], meaning 20:00 to 02:00. */
function inWindow(ev, minutes){
  const h = (minutes/60);
  const [a,b] = ev.window;
  if(b <= 24) return h >= a && h < b;
  return h >= a || h < (b - 24);
}

/* Events in effect at a given date and time. `when` is a Date for the
   day; `minutes` is the clock time being planned for. */
function eventsAt(when, minutes){
  if(!EVENTS.loaded) return [];
  const day = isoDate(when || new Date());
  /* A window running past midnight belongs to the previous day too. */
  const prev = new Date((when||new Date()).getTime() - 86400000);
  const prevDay = isoDate(prev);
  return EVENTS.dated.filter(ev => {
    if(ev.dates.includes(day) && inWindow(ev, minutes)) return true;
    if(ev.dates.includes(prevDay) && ev.window[1] > 24 && (minutes/60) < ev.window[1]-24) return true;
    return false;
  });
}

/* The multiplier to apply at one place, and why. Returns 1 and an empty
   list when nothing applies, which is the normal case. */
function eventLift(place, when, minutes){
  const active = eventsAt(when, minutes).filter(ev => ev.places.has(place));
  if(!active.length) return {lift:1, events:[]};
  /* Two events at the same place do not multiply — the crowd is not
     twice as crowded because two things are on. Take the strongest. */
  const lift = Math.max(...active.map(e => e.lift));
  return {lift, events:active};
}

/* Everything on today, for the interface to tell the commuter about
   before they ask. */
function eventsToday(when){
  if(!EVENTS.loaded) return [];
  const day = isoDate(when || new Date());
  return EVENTS.dated.filter(ev => ev.dates.includes(day));
}

/* Which events touch a planned journey, so the advice is specific to
   this commuter rather than a general notice. */
function eventsOnPlan(plan, when){
  if(!plan || !EVENTS.loaded) return [];
  const hit = new Map();
  for(const leg of plan.legs){
    if(leg.kind !== "ride" || !Array.isArray(leg.stops)) continue;
    for(const stop of leg.stops){
      const place = (typeof isBusStop==="function" && isBusStop(stop)) ? null : stop;
      if(!place) continue;
      for(const ev of eventLift(place, when, leg.start).events)
        if(!hit.has(ev.id)) hit.set(ev.id, {event:ev, at:place, when:leg.start});
    }
  }
  return [...hit.values()];
}

/* Road closures are the half of an event that hurts buses rather than
   trains, and the router should know before it picks a bus. */
function eventClosesRoads(when, minutes){
  return eventsAt(when, minutes).some(ev => ev.roadClosures);
}

export {BUS_IDX, loadBusIndex, isBusStop, busStop, busStopName, busStopLabel,
  matchBusStop, searchBusStops, normStopName,
        busStopRoad, servicesAt, servicesBetween, stopsNear, serviceNo,
        busWait, busWaitMins, serviceRunning, bandFor, dayTypeOf,
        EVENTS, loadEvents, eventsAt, eventLift, eventsToday, eventsOnPlan,
        eventClosesRoads};
