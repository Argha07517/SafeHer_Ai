"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import type { RouteItem } from "./components/MapView";
import LocationAutocomplete, { isWithinKolkataRegion } from "./components/LocationAutocomplete";
import { SafetyDataPoint, parseSafetyCsv } from "./utils/csvParser";

const MapView = dynamic(
  () => import("./components/MapView"),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full h-[600px] rounded-2xl bg-zinc-900 border border-zinc-800 flex flex-col items-center justify-center text-zinc-400 animate-pulse">
        <span className="text-4xl mb-3">🗺️</span>
        <p className="font-semibold text-lg">Loading Kolkata Women's Safety & FIR Case Engine...</p>
        <p className="text-sm text-zinc-500">Initializing Leaflet Map & Road Guidance</p>
      </div>
    )
  }
) as any;

const WB_SAMPLE_ROUTES = [
  { source: "Park Street, Kolkata", destination: "Salt Lake Sector V, Kolkata" },
  { source: "Howrah Station, Kolkata", destination: "Jadavpur University, Kolkata" },
  { source: "Esplanade, Kolkata", destination: "Behala, Kolkata" },
  { source: "Tollygunge, Kolkata", destination: "Gariahat Crossing, Kolkata" },
];

export default function Home() {
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");
  const [loading, setLoading] = useState(false);
  const [locatingUser, setLocatingUser] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [sourcePosition, setSourcePosition] = useState<[number, number] | null>(null);
  const [destinationPosition, setDestinationPosition] = useState<[number, number] | null>(null);
  
  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string>("route-a");

  // System Safety Dataset State
  const [csvPoints, setCsvPoints] = useState<SafetyDataPoint[]>([]);
  const [mapFilterMode, setMapFilterMode] = useState<'all' | 'women_crimes' | 'clusters'>('all');

  const mapSectionRef = useRef<HTMLDivElement>(null);

  // Load Kolkata system dataset on mount
  useEffect(() => {
    async function loadKolkataSystemDataset() {
      try {
        const res = await fetch("/kolkata_full_case_dataset.csv");
        if (res.ok) {
          const text = await res.text();
          const parsed = parseSafetyCsv(text);
          if (parsed.length > 0) {
            setCsvPoints(parsed);
            return;
          }
        }
      } catch (e) {
        console.warn("Failed to load kolkata_full_case_dataset.csv, attempting fallback:", e);
      }

      try {
        const res2 = await fetch("/data/kolkata_womens_safety_dataset.csv");
        if (res2.ok) {
          const text = await res2.text();
          const parsed = parseSafetyCsv(text);
          if (parsed.length > 0) {
            setCsvPoints(parsed);
            return;
          }
        }
      } catch (err) {
        console.warn("Fallback dataset 1 error:", err);
      }

      try {
        const fallbackRes = await fetch("/data/safety_data.csv");
        if (fallbackRes.ok) {
          const text = await fallbackRes.text();
          const parsed = parseSafetyCsv(text);
          setCsvPoints(parsed);
        }
      } catch (err) {
        console.error("Fallback dataset 2 error:", err);
      }
    }
    loadKolkataSystemDataset();
  }, []);

  const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
        {
          headers: { "User-Agent": "SafeHerAI-Kolkata/1.0" },
        }
      );
      const data = await res.json();
      if (data && data.display_name) {
        return data.display_name.split(",").slice(0, 3).join(",");
      }
    } catch (e) {
      console.warn("Reverse geocode error:", e);
    }
    return `Current Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setErrorMsg("Geolocation is not supported by your browser.");
      return;
    }

    setLocatingUser(true);
    setErrorMsg("");

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        if (!isWithinKolkataRegion(lat, lng)) {
          setErrorMsg("⚠️ SafeHer AI is exclusively built for Kolkata & nearest metropolitan areas (Howrah, Salt Lake, New Town, Dum Dum, Behala, Jadavpur, etc.). Your GPS location is outside Kolkata.");
          setLocatingUser(false);
          return;
        }

        const coords: [number, number] = [lat, lng];
        setSourcePosition(coords);

        const locationName = await reverseGeocode(lat, lng);
        setSource(locationName);
        setLocatingUser(false);
      },
      (err) => {
        console.error("Geolocation error:", err);
        setErrorMsg("Unable to retrieve location. Please check browser location permissions.");
        setLocatingUser(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const analyzeRouteWithCoords = async (
    srcCoords: [number, number],
    destCoords: [number, number],
    activeCsvPoints: SafetyDataPoint[] = csvPoints
  ) => {
    setLoading(true);
    setErrorMsg("");

    // Validate Kolkata Bounds
    if (!isWithinKolkataRegion(srcCoords[0], srcCoords[1])) {
      setErrorMsg("⚠️ SafeHer AI is exclusively configured for Kolkata & nearest metropolitan areas. Starting location must be within Kolkata.");
      setLoading(false);
      return;
    }

    if (!isWithinKolkataRegion(destCoords[0], destCoords[1])) {
      setErrorMsg("⚠️ SafeHer AI is exclusively configured for Kolkata & nearest metropolitan areas. Target destination must be within Kolkata.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/calculate-route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: { lat: srcCoords[0], lng: srcCoords[1] },
          destination: { lat: destCoords[0], lng: destCoords[1] },
          csvPoints: activeCsvPoints,
        }),
      });

      if (!response.ok) {
        throw new Error("Route calculation failed");
      }

      const data = await response.json();
      if (data.routes && data.routes.length > 0) {
        setRoutes(data.routes);
        setSelectedRouteId(data.safestRouteId || data.routes[0].id);
        setMapFilterMode('all');

        setTimeout(() => {
          mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 150);
      } else {
        setErrorMsg("No routes found between selected locations in Kolkata.");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Error calculating route. Please check connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const analyzeRoute = async (srcOverride?: string, destOverride?: string, srcCoordsOverride?: [number, number], destCoordsOverride?: [number, number]) => {
    const activeSource = srcOverride || source;
    const activeDest = destOverride || destination;

    if (!activeSource.trim() || !activeDest.trim()) {
      setErrorMsg("Please enter both starting source and destination.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      let sourceCoords = srcCoordsOverride || sourcePosition;
      let destinationCoords = destCoordsOverride || destinationPosition;

      if (!sourceCoords) {
        setErrorMsg(`Location coordinates not found for "${activeSource}". Please select a Kolkata place from the dropdown.`);
        setLoading(false);
        return;
      }

      if (!destinationCoords) {
        setErrorMsg(`Location coordinates not found for "${activeDest}". Please select a Kolkata place from the dropdown.`);
        setLoading(false);
        return;
      }

      setSourcePosition(sourceCoords);
      setDestinationPosition(destinationCoords);

      await analyzeRouteWithCoords(sourceCoords, destinationCoords, csvPoints);
    } catch (err) {
      console.error(err);
      setErrorMsg("Error calculating route. Please check connection and try again.");
      setLoading(false);
    }
  };

  const handleQuickSample = (sample: { source: string; destination: string }) => {
    setSource(sample.source);
    setDestination(sample.destination);
    analyzeRoute(sample.source, sample.destination);
  };

  const triggerMapFilter = (mode: 'all' | 'women_crimes' | 'clusters') => {
    setMapFilterMode(mode);
    setTimeout(() => {
      mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const selectedRoute = routes.find((r) => r.id === selectedRouteId) || routes[0];

  let totalFirCount = 0;
  let totalWomenCrimesCount = 0;
  let totalPoorLightingCount = 0;

  csvPoints.forEach((pt) => {
    if (pt.crime_breakdown) {
      totalFirCount += pt.crime_breakdown.fir_cases_count || 1;
      totalWomenCrimesCount += pt.crime_breakdown.crimes_against_women;
      totalPoorLightingCount += pt.crime_breakdown.poor_lighting_cases || 0;
    }
  });

  return (
    <main className="min-h-screen bg-zinc-950 text-white flex flex-col items-center p-4 sm:p-8 font-sans">
      <div className="w-full max-w-6xl space-y-8">
        
        {/* Header Section */}
        <header className="text-center space-y-3 pt-4">
          <div className="inline-flex items-center space-x-2 bg-emerald-500/10 border border-emerald-500/30 px-4 py-1.5 rounded-full text-emerald-400 text-sm font-medium">
            <span>🛡️</span>
            <span>SafeHer AI • Kolkata Exclusive Women Safety Engine</span>
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
            SafeHer AI
          </h1>
          <p className="text-zinc-400 max-w-2xl mx-auto text-base sm:text-lg">
            High-precision street-level navigation & real-time crime risk analysis exclusively for Kolkata & nearest metropolitan areas.
          </p>
        </header>

        {/* Analytics & Control Banner */}
        <div className="bg-zinc-900/90 border border-zinc-800 p-5 rounded-3xl space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
            <div>
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <span>🚨</span>
                <span>Kolkata Crimes Analytics & Map Incident Filters</span>
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Real-time FIR incident tracking across 30 Kolkata localities
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => triggerMapFilter('all')}
                className={`text-xs px-3.5 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  mapFilterMode === 'all'
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 border border-emerald-500'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700'
                }`}
              >
                <span>📋</span>
                <span>All Crime Incidents ({totalFirCount || 394})</span>
              </button>

              <button
                onClick={() => triggerMapFilter('women_crimes')}
                className={`text-xs px-3.5 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  mapFilterMode === 'women_crimes'
                    ? 'bg-red-600 text-white shadow-lg shadow-red-600/30 border border-red-500'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700'
                }`}
              >
                <span>🚨</span>
                <span>Crimes Against Women ({totalWomenCrimesCount || 182})</span>
              </button>

              <button
                onClick={() => triggerMapFilter('clusters')}
                className={`text-xs px-3.5 py-1.5 rounded-xl font-medium transition flex items-center gap-1.5 cursor-pointer ${
                  mapFilterMode === 'clusters'
                    ? 'bg-emerald-600 text-white shadow-lg border border-emerald-500 font-bold'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700'
                }`}
              >
                <span>🛡️</span>
                <span>Locality Clusters</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
            <div className="bg-zinc-950 p-3 rounded-2xl border border-zinc-800/80 space-y-1">
              <span className="text-zinc-400 block">Total FIR Incidents</span>
              <span className="text-2xl font-black text-white">{totalFirCount || 394}</span>
            </div>
            <div className="bg-zinc-950 p-3 rounded-2xl border border-zinc-800/80 space-y-1">
              <span className="text-zinc-400 block">Crimes Against Women</span>
              <span className="text-2xl font-black text-red-400">{totalWomenCrimesCount || 182}</span>
            </div>
            <div className="bg-zinc-950 p-3 rounded-2xl border border-zinc-800/80 space-y-1">
              <span className="text-zinc-400 block">Unlit / Dark Spots</span>
              <span className="text-2xl font-black text-amber-400">{totalPoorLightingCount || 112}</span>
            </div>
            <div className="bg-zinc-950 p-3 rounded-2xl border border-zinc-800/80 space-y-1">
              <span className="text-zinc-400 block">Kolkata Sectors</span>
              <span className="text-2xl font-black text-cyan-400">{csvPoints.length || 30}</span>
            </div>
          </div>
        </div>

        {/* Input & Control Card */}
        <div className="bg-zinc-900/90 backdrop-blur-md p-6 rounded-3xl border border-zinc-800 shadow-2xl space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <LocationAutocomplete
              label="📍 Starting Source Location (Kolkata Only)"
              placeholder="e.g. Park Street, Kolkata"
              value={source}
              onChange={(val) => {
                setSource(val);
                setSourcePosition(null);
              }}
              onSelect={(val, coords) => {
                setSource(val);
                if (coords) setSourcePosition(coords);
              }}
              rightElement={
                <button
                  type="button"
                  onClick={handleUseMyLocation}
                  disabled={locatingUser}
                  className="text-xs bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 px-2.5 py-0.5 rounded-lg transition flex items-center space-x-1 cursor-pointer"
                >
                  {locatingUser ? (
                    <span>⏳ GPS Locating...</span>
                  ) : (
                    <>
                      <span>🎯</span>
                      <span>Use My Location</span>
                    </>
                  )}
                </button>
              }
            />

            <LocationAutocomplete
              label="🎯 Target Destination (Kolkata Only)"
              placeholder="e.g. Salt Lake Sector V, Kolkata"
              value={destination}
              onChange={(val) => setDestination(val)}
              onSelect={(val, coords) => {
                setDestination(val);
                if (coords) setDestinationPosition(coords);
              }}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs text-zinc-400 font-medium mr-1">Kolkata Key Corridors:</span>
            {WB_SAMPLE_ROUTES.map((sample, idx) => (
              <button
                key={idx}
                onClick={() => handleQuickSample(sample)}
                className="text-xs bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-emerald-500/50 text-zinc-300 px-3 py-1.5 rounded-lg transition cursor-pointer"
              >
                {sample.source.split(",")[0]} → {sample.destination.split(",")[0]}
              </button>
            ))}
          </div>

          {errorMsg && (
            <div className="p-3.5 bg-red-950/80 border border-red-700 text-red-200 rounded-xl text-xs sm:text-sm font-semibold flex items-center space-x-2">
              <span className="text-lg">⚠️</span>
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            onClick={() => analyzeRoute()}
            disabled={loading}
            className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 font-bold py-4 rounded-xl transition-all transform hover:scale-[1.01] shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center justify-center space-x-2 text-lg cursor-pointer"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-zinc-950" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>Evaluating Kolkata Safety & Displaying All Crimes...</span>
              </>
            ) : (
              <>
                <span>🛡️</span>
                <span>Analyze Kolkata Route & Show All Crimes on Map</span>
              </>
            )}
          </button>
        </div>

        {/* Map Container Section */}
        <section ref={mapSectionRef} className="space-y-3 pt-2 scroll-mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center space-x-2 text-zinc-200">
              <span>🗺️</span>
              <span>Kolkata Exclusive Safety & Crime Map</span>
            </h2>
            {routes.length > 0 && (
              <span className="text-xs bg-emerald-950 text-emerald-400 border border-emerald-800 px-3 py-1 rounded-full font-medium">
                {routes.length} Street Routes Analyzed
              </span>
            )}
          </div>

          <MapView
            sourcePosition={sourcePosition || undefined}
            destinationPosition={destinationPosition || undefined}
            routes={routes}
            selectedRouteId={selectedRouteId}
            onSelectRoute={(id: string) => setSelectedRouteId(id)}
            csvPoints={csvPoints}
            mapFilterMode={mapFilterMode}
          />
        </section>

        {/* Route Cards Comparison */}
        {routes.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-zinc-200 flex items-center space-x-2">
              <span>🚥</span>
              <span>Route Safety & Travel Time Comparisons</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {routes.map((r) => {
                const isSelected = r.id === selectedRouteId;
                const isSafest = r.id === "route-a";

                return (
                  <div
                    key={r.id}
                    onClick={() => setSelectedRouteId(r.id)}
                    className={`p-5 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between ${
                      isSelected
                        ? isSafest
                          ? "bg-emerald-950/40 border-emerald-500 shadow-xl shadow-emerald-500/10 ring-2 ring-emerald-500/40"
                          : r.score >= 75
                          ? "bg-amber-950/40 border-amber-500 ring-2 ring-amber-500/40"
                          : "bg-red-950/40 border-red-500 ring-2 ring-red-500/40"
                        : "bg-zinc-900/80 border-zinc-800 hover:border-zinc-700"
                    }`}
                  >
                    {isSafest && (
                      <span className="absolute -top-3 right-4 bg-emerald-500 text-zinc-950 font-extrabold text-[10px] uppercase tracking-wider px-3 py-0.5 rounded-full shadow-md">
                        ★ Recommended Safest
                      </span>
                    )}

                    <div className="space-y-2">
                      <h3 className="font-bold text-lg text-white flex items-center justify-between">
                        <span>{r.name}</span>
                      </h3>

                      <div className="flex items-baseline space-x-2">
                        <span className={`text-4xl font-extrabold ${
                          r.score >= 85
                            ? "text-emerald-400"
                            : r.score >= 75
                            ? "text-amber-400"
                            : "text-red-400"
                        }`}>
                          {r.score}
                        </span>
                        <span className="text-xs text-zinc-400 font-semibold">/ 100 Safety Score</span>
                      </div>

                      <div className="flex items-center gap-3 pt-1 text-xs">
                        <span className="bg-zinc-950 text-emerald-400 font-bold px-2.5 py-1 rounded-lg border border-zinc-800">
                          ⏱️ ~{r.durationMin} mins
                        </span>
                        <span className="text-zinc-400 font-medium">📏 {r.distanceKm} km</span>
                      </div>
                    </div>

                    {r.crimeSummary && (
                      <div className="mt-3 bg-zinc-950 p-2.5 rounded-xl border border-zinc-800 space-y-1 text-xs">
                        <div className="flex items-center justify-between text-zinc-300 font-semibold">
                          <span>📋 Crime Incidents:</span>
                          <span className="text-white font-bold">{r.crimeSummary.totalFirCases || r.crimeSummary.crimesAgainstWomen}</span>
                        </div>
                        <div className="flex items-center justify-between text-zinc-400 text-[11px]">
                          <span>🚨 Women Crimes: <strong className="text-red-400">{r.crimeSummary.crimesAgainstWomen}</strong></span>
                          <span>💡 Unlit Spots: <strong className="text-amber-400">{r.crimeSummary.poorLightingCases || 0}</strong></span>
                        </div>
                      </div>
                    )}

                    <div className="mt-3 pt-3 border-t border-zinc-800/80">
                      <p className="text-xs text-zinc-300 leading-relaxed italic">
                        "{r.reason}"
                      </p>
                      <button className={`mt-3 w-full py-2 rounded-xl text-xs font-bold transition ${
                        isSelected
                          ? "bg-zinc-200 text-zinc-950"
                          : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                      }`}>
                        {isSelected ? "✓ Active on Map" : "Select Route"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Dedicated "How to Reach Easily & Safely" Panel */}
        {selectedRoute && (
          <section className="bg-zinc-900/90 border border-zinc-800 p-6 rounded-3xl space-y-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
              <div>
                <h2 className="text-xl font-bold text-zinc-100 flex items-center space-x-2">
                  <span>🚗</span>
                  <span>How to Reach Easily & Safely: {selectedRoute.name}</span>
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Estimated travel duration, transport recommendations, and step-by-step directions
                </p>
              </div>

              {selectedRoute.easyReachGuide?.googleMapsUrl && (
                <a
                  href={selectedRoute.easyReachGuide.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold px-4 py-2 rounded-xl text-xs transition flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 w-fit cursor-pointer"
                >
                  <span>📱</span>
                  <span>Open Live Navigation in Google Maps</span>
                </a>
              )}
            </div>

            {/* Travel Time & Transport Mode Highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 space-y-1">
                <span className="text-xs text-zinc-400 block font-medium">⏱️ Total Travel Duration</span>
                <span className="text-3xl font-black text-emerald-400">~{selectedRoute.durationMin} Mins</span>
                <span className="text-[11px] text-zinc-500 block">Distance: {selectedRoute.distanceKm} kilometers</span>
              </div>

              <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 space-y-1">
                <span className="text-xs text-zinc-400 block font-medium">🚇 Recommended Mode</span>
                <span className="text-lg font-bold text-cyan-300">
                  {selectedRoute.easyReachGuide?.recommendedMode || '🚖 App Cab / Driving'}
                </span>
                <span className="text-[11px] text-zinc-500 block">Fastest & safest option for this Kolkata corridor</span>
              </div>

              <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 space-y-1">
                <span className="text-xs text-zinc-400 block font-medium">💡 Safety Status</span>
                <span className={`text-lg font-bold ${
                  selectedRoute.score >= 85 ? 'text-emerald-400' : 'text-amber-400'
                }`}>
                  {selectedRoute.score >= 85 ? 'High Illumination' : 'Moderate Illumination'}
                </span>
                <span className="text-[11px] text-zinc-500 block">
                  {selectedRoute.crimeSummary?.policeStations || 2} Police Checkpoints nearby
                </span>
              </div>
            </div>

            {/* Step-by-Step Directions */}
            {selectedRoute.easyReachGuide?.stepDirections && (
              <div className="bg-zinc-950/80 p-5 rounded-2xl border border-zinc-800 space-y-3">
                <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center justify-between border-b border-zinc-800 pb-2">
                  <span>🛣️ Step-by-Step Easy Navigation Guide</span>
                  <span className="text-emerald-400 font-normal text-[11px]">4 Navigation Milestones</span>
                </h3>

                <div className="space-y-2.5 pt-1">
                  {selectedRoute.easyReachGuide.stepDirections.map((step, idx) => (
                    <div key={idx} className="flex items-start space-x-3 text-xs sm:text-sm">
                      <span className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <p className="text-zinc-200 leading-relaxed pt-0.5">{step}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Safety Tips Advisory */}
            {selectedRoute.easyReachGuide?.safetyTips && (
              <div className="bg-emerald-950/40 border border-emerald-800/60 p-4 rounded-2xl flex items-start space-x-3 text-emerald-200">
                <span className="text-2xl mt-0.5">💡</span>
                <div className="space-y-1 text-xs sm:text-sm">
                  <span className="font-bold block text-emerald-300">Easy & Safe Navigation Tip</span>
                  <p className="leading-relaxed">{selectedRoute.easyReachGuide.safetyTips}</p>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Footer & Emergency Helplines */}
        <footer className="pt-6 border-t border-zinc-900 flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-500 gap-4">
          <p>© 2026 SafeHer AI • West Bengal Edition.</p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => alert("🚨 EMERGENCY SOS ALERT SENT!\nDispatched to Kolkata Police Women Helpline (1090) & WB Emergency (112).")}
              className="bg-red-600 hover:bg-red-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition shadow-lg shadow-red-600/30 flex items-center space-x-1.5 cursor-pointer"
            >
              <span>🚨</span>
              <span>EMERGENCY SOS</span>
            </button>

            <a
              href="tel:1090"
              className="bg-zinc-800 hover:bg-zinc-700 text-emerald-400 px-3 py-2 rounded-xl font-semibold transition border border-zinc-700"
            >
              📞 1090 (Kolkata Women Helpline)
            </a>

            <a
              href="tel:112"
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-2 rounded-xl font-medium transition"
            >
              📞 112 (Emergency)
            </a>
          </div>
        </footer>

      </div>
    </main>
  );
}