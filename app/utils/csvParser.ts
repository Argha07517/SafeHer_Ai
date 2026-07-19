export type SafetyCategory = 'Police' | 'Safe Zone' | 'Dark Spot' | 'Hospital' | 'CCTV' | 'General' | 'High Crime';

export interface FirCase {
  case_id: string;
  fir_number: string;
  area_locality: string;
  latitude: number;
  longitude: number;
  crime_type: string;
  crime_subtype: string;
  date: string;
  time_slot: string;
  street_lighting: string;
  victim_gender: string;
  severity: string;
  arrest_made: string;
  case_status: string;
  description: string;
}

export interface CrimeBreakdown {
  murder: number;
  theft: number;
  robbery: number;
  burglary: number;
  kidnapping: number;
  rape: number;
  assault: number;
  domestic_violence: number;
  crimes_against_women: number;
  police_stations: number;
  hospitals: number;
  fir_cases_count?: number;
  poor_lighting_cases?: number;
}

export interface SafetyDataPoint {
  id: string;
  location_name: string;
  latitude: number;
  longitude: number;
  safety_score: number;
  category: SafetyCategory;
  lighting: number;
  crowd: number;
  police_presence: number;
  description: string;
  crime_breakdown: CrimeBreakdown;
  fir_cases?: FirCase[];
}

/**
 * Utility to parse CSV line handling quoted values and commas
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Standardize category values into SafetyCategory
 */
function normalizeCategory(catStr: string, score: number, crimesAgainstWomen: number, policeCount: number): SafetyCategory {
  const lower = catStr.toLowerCase();
  if (lower.includes('police') || lower.includes('cop') || lower.includes('station')) return 'Police';
  if (lower.includes('hospital') || lower.includes('medical') || lower.includes('clinic')) return 'Hospital';
  if (lower.includes('cctv') || lower.includes('camera') || lower.includes('surveillance')) return 'CCTV';
  if (lower.includes('dark') || lower.includes('danger') || lower.includes('risk') || lower.includes('hazard') || lower.includes('unlit')) return 'Dark Spot';
  if (lower.includes('safe') || lower.includes('well-lit') || lower.includes('hub')) return 'Safe Zone';
  
  if (crimesAgainstWomen >= 10 || score < 80) return 'High Crime';
  if (policeCount >= 3 || score >= 92) return 'Safe Zone';
  if (score >= 85) return 'Safe Zone';
  return 'General';
}

/**
 * Parses raw CSV string into a structured array of SafetyDataPoint items
 * Handles case-level datasets, summary datasets, and hybrid appended CSV files!
 */
export function parseSafetyCsv(csvText: string): SafetyDataPoint[] {
  if (!csvText || !csvText.trim()) return [];

  const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length <= 1) return [];

  // Check if CSV contains FIR case rows anywhere
  const firHeaderLineIdx = lines.findIndex((l) => {
    const lower = l.toLowerCase();
    return lower.includes('case_id') || lower.includes('fir_number') || lower.includes('crime_type');
  });

  const isFirDataset = firHeaderLineIdx !== -1 || lines.some((l) => l.startsWith('KOL-') || l.includes('FIR/'));

  if (isFirDataset) {
    const firHeaderIdx = firHeaderLineIdx !== -1 ? firHeaderLineIdx : 0;
    const rawHeaders = parseCsvLine(lines[firHeaderIdx]);
    const headers = rawHeaders.map((h) => h.toLowerCase().replace(/[^a-z0-9_]/g, ''));

    const getColIdx = (aliases: string[]): number => {
      return headers.findIndex((h) => aliases.some((alias) => h === alias || h.includes(alias)));
    };

    const caseIdIdx = getColIdx(['case_id']);
    const firIdx = getColIdx(['fir_number']);
    const nameIdx = getColIdx(['area_locality', 'location_name', 'name', 'locality', 'district']);
    const latIdx = getColIdx(['latitude', 'lat']);
    const lngIdx = getColIdx(['longitude', 'lng', 'lon']);
    const crimeTypeIdx = getColIdx(['crime_type']);
    const crimeSubtypeIdx = getColIdx(['crime_subtype']);
    const dateIdx = getColIdx(['date']);
    const timeSlotIdx = getColIdx(['time_slot']);
    const streetLightIdx = getColIdx(['street_lighting']);
    const victimGenderIdx = getColIdx(['victim_gender']);
    const severityIdx = getColIdx(['severity']);
    const arrestIdx = getColIdx(['arrest_made']);
    const statusIdx = getColIdx(['case_status']);
    const descIdx = getColIdx(['description']);

    const localityMap = new Map<string, {
      name: string;
      lats: number[];
      lngs: number[];
      firCases: FirCase[];
      crimesAgainstWomen: number;
      murder: number;
      theft: number;
      robbery: number;
      burglary: number;
      kidnapping: number;
      rape: number;
      assault: number;
      domestic: number;
      poorLightingCount: number;
    }>();

    for (let i = 0; i < lines.length; i++) {
      if (i === firHeaderIdx) continue;
      const line = lines[i];
      if (!line.includes('KOL-') && !line.includes('FIR/')) continue;

      const values = parseCsvLine(line);
      if (values.length < 4) continue;

      const lat = parseFloat(latIdx !== -1 && values[latIdx] ? values[latIdx] : '');
      const lng = parseFloat(lngIdx !== -1 && values[lngIdx] ? values[lngIdx] : '');
      if (isNaN(lat) || isNaN(lng)) continue;

      const localityName = nameIdx !== -1 && values[nameIdx] ? values[nameIdx] : 'Kolkata Sector';
      const crimeType = crimeTypeIdx !== -1 ? values[crimeTypeIdx] : 'Incidence';
      const crimeSubtype = crimeSubtypeIdx !== -1 ? values[crimeSubtypeIdx] : '';
      const victimGender = victimGenderIdx !== -1 ? values[victimGenderIdx] : '';
      const streetLighting = streetLightIdx !== -1 ? values[streetLightIdx] : '';

      const firObj: FirCase = {
        case_id: caseIdIdx !== -1 && values[caseIdIdx] ? values[caseIdIdx] : `FIR-${i}`,
        fir_number: firIdx !== -1 && values[firIdx] ? values[firIdx] : `FIR/${i}`,
        area_locality: localityName,
        latitude: lat,
        longitude: lng,
        crime_type: crimeType,
        crime_subtype: crimeSubtype,
        date: dateIdx !== -1 ? values[dateIdx] : '',
        time_slot: timeSlotIdx !== -1 ? values[timeSlotIdx] : '',
        street_lighting: streetLighting,
        victim_gender: victimGender,
        severity: severityIdx !== -1 ? values[severityIdx] : 'Medium',
        arrest_made: arrestIdx !== -1 ? values[arrestIdx] : 'No',
        case_status: statusIdx !== -1 ? values[statusIdx] : 'Open',
        description: descIdx !== -1 ? values[descIdx] : `${crimeType} reported at ${localityName}`,
      };

      if (!localityMap.has(localityName)) {
        localityMap.set(localityName, {
          name: localityName,
          lats: [],
          lngs: [],
          firCases: [],
          crimesAgainstWomen: 0,
          murder: 0,
          theft: 0,
          robbery: 0,
          burglary: 0,
          kidnapping: 0,
          rape: 0,
          assault: 0,
          domestic: 0,
          poorLightingCount: 0,
        });
      }

      const group = localityMap.get(localityName)!;
      group.lats.push(lat);
      group.lngs.push(lng);
      group.firCases.push(firObj);

      const typeLower = crimeType.toLowerCase();
      const subLower = crimeSubtype.toLowerCase();

      if (victimGender.toLowerCase() === 'woman' || typeLower.includes('sexual') || typeLower.includes('harassment') || typeLower.includes('domestic') || subLower.includes('rape') || subLower.includes('molestation')) {
        group.crimesAgainstWomen++;
      }
      if (typeLower.includes('murder') || subLower.includes('homicide')) group.murder++;
      if (typeLower.includes('theft') || subLower.includes('snatching')) group.theft++;
      if (typeLower.includes('robbery')) group.robbery++;
      if (typeLower.includes('burglary')) group.burglary++;
      if (typeLower.includes('kidnapping') || subLower.includes('abduction')) group.kidnapping++;
      if (subLower.includes('rape')) group.rape++;
      if (typeLower.includes('assault') || subLower.includes('assault') || subLower.includes('molestation')) group.assault++;
      if (typeLower.includes('domestic')) group.domestic++;

      if (streetLighting.toLowerCase().includes('no') || streetLighting.toLowerCase().includes('poor')) {
        group.poorLightingCount++;
      }
    }

    const points: SafetyDataPoint[] = [];

    localityMap.forEach((group, name) => {
      const avgLat = group.lats.reduce((a, b) => a + b, 0) / group.lats.length;
      const avgLng = group.lngs.reduce((a, b) => a + b, 0) / group.lngs.length;

      const totalCases = group.firCases.length;
      const penalty = (group.crimesAgainstWomen * 2.2) + (group.murder * 4) + (group.poorLightingCount * 1.5);
      const safety_score = Math.max(35, Math.min(96, Math.round(96 - penalty)));

      const category = normalizeCategory('General', safety_score, group.crimesAgainstWomen, 2);

      const crime_breakdown: CrimeBreakdown = {
        murder: group.murder,
        theft: group.theft,
        robbery: group.robbery,
        burglary: group.burglary,
        kidnapping: group.kidnapping,
        rape: group.rape,
        assault: group.assault,
        domestic_violence: group.domestic,
        crimes_against_women: group.crimesAgainstWomen,
        police_stations: Math.min(4, Math.max(1, Math.round(totalCases / 5))),
        hospitals: Math.min(6, Math.max(1, Math.round(totalCases / 4))),
        fir_cases_count: totalCases,
        poor_lighting_cases: group.poorLightingCount,
      };

      points.push({
        id: `locality-${name.replace(/\s+/g, '-').toLowerCase()}`,
        location_name: name,
        latitude: avgLat,
        longitude: avgLng,
        safety_score,
        category,
        lighting: Math.max(30, 95 - Math.round((group.poorLightingCount / Math.max(1, totalCases)) * 60)),
        crowd: Math.min(95, 60 + totalCases * 2),
        police_presence: Math.min(95, 45 + group.firCases.length * 3),
        description: `Parsed ${totalCases} FIR cases in ${name}. Crimes against women: ${group.crimesAgainstWomen}. Poor streetlight cases: ${group.poorLightingCount}.`,
        crime_breakdown,
        fir_cases: group.firCases,
      });
    });

    if (points.length > 0) return points;
  }

  // Standard summary dataset parser fallback
  const rawHeaders = parseCsvLine(lines[0]);
  const headers = rawHeaders.map((h) => h.toLowerCase().replace(/[^a-z0-9_]/g, ''));

  const getColIdx = (aliases: string[]): number => {
    return headers.findIndex((h) => aliases.some((alias) => h === alias || h.includes(alias)));
  };

  const nameIdx = getColIdx(['area_locality', 'location_name', 'name', 'place', 'location', 'locality', 'spot']);
  const latIdx = getColIdx(['latitude', 'lat', 'y']);
  const lngIdx = getColIdx(['longitude', 'lng', 'lon', 'x']);
  const scoreIdx = getColIdx(['ai_safety_score', 'safety_score', 'score', 'safety', 'rating', 'risk_score']);
  const categoryIdx = getColIdx(['category', 'type', 'kind', 'tag', 'class']);
  const lightingIdx = getColIdx(['lighting', 'light', 'illumination']);
  const crowdIdx = getColIdx(['crowd', 'footfall', 'traffic', 'people']);
  const policePresenceIdx = getColIdx(['police_presence', 'patrol']);
  const descIdx = getColIdx(['description', 'desc', 'details', 'info', 'note', 'notes']);

  const murderIdx = getColIdx(['murder']);
  const theftIdx = getColIdx(['theft']);
  const robberyIdx = getColIdx(['robbery']);
  const burglaryIdx = getColIdx(['burglary']);
  const kidnappingIdx = getColIdx(['kidnapping']);
  const rapeIdx = getColIdx(['rape']);
  const assaultIdx = getColIdx(['assault']);
  const domesticIdx = getColIdx(['domestic_violence', 'domestic']);
  const crimesWomenIdx = getColIdx(['crimes_against_women', 'women_crime', 'crimes_women']);
  const policeStationIdx = getColIdx(['police_station_count', 'police_stations', 'police_station']);
  const hospitalIdx = getColIdx(['hospital_count', 'hospitals', 'hospital']);

  const points: SafetyDataPoint[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    if (values.length < 2) continue;

    const lat = parseFloat(latIdx !== -1 ? values[latIdx] : '');
    const lng = parseFloat(lngIdx !== -1 ? values[lngIdx] : '');

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      continue;
    }

    const name = nameIdx !== -1 && values[nameIdx] ? values[nameIdx] : `Locality #${i}`;
    const scoreVal = scoreIdx !== -1 ? parseFloat(values[scoreIdx]) : 85;
    const safety_score = isNaN(scoreVal) ? 85 : Math.max(0, Math.min(100, scoreVal));

    const parseNum = (idx: number): number => {
      if (idx === -1 || !values[idx]) return 0;
      const parsed = parseInt(values[idx], 10);
      return isNaN(parsed) ? 0 : Math.max(0, parsed);
    };

    const murder = parseNum(murderIdx);
    const theft = parseNum(theftIdx);
    const robbery = parseNum(robberyIdx);
    const burglary = parseNum(burglaryIdx);
    const kidnapping = parseNum(kidnappingIdx);
    const rape = parseNum(rapeIdx);
    const assault = parseNum(assaultIdx);
    const domestic_violence = parseNum(domesticIdx);
    const crimes_against_women = parseNum(crimesWomenIdx);
    const police_stations = parseNum(policeStationIdx);
    const hospitals = parseNum(hospitalIdx);

    const crime_breakdown: CrimeBreakdown = {
      murder,
      theft,
      robbery,
      burglary,
      kidnapping,
      rape,
      assault,
      domestic_violence,
      crimes_against_women,
      police_stations,
      hospitals,
    };

    const rawCategory = categoryIdx !== -1 ? values[categoryIdx] : '';
    const category = normalizeCategory(rawCategory, safety_score, crimes_against_women, police_stations);

    const lightingVal = lightingIdx !== -1 ? parseFloat(values[lightingIdx]) : (safety_score >= 85 ? 90 : 65);
    const crowdVal = crowdIdx !== -1 ? parseFloat(values[crowdIdx]) : (safety_score >= 85 ? 85 : 55);
    const policePresenceVal = policePresenceIdx !== -1 ? parseFloat(values[policePresenceIdx]) : (police_stations * 25 + 20);

    let description = descIdx !== -1 && values[descIdx] ? values[descIdx] : '';
    if (!description) {
      description = `AI Safety Score: ${safety_score}/100. Crimes against women: ${crimes_against_women}, Police outposts: ${police_stations}, Hospitals: ${hospitals}.`;
    }

    points.push({
      id: `pt-${i}-${Date.now()}`,
      location_name: name,
      latitude: lat,
      longitude: lng,
      safety_score,
      category,
      lighting: isNaN(lightingVal) ? 80 : lightingVal,
      crowd: isNaN(crowdVal) ? 75 : crowdVal,
      police_presence: Math.min(100, Math.max(10, policePresenceVal)),
      description,
      crime_breakdown,
    });
  }

  return points;
}
