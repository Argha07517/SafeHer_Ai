'use client';

import React, { useState, useEffect, useRef } from 'react';

export interface PlaceSuggestion {
  displayName: string;
  title: string;
  subtitle: string;
  iconSymbol?: string;
  categoryTag?: string;
  coordinates?: [number, number];
}

// Kolkata Metropolitan Region Bounding Box (Kolkata, Howrah, Salt Lake, New Town, Bidhannagar, Dum Dum, Baranagar, Behala, Jadavpur, Garia, Barrackpore, Hooghly riverfront)
export const KOLKATA_BOUNDS = {
  minLat: 22.20,
  maxLat: 22.95,
  minLon: 88.10,
  maxLon: 88.75,
};

export function isWithinKolkataRegion(lat?: number, lon?: number): boolean {
  if (lat === undefined || lon === undefined) return true;
  return (
    lat >= KOLKATA_BOUNDS.minLat &&
    lat <= KOLKATA_BOUNDS.maxLat &&
    lon >= KOLKATA_BOUNDS.minLon &&
    lon <= KOLKATA_BOUNDS.maxLon
  );
}

// Pre-populated Kolkata Metropolitan Google Places & landmarks
const KOLKATA_METRO_PRESETS: PlaceSuggestion[] = [
  { title: "Park Street", subtitle: "Park Street, Central Kolkata, West Bengal", displayName: "Park Street, Kolkata", iconSymbol: "📍", categoryTag: "Landmark", coordinates: [22.5535, 88.3527] },
  { title: "Victoria Memorial", subtitle: "Queens Way, Maidan, Kolkata, West Bengal", displayName: "Victoria Memorial, Kolkata", iconSymbol: "🏛️", categoryTag: "Tourist Attraction", coordinates: [22.5448, 88.3426] },
  { title: "Science City", subtitle: "JBS Haldane Avenue, Kolkata, West Bengal", displayName: "Science City, Kolkata", iconSymbol: "🔬", categoryTag: "Science Center", coordinates: [22.5401, 88.3953] },
  { title: "Howrah Bridge", subtitle: "Jagdish Bose Road, Kolkata, West Bengal", displayName: "Howrah Bridge, Kolkata", iconSymbol: "🌉", categoryTag: "Historic Bridge", coordinates: [22.5851, 88.3468] },
  { title: "Howrah Station", subtitle: "Station Road, Howrah, West Bengal", displayName: "Howrah Station, Kolkata", iconSymbol: "🚆", categoryTag: "Railway Terminal", coordinates: [22.5830, 88.3426] },
  { title: "Sealdah Railway Station", subtitle: "Bepin Behari Ganguly St, Sealdah, Kolkata", displayName: "Sealdah Railway Station, Kolkata", iconSymbol: "🚆", categoryTag: "Railway Terminal", coordinates: [22.5686, 88.3711] },
  { title: "Salt Lake Sector V", subtitle: "Electronics Complex, Sector V, Bidhannagar, Kolkata", displayName: "Salt Lake Sector V, Kolkata", iconSymbol: "🏢", categoryTag: "IT & Tech Park", coordinates: [22.5726, 88.4331] },
  { title: "Esplanade Metro Station", subtitle: "Esplanade, Chowringhee, Kolkata, West Bengal", displayName: "Esplanade, Kolkata", iconSymbol: "🚇", categoryTag: "Metro Station", coordinates: [22.5675, 88.3517] },
  { title: "New Town Eco Park", subtitle: "Major Arterial Road, Action Area II, New Town, Kolkata", displayName: "New Town, Kolkata", iconSymbol: "🌳", categoryTag: "Public Park", coordinates: [22.5930, 88.4680] },
  { title: "Jadavpur University", subtitle: "188, Raja S.C. Mallick Road, Jadavpur, Kolkata", displayName: "Jadavpur, Kolkata", iconSymbol: "🎓", categoryTag: "University Campus", coordinates: [22.4990, 88.3714] },
  { title: "Calcutta Medical College", subtitle: "88 College St, Bowbazar, Kolkata, West Bengal", displayName: "Medical College, Kolkata", iconSymbol: "🏥", categoryTag: "Hospital", coordinates: [22.5732, 88.3620] },
  { title: "SSKM Hospital", subtitle: "244 AJC Bose Road, Bhowanipore, Kolkata", displayName: "SSKM Hospital, Kolkata", iconSymbol: "🏥", categoryTag: "Super Speciality Hospital", coordinates: [22.5391, 88.3433] },
  { title: "CC2 Mall (City Centre 2)", subtitle: "Chinar Park, Rajarhat Main Rd, New Town, Kolkata", displayName: "City Centre 2, New Town, Kolkata", iconSymbol: "🛍️", categoryTag: "Shopping Mall", coordinates: [22.6240, 88.4380] },
  { title: "South City Mall", subtitle: "375 Prince Anwar Shah Rd, Jadavpur, Kolkata", displayName: "South City Mall, Kolkata", iconSymbol: "🛍️", categoryTag: "Shopping Mall", coordinates: [22.5010, 88.3620] },
  { title: "Quest Mall", subtitle: "33, Syed Amir Ali Ave, Park Circus, Kolkata", displayName: "Quest Mall, Kolkata", iconSymbol: "🛍️", categoryTag: "Shopping Mall", coordinates: [22.5390, 88.3650] },
  { title: "Behala", subtitle: "Diamond Harbour Road, South West Kolkata", displayName: "Behala, Kolkata", iconSymbol: "📍", categoryTag: "Locality", coordinates: [22.4993, 88.3151] },
  { title: "Tollygunge Metro Station", subtitle: "Deshapran Sasmal Rd, Tollygunge, Kolkata", displayName: "Tollygunge, Kolkata", iconSymbol: "🚇", categoryTag: "Metro Station", coordinates: [22.5008, 88.3426] },
  { title: "Gariahat Crossing", subtitle: "Rash Behari Ave & Gariahat Rd Crossing, Kolkata", displayName: "Gariahat Crossing, Kolkata", iconSymbol: "🚦", categoryTag: "Major Junction", coordinates: [22.5187, 88.3654] },
  { title: "Ballygunge Railway Station", subtitle: "Ballygunge Station Rd, Ekdalia, Kolkata", displayName: "Ballygunge, Kolkata", iconSymbol: "🚆", categoryTag: "Railway Station", coordinates: [22.5288, 88.3648] },
  { title: "Dum Dum Airport (CCU)", subtitle: "Netaji Subhash Chandra Bose Int Airport, Kolkata", displayName: "Dum Dum Airport, Kolkata", iconSymbol: "✈️", categoryTag: "International Airport", coordinates: [22.6547, 88.4467] },
  { title: "Shyambazar Five Point", subtitle: "Shyambazar, North Kolkata, West Bengal", displayName: "Shyambazar, Kolkata", iconSymbol: "🚦", categoryTag: "Major Junction", coordinates: [22.5983, 88.3719] },
  { title: "Kasba", subtitle: "EM Bypass Connector, South East Kolkata", displayName: "Kasba, Kolkata", iconSymbol: "📍", categoryTag: "Locality", coordinates: [22.5145, 88.3813] },
  { title: "Entally", subtitle: "AJC Bose Road Corridor, Central Kolkata", displayName: "Entally, Kolkata", iconSymbol: "📍", categoryTag: "Locality", coordinates: [22.5619, 88.3745] },
  { title: "Beleghata", subtitle: "E.M. Bypass, East Kolkata, West Bengal", displayName: "Beleghata, Kolkata", iconSymbol: "📍", categoryTag: "Locality", coordinates: [22.5580, 88.3880] },
  { title: "Rabindra Sadan", subtitle: "Cathedral Rd, Chowringhee, Kolkata, West Bengal", displayName: "Rabindra Sadan, Kolkata", iconSymbol: "🎭", categoryTag: "Cultural Complex", coordinates: [22.5442, 88.3468] },
];

function getCategoryIcon(type: string, name: string): string {
  const n = name.toLowerCase();
  const t = type.toLowerCase();

  if (n.includes('metro') || t.includes('subway') || t.includes('station')) return '🚇';
  if (n.includes('hospital') || n.includes('clinic') || n.includes('medical')) return '🏥';
  if (n.includes('university') || n.includes('college') || n.includes('school')) return '🎓';
  if (n.includes('mall') || n.includes('market') || n.includes('store')) return '🛍️';
  if (n.includes('airport') || n.includes('ccu')) return '✈️';
  if (n.includes('park') || n.includes('garden')) return '🌳';
  if (n.includes('bridge') || n.includes('flyover')) return '🌉';
  if (n.includes('tech') || n.includes('office') || n.includes('tower')) return '🏢';
  return '📍';
}

interface LocationAutocompleteProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (val: string) => void;
  onSelect: (val: string, coords?: [number, number]) => void;
  rightElement?: React.ReactNode;
}

export default function LocationAutocomplete({
  label,
  placeholder,
  value,
  onChange,
  onSelect,
  rightElement,
}: LocationAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [loading, setLoading] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Kolkata-Exclusive place search query engine
  useEffect(() => {
    const query = value.trim().toLowerCase();
    if (!query) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    // 1. Filter local Kolkata presets
    const matchedPresets = KOLKATA_METRO_PRESETS.filter(
      (item) =>
        item.title.toLowerCase().includes(query) ||
        item.displayName.toLowerCase().includes(query) ||
        item.subtitle.toLowerCase().includes(query)
    );

    setSuggestions(matchedPresets);
    setIsOpen(true);
    setSelectedIndex(-1);

    // 2. Query external search APIs strictly bounded to Kolkata Metropolitan Region
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(async () => {
      if (query.length >= 2) {
        setLoading(true);
        try {
          // Bounded Photon search query centered on Kolkata
          const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(query + ' kolkata')}&lat=22.5726&lon=88.3639&bbox=88.10,22.20,88.75,22.95&limit=6`;
          const photonRes = await fetch(photonUrl);

          const apiSuggestions: PlaceSuggestion[] = [];

          if (photonRes.ok) {
            const photonData = await photonRes.json();
            if (photonData.features && photonData.features.length > 0) {
              photonData.features.forEach((feat: any) => {
                const props = feat.properties;
                const lat = feat.geometry.coordinates[1];
                const lon = feat.geometry.coordinates[0];

                // STRICT FILTER: Keep ONLY places within Kolkata Metropolitan bounds
                if (isWithinKolkataRegion(lat, lon)) {
                  const name = props.name || props.street || props.district || query;
                  const city = props.city || props.county || 'Kolkata';
                  const coords: [number, number] = [lat, lon];
                  const category = props.osm_value || props.type || 'Kolkata Place';
                  const iconSymbol = getCategoryIcon(category, name);

                  apiSuggestions.push({
                    title: name,
                    subtitle: `${props.street ? props.street + ', ' : ''}${city}, West Bengal`,
                    displayName: `${name}, Kolkata`,
                    iconSymbol,
                    categoryTag: category.charAt(0).toUpperCase() + category.slice(1),
                    coordinates: coords,
                  });
                }
              });
            }
          }

          // Fallback Bounded Nominatim Query
          if (apiSuggestions.length < 3) {
            let searchQuery = value.trim();
            if (!searchQuery.toLowerCase().includes('kolkata')) {
              searchQuery += ', Kolkata, West Bengal';
            }

            const nomRes = await fetch(
              `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&viewbox=88.10,22.95,88.75,22.20&bounded=1&limit=6`,
              { headers: { 'User-Agent': 'SafeHerAI-Kolkata/1.0' } }
            );

            if (nomRes.ok) {
              const nomData = await nomRes.json();
              nomData.forEach((item: any) => {
                const lat = parseFloat(item.lat);
                const lon = parseFloat(item.lon);
                if (isWithinKolkataRegion(lat, lon)) {
                  const parts = item.display_name.split(',');
                  const title = parts[0].trim();
                  const subtitle = parts.slice(1, 4).join(',').trim();
                  const iconSymbol = getCategoryIcon(item.type || '', title);

                  apiSuggestions.push({
                    title,
                    subtitle: subtitle || 'Kolkata, West Bengal',
                    displayName: parts.slice(0, 3).join(',').trim(),
                    iconSymbol,
                    categoryTag: 'Kolkata Place',
                    coordinates: [lat, lon],
                  });
                }
              });
            }
          }

          const combined = [...matchedPresets];
          apiSuggestions.forEach((apiItem) => {
            if (!combined.some((p) => p.displayName.toLowerCase() === apiItem.displayName.toLowerCase())) {
              combined.push(apiItem);
            }
          });

          setSuggestions(combined);
        } catch (e) {
          console.warn('Kolkata exclusive search error:', e);
        } finally {
          setLoading(false);
        }
      }
    }, 150);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [value]);

  const handleSelectSuggestion = (item: PlaceSuggestion) => {
    onChange(item.displayName);
    onSelect(item.displayName, item.coordinates);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
        handleSelectSuggestion(suggestions[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-semibold uppercase text-zinc-400 tracking-wider">
          {label}
        </label>
        {rightElement}
      </div>

      <div className="relative">
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => value.trim() && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          className="w-full p-4 rounded-xl bg-zinc-800/80 border border-zinc-700 focus:border-emerald-500 outline-none transition text-white placeholder-zinc-500 font-medium"
        />

        {loading && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center space-x-1 text-xs text-emerald-400">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          </div>
        )}
      </div>

      {/* Kolkata Exclusive Search Dropdown Menu */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-[2000] left-0 right-0 mt-2 bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/80 rounded-2xl shadow-2xl overflow-hidden max-h-80 overflow-y-auto divide-y divide-zinc-800/60">
          <div className="px-3 py-2 bg-zinc-950/90 text-[10px] uppercase font-bold text-zinc-400 tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-emerald-400 font-extrabold">
              <span>📍</span>
              <span>Kolkata Exclusive Locations</span>
            </span>
            <span>{suggestions.length} places match</span>
          </div>

          {suggestions.map((item, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <div
                key={idx}
                onClick={() => handleSelectSuggestion(item)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`p-3.5 cursor-pointer transition flex items-center space-x-3 ${
                  isSelected ? 'bg-emerald-500/20 text-white border-l-4 border-emerald-500' : 'hover:bg-zinc-800/70 text-zinc-200'
                }`}
              >
                <div className="w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-base shrink-0 text-zinc-200">
                  {item.iconSymbol || '📍'}
                </div>

                <div className="overflow-hidden space-y-0.5 w-full">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-sm text-zinc-100 truncate">
                      {item.title}
                    </div>
                    {item.categoryTag && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 shrink-0 font-mono">
                        {item.categoryTag}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-400 truncate">{item.subtitle}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
