/* Capability probe.
   The front end calls this once on load and switches from its
   embedded snapshot to whichever live sources are actually
   configured. It reports per-source, because "live" is not one
   thing — weather can be live while DataMall is not. */
export default async () => {
  const hasLTA = Boolean(process.env.LTA_ACCOUNT_KEY);
  return Response.json({
    ok: true,
    at: new Date().toISOString(),
    capabilities: {
      alerts:   hasLTA,   // TrainServiceAlerts
      crowd:    hasLTA,   // PCDRealTime + PCDForecast
      bus:      hasLTA,   // BusArrival, BusStops, BusRoutes
      lifts:    hasLTA,   // v2/FacilitiesMaintenance
      roads:    hasLTA,   // TrafficIncidents, RoadWorks, TrafficSpeedBands
      weather:  true,     // data.gov.sg is open, no key
      chat:     Boolean(process.env.ANTHROPIC_API_KEY)
    }
  }, { headers: { "cache-control": "no-store" } });
};
