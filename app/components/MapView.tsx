'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';
import type { SafetyDataPoint, FirCase } from '../utils/csvParser';

export type RouteItem = {
  id: string;
  name: string;
  badge: string;
  score: number;
  coordinates: [number, number][];
  distanceKm: string;
  durationMin: string;
  safetyFactors: {
    lighting: number;
    crowd: number;
    police: number;
    hospital: number;
  };
  crimeSummary?: {
    totalFirCases?: number;
    crimesAgainstWomen: number;
    assaults: number;
    rapes: number;
    thefts: number;
    poorLightingCases?: number;
    policeStations: number;
    hospitals: number;
    nearbyLocalities: string[];
  };
  reason: string;
  easyReachGuide?: {
    recommendedMode: string;
    stepDirections: string[];
    safetyTips: string;
    googleMapsUrl: string;
  };
};

interface MapViewProps {
  sourcePosition?: [number, number];
  destinationPosition?: [number, number];
  routes?: RouteItem[];
  selectedRouteId?: string;
  onSelectRoute?: (id: string) => void;
  csvPoints?: SafetyDataPoint[];
  mapFilterMode?: 'all' | 'women_crimes' | 'clusters';
}

const GOOGLE_MAPS_TILES = {
  roadmap: 'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
  satellite: 'https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}',
  terrain: 'https://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
};

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ULTRA-HIGH PRECISION 50 METER RADIUS ROAD CORRIDOR FILTER (0.05 km)
function isNearRoute(
  lat: number,
  lng: number,
  routeCoords: [number, number][],
  thresholdKm = 0.05
): boolean {
  if (!routeCoords || routeCoords.length === 0) return true;
  
  const step = Math.max(1, Math.floor(routeCoords.length / 150));
  for (let i = 0; i < routeCoords.length; i += step) {
    const [rLat, rLng] = routeCoords[i];
    if (getDistanceKm(lat, lng, rLat, rLng) <= thresholdKm) {
      return true;
    }
  }
  return false;
}

function MapBoundsUpdater({
  sourcePosition,
  destinationPosition,
  routes,
  selectedRoute,
  csvPoints,
}: {
  sourcePosition?: [number, number];
  destinationPosition?: [number, number];
  routes?: RouteItem[];
  selectedRoute?: RouteItem;
  csvPoints?: SafetyDataPoint[];
}) {
  const map = useMap();

  useEffect(() => {
    const points: [number, number][] = [];

    if (sourcePosition) points.push(sourcePosition);
    if (destinationPosition) points.push(destinationPosition);

    if (selectedRoute && selectedRoute.coordinates.length > 0) {
      selectedRoute.coordinates.forEach((coord) => points.push(coord));
    } else if (routes && routes.length > 0) {
      routes.forEach((route) => {
        route.coordinates.forEach((coord) => points.push(coord));
      });
    }

    if (points.length > 0) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
    } else if (csvPoints && csvPoints.length > 0) {
      csvPoints.forEach((pt) => points.push([pt.latitude, pt.longitude]));
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 13 });
    }
  }, [map, sourcePosition, destinationPosition, routes, selectedRoute, csvPoints]);

  return null;
}

const createPinIcon = (color: string, iconSymbol: string, title: string, size = 38) => {
  const anchor = Math.round(size / 2);
  return L.divIcon({
    className: 'custom-pin-marker',
    html: `
      <div style="
        background: ${color};
        width: ${size}px;
        height: ${size}px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 6px 18px rgba(0,0,0,0.6);
        border: 2.5px solid white;
        transition: transform 0.2s ease;
      ">
        <span style="
          transform: rotate(45deg);
          font-size: ${Math.round(size * 0.45)}px;
          color: white;
          font-weight: bold;
        ">${iconSymbol}</span>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [anchor, size],
    popupAnchor: [0, -size],
  });
};

const createRouteBadgeIcon = (text: string, color: string) => {
  return L.divIcon({
    className: 'route-badge-marker',
    html: `
      <div style="
        background: ${color};
        color: white;
        font-weight: 800;
        font-size: 11px;
        padding: 4px 10px;
        border-radius: 20px;
        border: 2px solid white;
        box-shadow: 0 4px 14px rgba(0,0,0,0.5);
        white-space: nowrap;
        display: flex;
        align-items: center;
        gap: 4px;
      ">
        ${text}
      </div>
    `,
    iconSize: [120, 26],
    iconAnchor: [60, 13],
  });
};

const sourceIcon = createPinIcon('#10b981', '🚩', 'Start Point', 44);
const destinationIcon = createPinIcon('#ef4444', '🏁', 'Destination', 44);

const localityIcons: Record<string, L.DivIcon> = {
  Police: createPinIcon('#3b82f6', '👮', 'Police Station', 34),
  'Safe Zone': createPinIcon('#10b981', '🛡️', 'Safe Zone', 34),
  'High Crime': createPinIcon('#dc2626', '🚨', 'High Crime Sector', 34),
  'Dark Spot': createPinIcon('#e11d48', '⚠️', 'Dark Spot', 34),
  Hospital: createPinIcon('#a855f7', '🏥', 'Hospital', 34),
  General: createPinIcon('#64748b', '📍', 'Kolkata Locality', 32),
};

const getFirCrimeIcon = (crimeType: string, victimGender: string) => {
  const lower = crimeType.toLowerCase();
  if (victimGender.toLowerCase() === 'woman' || lower.includes('sexual') || lower.includes('harassment') || lower.includes('rape') || lower.includes('molestation')) {
    return createPinIcon('#e11d48', '🚨', 'Crimes Against Women', 32);
  }
  if (lower.includes('domestic')) return createPinIcon('#f97316', '🏠', 'Domestic Violence', 30);
  if (lower.includes('murder')) return createPinIcon('#991b1b', '💀', 'Homicide', 30);
  if (lower.includes('assault')) return createPinIcon('#d97706', '⚡', 'Assault', 30);
  if (lower.includes('kidnapping')) return createPinIcon('#8b5cf6', '🚷', 'Kidnapping', 30);
  if (lower.includes('robbery') || lower.includes('theft')) return createPinIcon('#eab308', '💰', 'Theft/Robbery', 28);
  return createPinIcon('#64748b', '📋', 'FIR Incident', 28);
};

export default function MapView({
  sourcePosition,
  destinationPosition,
  routes = [],
  selectedRouteId,
  onSelectRoute,
  csvPoints = [],
  mapFilterMode: initialFilterMode = 'all',
}: MapViewProps) {
  const [filterMode, setFilterMode] = useState<'all' | 'women_crimes' | 'clusters'>(initialFilterMode);
  const [googleStyle, setGoogleStyle] = useState<'roadmap' | 'satellite' | 'terrain'>('roadmap');
  
  // Interactive FIR Details Inspector Modal State
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  useEffect(() => {
    if (initialFilterMode) {
      setFilterMode(initialFilterMode);
    }
  }, [initialFilterMode]);

  const defaultCenter: [number, number] = sourcePosition || [22.5726, 88.3639];
  const selectedRoute = routes.find((r) => r.id === selectedRouteId) || routes[0];

  const getRouteColor = (route: RouteItem, isSelected: boolean) => {
    if (route.id === 'route-a') return isSelected ? '#10b981' : '#059669';
    if (route.id === 'route-b') return isSelected ? '#f59e0b' : '#d97706';
    return isSelected ? '#ef4444' : '#dc2626';
  };

  const allFirCases: FirCase[] = [];
  csvPoints.forEach((pt) => {
    if (pt.fir_cases && pt.fir_cases.length > 0) {
      allFirCases.push(...pt.fir_cases);
    }
  });

  const womenCrimeCases = allFirCases.filter((f) => {
    const typeLower = f.crime_type.toLowerCase();
    const subLower = f.crime_subtype.toLowerCase();
    return (
      f.victim_gender.toLowerCase() === 'woman' ||
      typeLower.includes('sexual') ||
      typeLower.includes('harassment') ||
      typeLower.includes('domestic') ||
      subLower.includes('rape') ||
      subLower.includes('molestation') ||
      subLower.includes('stalking') ||
      subLower.includes('teasing')
    );
  });

  const hasActiveRoute = selectedRoute && selectedRoute.coordinates && selectedRoute.coordinates.length > 0;

  // STRICT 50-METER RADIUS ROAD CORRIDOR FILTER
  const displayFirCases = (filterMode === 'women_crimes' ? womenCrimeCases : allFirCases).filter((fir) => {
    if (!hasActiveRoute) return true;
    return isNearRoute(fir.latitude, fir.longitude, selectedRoute.coordinates, 0.05);
  });

  const displayClusters = csvPoints.filter((pt) => {
    if (!hasActiveRoute) return true;
    return isNearRoute(pt.latitude, pt.longitude, selectedRoute.coordinates, 0.5);
  });

  return (
    <div className="w-full h-[600px] rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl relative bg-zinc-950">
      <MapContainer
        key={`${sourcePosition ? sourcePosition.join(',') : 'default-map'}-${googleStyle}`}
        center={defaultCenter}
        zoom={12}
        style={{ height: '100%', width: '100%', background: '#18181b' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://maps.google.com">Google Maps Platform</a>'
          url={GOOGLE_MAPS_TILES[googleStyle]}
          subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
          maxZoom={20}
        />

        <MapBoundsUpdater
          sourcePosition={sourcePosition}
          destinationPosition={destinationPosition}
          routes={routes}
          selectedRoute={selectedRoute}
          csvPoints={csvPoints}
        />

        {/* Render Source Pin */}
        {sourcePosition && (
          <Marker position={sourcePosition} icon={sourceIcon}>
            <Popup className="custom-popup">
              <div className="text-zinc-900 font-bold p-1">
                🚩 START: Starting Source Location
              </div>
            </Popup>
          </Marker>
        )}

        {/* Render Destination Pin */}
        {destinationPosition && (
          <Marker position={destinationPosition} icon={destinationIcon}>
            <Popup className="custom-popup">
              <div className="text-zinc-900 font-bold p-1">
                🏁 TARGET: Destination Point
              </div>
            </Popup>
          </Marker>
        )}

        {/* Render Mode 1: Locality Sector Clusters */}
        {filterMode === 'clusters' &&
          displayClusters.map((pt) => {
            const icon = localityIcons[pt.category] || localityIcons['General'];
            const cb = pt.crime_breakdown;

            return (
              <Marker key={pt.id} position={[pt.latitude, pt.longitude]} icon={icon}>
                <Popup>
                  <div className="p-2.5 text-zinc-900 min-w-[260px] max-w-xs space-y-2 font-sans">
                    <div className="flex items-center justify-between border-b border-zinc-200 pb-1.5">
                      <span className="font-extrabold text-sm text-zinc-900">{pt.location_name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        {pt.category}
                      </span>
                    </div>

                    <div className="flex items-center justify-between bg-zinc-50 p-1.5 rounded-lg border border-zinc-200 text-xs">
                      <span className="font-semibold text-zinc-700">AI Safety Score:</span>
                      <span className={`font-black text-sm ${pt.safety_score >= 88 ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {pt.safety_score} / 100
                      </span>
                    </div>

                    {cb && (
                      <div className="space-y-1 bg-red-50/80 p-2 rounded-lg border border-red-200 text-xs">
                        <div className="font-bold text-red-900 border-b border-red-200 pb-0.5 flex items-center justify-between">
                          <span>🚨 Sector FIR Summary</span>
                          <span className="text-[11px] font-semibold text-red-800">Women Crimes: {cb.crimes_against_women}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1 text-[11px] text-zinc-800 pt-0.5">
                          <span>Sexual Offences: <strong>{cb.rape + cb.assault}</strong></span>
                          <span>Domestic: <strong>{cb.domestic_violence}</strong></span>
                          <span>Theft: <strong>{cb.theft}</strong></span>
                          <span>Robbery: <strong>{cb.robbery}</strong></span>
                        </div>
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}

        {/* Render Mode 2 & 3: FIR Crime Incident Pins */}
        {filterMode !== 'clusters' && displayFirCases.map((fir) => {
          const icon = getFirCrimeIcon(fir.crime_type, fir.victim_gender);

          return (
            <Marker key={fir.case_id} position={[fir.latitude, fir.longitude]} icon={icon}>
              <Popup>
                <div className="p-2.5 text-zinc-900 min-w-[270px] max-w-xs space-y-2 font-sans">
                  <div className="flex items-center justify-between border-b border-zinc-200 pb-1.5">
                    <span className="font-extrabold text-sm text-red-700">{fir.fir_number}</span>
                    <span className="text-[10px] bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded-full border border-red-300">
                      {fir.crime_type}
                    </span>
                  </div>

                  <div className="bg-red-50/80 p-2 rounded-xl border border-red-200 text-xs space-y-1">
                    <div className="font-bold text-zinc-900 text-sm">{fir.crime_subtype || fir.crime_type}</div>
                    <div className="text-zinc-700 text-[11px]">
                      📍 Road Radius: <strong className="text-red-700">Within 50m of road</strong> ({fir.area_locality})
                    </div>
                    <div className="text-zinc-700 text-[11px] flex items-center justify-between">
                      <span>👤 Victim: <strong>{fir.victim_gender || 'Woman'}</strong></span>
                      <span>💡 Lighting: <strong className="text-red-700">{fir.street_lighting}</strong></span>
                    </div>
                    <div className="text-zinc-700 text-[11px] flex items-center justify-between">
                      <span>⏱️ Time: <strong>{fir.time_slot}</strong></span>
                      <span>⚖️ Status: <strong>{fir.case_status}</strong></span>
                    </div>
                  </div>

                  <div className="text-xs text-zinc-600 italic bg-zinc-100 p-2 rounded-lg border border-zinc-200">
                    "{fir.description}"
                  </div>

                  <button
                    onClick={() => setShowDetailsModal(true)}
                    className="w-full mt-1.5 bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold py-1.5 rounded-lg transition shadow cursor-pointer"
                  >
                    🔍 Inspect All FIR Details ({displayFirCases.length} Cases)
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Render Route Polylines */}
        {routes.map((route) => {
          const isSelected = route.id === selectedRouteId || (!selectedRouteId && route.id === 'route-a');
          const color = getRouteColor(route, isSelected);

          const midIdx = Math.floor(route.coordinates.length / 2);
          const midCoord = route.coordinates[midIdx] || route.coordinates[0];

          return (
            <div key={route.id}>
              <Polyline
                positions={route.coordinates}
                pathOptions={{
                  color: isSelected ? '#09090b' : '#3f3f46',
                  weight: isSelected ? 15 : 5,
                  opacity: isSelected ? 0.95 : 0.25,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              />

              <Polyline
                positions={route.coordinates}
                pathOptions={{
                  color: color,
                  weight: isSelected ? 9 : 3,
                  opacity: isSelected ? 1.0 : 0.3,
                  lineCap: 'round',
                  lineJoin: 'round',
                  dashArray: route.id === 'route-c' && !isSelected ? '6, 10' : undefined,
                }}
                eventHandlers={{
                  click: () => {
                    if (onSelectRoute) onSelectRoute(route.id);
                  },
                }}
              >
                <Popup>
                  <div className="p-2.5 text-zinc-900 max-w-xs space-y-1.5">
                    <div className="font-bold text-sm text-zinc-900">{route.name}</div>
                    <div className="text-xs text-emerald-700 font-extrabold">
                      AI Safety Score: {route.score}/100 | Time: ~{route.durationMin} mins
                    </div>
                    <div className="text-xs text-zinc-600">
                      Distance: {route.distanceKm} km
                    </div>
                    {route.crimeSummary && (
                      <div className="text-[11px] bg-zinc-100 p-1.5 rounded border border-zinc-300 text-zinc-800">
                        🚨 Crimes within 50m road radius: <strong>{route.crimeSummary.crimesAgainstWomen}</strong>
                        <br />
                        💡 Poor lighting cases: <strong>{route.crimeSummary.poorLightingCases || 0}</strong>
                      </div>
                    )}
                    <button
                      onClick={() => onSelectRoute && onSelectRoute(route.id)}
                      className="mt-2 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-1 px-2 rounded w-full"
                    >
                      Select This Route
                    </button>
                  </div>
                </Popup>
              </Polyline>

              {isSelected && midCoord && (
                <Marker
                  position={midCoord}
                  icon={createRouteBadgeIcon(
                    `${route.id === 'route-a' ? '🛡️' : route.id === 'route-b' ? '⚡' : '⚠️'} ${route.distanceKm} km • ~${route.durationMin} mins`,
                    color
                  )}
                />
              )}
            </div>
          );
        })}
      </MapContainer>

      {/* Floating Google Maps Style Switcher */}
      <div className="absolute bottom-4 left-4 z-[1000] bg-zinc-900/95 backdrop-blur-md border border-zinc-800 p-2 rounded-xl shadow-2xl flex items-center space-x-1.5 text-xs text-white">
        <span className="text-[11px] font-bold text-zinc-400 px-1">Google Maps:</span>
        <button
          onClick={() => setGoogleStyle('roadmap')}
          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
            googleStyle === 'roadmap' ? 'bg-emerald-500 text-zinc-950' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
          }`}
        >
          🗺️ Standard
        </button>
        <button
          onClick={() => setGoogleStyle('satellite')}
          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
            googleStyle === 'satellite' ? 'bg-emerald-500 text-zinc-950' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
          }`}
        >
          🛰️ Satellite
        </button>
        <button
          onClick={() => setGoogleStyle('terrain')}
          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
            googleStyle === 'terrain' ? 'bg-emerald-500 text-zinc-950' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
          }`}
        >
          ⛰️ Terrain
        </button>
      </div>

      {/* Floating 50 Meter Radius Road Corridor Status Overlay - CLICKABLE TO OPEN FIR DETAILS MODAL */}
      {selectedRoute && (
        <div className="absolute top-4 left-4 z-[1000] bg-zinc-900/95 backdrop-blur-md border border-zinc-800 p-3 rounded-2xl shadow-2xl space-y-2 text-xs text-white max-w-[290px]">
          <div className="font-bold text-zinc-200 border-b border-zinc-800 pb-1.5 flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1">
              <span>🎯 50m Ultra-Tight Corridor</span>
            </span>
            <span className={`px-2 py-0.5 rounded font-black text-[10px] ${
              selectedRoute.id === 'route-a' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
              selectedRoute.id === 'route-b' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
              'bg-red-500/20 text-red-400 border border-red-500/30'
            }`}>
              {selectedRoute.name.split(' - ')[0]}
            </span>
          </div>

          <div
            onClick={() => setShowDetailsModal(true)}
            title="Click to view full FIR crime case details!"
            className="bg-zinc-950 hover:bg-red-950/40 p-2.5 rounded-xl border border-red-900/50 hover:border-red-500/80 text-[11px] space-y-1 cursor-pointer transition group"
          >
            <div className="font-bold text-zinc-100 flex items-center justify-between">
              <span className="group-hover:text-red-300 transition">Crimes within 50m of road:</span>
              <span className="text-red-400 font-extrabold text-sm group-hover:scale-110 transition underline decoration-red-500">
                {displayFirCases.length} Crimes 🔍
              </span>
            </div>
            <div className="text-[10px] text-zinc-400 flex items-center justify-between">
              <span>Filtered strictly to 50m radius.</span>
              <span className="text-red-400 font-semibold text-[9px] uppercase tracking-wider">Click for details →</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1 text-[10px]">
            <button
              onClick={() => {
                setFilterMode('all');
                setShowDetailsModal(true);
              }}
              className={`py-1.5 rounded font-extrabold transition text-center cursor-pointer ${
                filterMode === 'all' ? 'bg-emerald-600 text-white shadow' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              50m Crimes 🔍
            </button>
            <button
              onClick={() => {
                setFilterMode('women_crimes');
                setShowDetailsModal(true);
              }}
              className={`py-1.5 rounded font-extrabold transition text-center cursor-pointer ${
                filterMode === 'women_crimes' ? 'bg-red-600 text-white shadow' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              Women Crimes 🔍
            </button>
            <button
              onClick={() => setFilterMode('clusters')}
              className={`py-1.5 rounded font-bold transition text-center cursor-pointer ${
                filterMode === 'clusters' ? 'bg-emerald-600 text-white shadow' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              Sectors
            </button>
          </div>
        </div>
      )}

      {/* Active Route Selection Controls */}
      <div className="absolute top-4 right-4 z-[1000] bg-zinc-900/95 backdrop-blur-md border border-zinc-800 p-3 rounded-2xl shadow-2xl text-xs space-y-1.5 text-white max-w-[220px]">
        <div className="font-bold text-zinc-200 border-b border-zinc-800 pb-1 flex items-center justify-between text-[11px]">
          <span>🚥 Active Route</span>
        </div>

        {routes.map((r) => {
          const isSelected = r.id === selectedRouteId;
          const color = getRouteColor(r, isSelected);

          return (
            <button
              key={r.id}
              onClick={() => onSelectRoute && onSelectRoute(r.id)}
              className={`w-full p-2 rounded-xl text-left transition flex items-center justify-between border cursor-pointer ${
                isSelected
                  ? 'bg-zinc-800 border-zinc-600 text-white font-bold shadow-md'
                  : 'bg-zinc-950/60 border-zinc-800/80 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded-full inline-block" style={{ background: color }} />
                <span>{r.name.split(' - ')[0]}</span>
              </div>
              <span className="text-[10px] font-mono">~{r.durationMin}m</span>
            </button>
          );
        })}
      </div>

      {/* INTERACTIVE FIR CRIME INCIDENT DETAILS INSPECTOR MODAL */}
      {showDetailsModal && (
        <div className="fixed inset-0 z-[3000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-fadeIn">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl">🚨</span>
                  <h3 className="font-extrabold text-lg text-white">
                    FIR Crime Incident Details ({displayFirCases.length} Reported Cases)
                  </h3>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Filtered strictly within 50m road radius along <strong className="text-emerald-400">{selectedRoute?.name}</strong>
                </p>
              </div>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition border border-zinc-700 cursor-pointer"
              >
                ✕ Close Inspector
              </button>
            </div>

            {/* Modal Body: List of all Crime Incident Cards */}
            <div className="p-5 overflow-y-auto space-y-4 divide-y divide-zinc-800/80 flex-1">
              {displayFirCases.length === 0 ? (
                <div className="py-12 text-center text-zinc-500 space-y-2">
                  <span className="text-4xl block">🛡️</span>
                  <p className="font-semibold text-base">No crime incidents recorded within 50m of this road corridor.</p>
                  <p className="text-xs">This route has high safety score ratings.</p>
                </div>
              ) : (
                displayFirCases.map((fir, idx) => (
                  <div key={fir.case_id || idx} className="pt-4 first:pt-0 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <span className="bg-red-500/20 text-red-400 font-extrabold text-xs px-2.5 py-1 rounded-lg border border-red-500/40">
                          {fir.fir_number}
                        </span>
                        <h4 className="font-bold text-base text-white">{fir.crime_subtype || fir.crime_type}</h4>
                      </div>

                      <div className="flex items-center space-x-2 text-xs">
                        <span className="bg-zinc-800 text-zinc-300 font-semibold px-2.5 py-1 rounded-lg border border-zinc-700">
                          📍 {fir.area_locality}
                        </span>
                        <span className="bg-emerald-950 text-emerald-400 font-bold px-2.5 py-1 rounded-lg border border-emerald-800">
                          ⚖️ {fir.case_status}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-zinc-950 p-3 rounded-2xl border border-zinc-800/80">
                      <div>
                        <span className="text-zinc-500 block text-[10px] uppercase font-semibold">Victim</span>
                        <span className="font-bold text-zinc-200">{fir.victim_gender || 'Woman'}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block text-[10px] uppercase font-semibold">Street Lighting</span>
                        <span className={`font-bold ${fir.street_lighting.toLowerCase().includes('no') ? 'text-red-400' : 'text-amber-400'}`}>
                          {fir.street_lighting}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block text-[10px] uppercase font-semibold">Time Slot</span>
                        <span className="font-bold text-zinc-200">{fir.time_slot}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block text-[10px] uppercase font-semibold">Severity</span>
                        <span className="font-bold text-red-400">{fir.severity || 'High'}</span>
                      </div>
                    </div>

                    <div className="bg-zinc-950/60 p-3 rounded-xl border border-zinc-800 text-xs text-zinc-300 italic leading-relaxed">
                      "{fir.description}"
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
              <span>Showing all {displayFirCases.length} FIR cases mapped from Kolkata dataset</span>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold px-4 py-2 rounded-xl text-xs transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
