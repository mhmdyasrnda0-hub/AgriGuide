import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function getMapsApiKey(): string {
  return process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '';
}

function formatYyyymmdd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

function formatIsoDate(yyyymmdd: string): string {
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

function cleanPowerVal(v: unknown): number | null {
  if (typeof v !== 'number' || Number.isNaN(v) || v <= -900) return null;
  return Number(v.toFixed(2));
}

async function fetchJsonWithTimeout(url: string, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function extractJsonObject(raw: string): Record<string, any> {
  const cleaned = (raw || '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  if (!cleaned) {
    throw new Error('Empty JSON response from model.');
  }
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error('Model returned malformed JSON payload.');
  }
}

function isTransientError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes('429') ||
    msg.includes('500') ||
    msg.includes('502') ||
    msg.includes('503') ||
    msg.includes('504') ||
    msg.includes('resource_exhausted') ||
    msg.includes('unavailable') ||
    msg.includes('timeout') ||
    msg.includes('econnreset') ||
    msg.includes('fetch failed')
  );
}

async function withTransientRetry<T>(fn: () => Promise<T>, maxRetries = 1): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < maxRetries && isTransientError(err)) {
        await new Promise((r) => setTimeout(r, 650 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

function parseReadableGeminiError(err: unknown, fallback = 'AI service temporarily unavailable.'): string {
  const raw = err instanceof Error ? err.message : String(err || '');
  if (!raw.trim()) return fallback;
  const braceIdx = raw.indexOf('{');
  if (braceIdx !== -1) {
    try {
      const parsed = JSON.parse(raw.slice(braceIdx));
      const innerMsg = parsed?.error?.message || parsed?.message;
      if (typeof innerMsg === 'string' && innerMsg.trim()) {
        return innerMsg.trim();
      }
    } catch {
      // Ignore parse failure and fall back to text cleaning
    }
  }
  return raw.replace(/\s+/g, ' ').trim().slice(0, 220);
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'field-shift-api',
      aiConfigured: Boolean(getGeminiClient()),
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/maps-config', (_req, res) => {
    res.json({ apiKey: getMapsApiKey() });
  });

  // Server-side geocoding proxy (avoids browser CORS issues)
  app.get('/api/geocode', async (req, res) => {
    const query = String(req.query.q || '').trim();
    const lat = req.query.lat ? Number(req.query.lat) : null;
    const lng = req.query.lng ? Number(req.query.lng) : null;
    const mapsKey = getMapsApiKey();

    try {
      if (mapsKey) {
        const url =
          lat !== null && lng !== null && !Number.isNaN(lat) && !Number.isNaN(lng)
            ? `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${encodeURIComponent(mapsKey)}`
            : `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${encodeURIComponent(mapsKey)}`;
        const data = await fetchJsonWithTimeout(url, 8000);
        if (data.status === 'OVER_QUERY_LIMIT' || data.status === 'REQUEST_DENIED') {
          return res.status(429).json({ error: data.error_message || data.status, quotaExceeded: true });
        }
        const first = data.results?.[0];
        if (first) {
          return res.json({
            formattedAddress: first.formatted_address,
            lat: first.geometry.location.lat,
            lng: first.geometry.location.lng,
            source: 'Google Maps Geocoding API',
          });
        }
      }

      // OpenStreetMap Nominatim fallback when Maps Geocoding REST is unavailable or returns empty
      if (query) {
        const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(query)}`;
        const resNom = await fetch(nomUrl, {
          headers: { 'User-Agent': 'FieldShift-ClimateAgronomy/1.0' },
        });
        if (resNom.ok) {
          const items = (await resNom.json()) as Array<{ display_name: string; lat: string; lon: string }>;
          if (items.length > 0) {
            return res.json({
              formattedAddress: items[0].display_name,
              lat: Number(items[0].lat),
              lng: Number(items[0].lon),
              suggestions: items.map((i) => ({
                label: i.display_name,
                lat: Number(i.lat),
                lng: Number(i.lon),
              })),
              source: 'OpenStreetMap Nominatim',
            });
          }
        }
      }
      return res.status(404).json({ error: 'Location not found. Try a broader city, governorate, or drop a pin on the map.' });
    } catch (err) {
      return res.status(502).json({ error: err instanceof Error ? err.message : 'Geocoding lookup failed' });
    }
  });

  // Real NASA POWER + Climatology + Elevation + SoilGrids Earth Intelligence connector
  app.get('/api/earth-intelligence', async (req, res) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const farmId = String(req.query.farmId || 'active');

    if (Number.isNaN(lat) || Number.isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ error: 'Valid latitude and longitude coordinates are required.' });
    }

    // Use real wall-clock UTC time minus 2 days so NASA POWER daily archive has finalized satellite observations
    const now = new Date();
    // Clamp upper date if system clock is in future relative to real-time NASA archive, or probe dynamically
    const endDate = new Date(now.getTime() - 3 * 86400 * 1000);
    const startDate = new Date(endDate.getTime() - 20 * 86400 * 1000);

    const buildPowerDailyUrl = (start: Date, end: Date) =>
      `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M,T2M_MAX,T2M_MIN,PRECTOTCORR,ALLSKY_SFC_SW_DWN,RH2M,GWETTOP,GWETROOT&community=AG&longitude=${lng.toFixed(4)}&latitude=${lat.toFixed(4)}&start=${formatYyyymmdd(start)}&end=${formatYyyymmdd(end)}&format=JSON`;

    const climUrl = `https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=T2M,PRECTOTCORR,ALLSKY_SFC_SW_DWN&community=AG&longitude=${lng.toFixed(4)}&latitude=${lat.toFixed(4)}&format=JSON`;

    const parsePowerSeries = (json: any) => {
      const p = json?.properties?.parameter;
      if (!p || !p.T2M) return { params: null, validSeries: [] as any[], dates: [] as string[] };
      const dates = Object.keys(p.T2M).sort();
      const series = dates
        .map((d) => ({
          date: formatIsoDate(d),
          t2m: cleanPowerVal(p.T2M?.[d]),
          t2mMax: cleanPowerVal(p.T2M_MAX?.[d]),
          t2mMin: cleanPowerVal(p.T2M_MIN?.[d]),
          precipMm: cleanPowerVal(p.PRECTOTCORR?.[d]),
          solarMjM2: cleanPowerVal(p.ALLSKY_SFC_SW_DWN?.[d]),
          rh2m: cleanPowerVal(p.RH2M?.[d]),
          soilWetnessTop: cleanPowerVal(p.GWETTOP?.[d]),
          soilWetnessRoot: cleanPowerVal(p.GWETROOT?.[d]),
        }))
        .filter((pt) => pt.t2m !== null)
        .slice(-14);
      return { params: p, validSeries: series, dates };
    };

    try {
      let dailyJson: any = null;
      let parsedDaily = { params: null as any, validSeries: [] as any[], dates: [] as string[] };
      try {
        dailyJson = await fetchJsonWithTimeout(buildPowerDailyUrl(startDate, endDate), 12000);
        parsedDaily = parsePowerSeries(dailyJson);
      } catch {
        // Fall through to archive window check
      }

      if (parsedDaily.validSeries.length === 0) {
        // Retry against recent real NASA POWER archive window (handles archive latency or future system clock)
        const candidates = [
          new Date(Date.UTC(2025, now.getUTCMonth(), now.getUTCDate())),
          new Date(Date.UTC(2025, 9, 15)),
        ];
        for (const candEnd of candidates) {
          try {
            const candStart = new Date(candEnd.getTime() - 20 * 86400 * 1000);
            const fallbackJson = await fetchJsonWithTimeout(buildPowerDailyUrl(candStart, candEnd), 12000);
            const fallbackParsed = parsePowerSeries(fallbackJson);
            if (fallbackParsed.validSeries.length > 0) {
              dailyJson = fallbackJson;
              parsedDaily = fallbackParsed;
              break;
            }
          } catch {
            // Try next candidate
          }
        }
      }

      const params = parsedDaily.params;
      const dates = parsedDaily.dates;
      const validSeries = parsedDaily.validSeries;

      if (!params || validSeries.length === 0) {
        throw new Error('NASA POWER returned no valid daily observations for these coordinates.');
      }

      // Fetch climatology baseline and optional SoilGrids + Elevation in parallel
      const mapsKey = getMapsApiKey();
      const [climResult, elevResult, soilResult] = await Promise.allSettled([
        fetchJsonWithTimeout(climUrl, 9000),
        mapsKey
          ? fetchJsonWithTimeout(
              `https://maps.googleapis.com/maps/api/elevation/json?locations=${lat},${lng}&key=${encodeURIComponent(mapsKey)}`,
              6000
            )
          : fetchJsonWithTimeout(
              `https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lng}`,
              5000
            ),
        fetchJsonWithTimeout(
          `https://rest.isric.org/soilgrids/v2.0/properties/query?lon=${lng.toFixed(4)}&lat=${lat.toFixed(4)}&property=phh2o&property=clay&property=sand&property=soc&depth=0-5cm&value=mean`,
          5000
        ),
      ]);

      const avg = (arr: Array<number | null>): number | null => {
        const nums = arr.filter((x): x is number => x !== null);
        if (nums.length === 0) return null;
        return Number((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2));
      };

      const avgTempC = avg(validSeries.map((s) => s.t2m));
      const maxVals = validSeries.map((s) => s.t2mMax).filter((x): x is number => x !== null);
      const minVals = validSeries.map((s) => s.t2mMin).filter((x): x is number => x !== null);
      const maxTempC = maxVals.length ? Math.max(...maxVals) : null;
      const minTempC = minVals.length ? Math.min(...minVals) : null;
      const precipVals = validSeries.map((s) => s.precipMm).filter((x): x is number => x !== null);
      const totalPrecip14dMm = precipVals.length
        ? Number(precipVals.reduce((a, b) => a + b, 0).toFixed(1))
        : null;
      const avgSolarMjM2 = avg(validSeries.map((s) => s.solarMjM2));
      const avgHumidityPct = avg(validSeries.map((s) => s.rh2m));
      const soilWetnessIndex = avg(validSeries.map((s) => s.soilWetnessTop));

      const rootWetVals = dates
        .slice(-14)
        .map((d) => cleanPowerVal(params.GWETROOT?.[d]));
      const rootSoilWetnessIndex = avg(rootWetVals);

      // Baseline climatology for the month of the latest date
      const latestIso = validSeries[validSeries.length - 1].date;
      const monthIdx = Number(latestIso.slice(5, 7)) - 1;
      const monthKeys = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
      const mKey = monthKeys[monthIdx] || 'JAN';

      let baselineTemp: number | null = null;
      let baselinePrecip14d: number | null = null;
      if (climResult.status === 'fulfilled') {
        const cParams = climResult.value?.properties?.parameter;
        baselineTemp = cleanPowerVal(cParams?.T2M?.[mKey]);
        const dailyClimPrecip = cleanPowerVal(cParams?.PRECTOTCORR?.[mKey]);
        if (dailyClimPrecip !== null) {
          baselinePrecip14d = Number((dailyClimPrecip * 14).toFixed(1));
        }
      }

      // Elevation
      let elevationMeters: number | null = null;
      let elevationSource = 'Unavailable';
      if (elevResult.status === 'fulfilled') {
        if (elevResult.value?.results?.[0]?.elevation !== undefined) {
          elevationMeters = Math.round(elevResult.value.results[0].elevation);
          elevationSource = mapsKey ? 'Google Maps Elevation API' : 'Open-Elevation SRTM';
        }
      }

      // SoilGrids reference
      let soilGridsReference: any = null;
      if (soilResult.status === 'fulfilled' && Array.isArray(soilResult.value?.properties?.layers)) {
        const layers = soilResult.value.properties.layers;
        const findLayerMean = (name: string) => {
          const l = layers.find((x: any) => x.name === name);
          const v = l?.depths?.[0]?.values?.mean;
          return typeof v === 'number' ? v : null;
        };
        const phRaw = findLayerMean('phh2o');
        const clayRaw = findLayerMean('clay');
        const sandRaw = findLayerMean('sand');
        const socRaw = findLayerMean('soc');
        if (phRaw !== null || clayRaw !== null) {
          soilGridsReference = {
            phH2o: phRaw !== null ? Number((phRaw / 10).toFixed(1)) : null,
            clayPct: clayRaw !== null ? Number((clayRaw / 10).toFixed(1)) : null,
            sandPct: sandRaw !== null ? Number((sandRaw / 10).toFixed(1)) : null,
            organicCarbonGKg: socRaw !== null ? Number((socRaw / 10).toFixed(1)) : null,
            source: 'ISRIC SoilGrids v2.0 (0–5 cm)',
            spatialResolution: '250m global soil prediction grid',
            timestamp: new Date().toISOString(),
          };
        }
      }

      const fetchedAt = new Date().toISOString();
      const rangeStart = validSeries[0].date;
      const rangeEnd = validSeries[validSeries.length - 1].date;
      const ageDays = Math.round((Date.now() - new Date(rangeEnd).getTime()) / 86400000);
      const isStale = ageDays > 10;

      const tempDelta =
        avgTempC !== null && baselineTemp !== null
          ? Number((avgTempC - baselineTemp).toFixed(1))
          : null;

      const metrics = [
        {
          id: 'air_temp',
          name: 'Air Temperature (2m Mean)',
          nameAr: 'درجة حرارة الهواء (متوسط 2م)',
          value: avgTempC,
          unit: '°C',
          baselineValue: baselineTemp,
          baselineDelta: tempDelta,
          source: 'NASA POWER (MERRA-2 / GEOS)',
          timestamp: rangeEnd,
          updateFrequency: 'Daily (2–4 day archive latency)',
          provenance: 'satellite-derived estimate',
          spatialResolution: '0.5° × 0.625° (~50 km grid)',
          status:
            avgTempC === null
              ? 'data unavailable'
              : avgTempC > 33
              ? 'elevated'
              : avgTempC < 8
              ? 'below typical range'
              : 'suitable',
          interpretation:
            avgTempC === null
              ? 'Unavailable'
              : tempDelta !== null
              ? `${tempDelta >= 0 ? '+' : ''}${tempDelta}°C vs ${mKey} climatology baseline (${baselineTemp}°C)`
              : 'Within typical agricultural thermal range',
          interpretationAr:
            avgTempC === null
              ? 'غير متوفر'
              : tempDelta !== null
              ? `${tempDelta >= 0 ? '+' : ''}${tempDelta}°م مقارنة بالمتوسط المناخي (${baselineTemp}°م)`
              : 'ضمن النطاق الحراري الزراعي المعتاد',
          confidenceNote: 'Regional reanalysis grid; field microclimate may differ by 1–3°C.',
          parameterCode: 'T2M',
        },
        {
          id: 'rainfall_14d',
          name: '14-Day Cumulative Precipitation',
          nameAr: 'الهطول المطري التراكمي (14 يوماً)',
          value: totalPrecip14dMm,
          unit: 'mm',
          baselineValue: baselinePrecip14d,
          baselineDelta:
            totalPrecip14dMm !== null && baselinePrecip14d !== null
              ? Number((totalPrecip14dMm - baselinePrecip14d).toFixed(1))
              : null,
          source: 'NASA POWER (GPM IMERG / MERRA-2)',
          timestamp: rangeEnd,
          updateFrequency: 'Daily',
          provenance: 'satellite-derived estimate',
          spatialResolution: '0.5° × 0.625° grid',
          status:
            totalPrecip14dMm === null
              ? 'data unavailable'
              : totalPrecip14dMm < 5
              ? 'below typical range'
              : totalPrecip14dMm > 60
              ? 'elevated'
              : 'suitable',
          interpretation:
            totalPrecip14dMm === null
              ? 'Unavailable'
              : totalPrecip14dMm < 5
              ? 'Dry recent 14-day window; relies on irrigation or stored subsoil moisture'
              : 'Active recent rainfall recorded across grid cell',
          interpretationAr:
            totalPrecip14dMm === null
              ? 'غير متوفر'
              : totalPrecip14dMm < 5
              ? 'فترة جافة خلال آخر 14 يوماً؛ يعتمد على الري أو رطوبة التربة المخزنة'
              : 'سُجل هطول مطري فعلي خلال آخر 14 يوماً',
          confidenceNote: 'Localized convective showers can differ from gridded rainfall.',
          parameterCode: 'PRECTOTCORR',
        },
        {
          id: 'solar_radiation',
          name: 'All-Sky Solar Insolation',
          nameAr: 'الإشعاع الشمسي السطحي',
          value: avgSolarMjM2,
          unit: 'MJ/m²/day',
          source: 'NASA POWER (CERES SYN1deg)',
          timestamp: rangeEnd,
          updateFrequency: 'Daily',
          provenance: 'satellite-derived estimate',
          spatialResolution: '1.0° × 1.0° satellite grid',
          status: avgSolarMjM2 === null ? 'data unavailable' : avgSolarMjM2 > 26 ? 'elevated' : 'suitable',
          interpretation:
            avgSolarMjM2 === null
              ? 'Unavailable'
              : avgSolarMjM2 >= 16
              ? 'Strong solar energy supporting photosynthesis and biomass growth'
              : 'Moderate/low solar insolation (cloud cover or winter angle)',
          interpretationAr:
            avgSolarMjM2 === null
              ? 'غير متوفر'
              : avgSolarMjM2 >= 16
              ? 'طاقة شمسية قوية تدعم البناء الضوئي ونمو المحاصيل'
              : 'إشعاع شمسي متوسط أو منخفض (غيوم أو زاوية شتوية)',
          confidenceNote: 'Derived from satellite cloud & top-of-atmosphere radiation products.',
          parameterCode: 'ALLSKY_SFC_SW_DWN',
        },
        {
          id: 'soil_wetness',
          name: 'Surface Soil Wetness Index',
          nameAr: 'مؤشر رطوبة التربة السطحية',
          value: soilWetnessIndex !== null ? Math.round(soilWetnessIndex * 100) : null,
          unit: '%',
          source: 'NASA POWER (MERRA-2 Land Surface)',
          timestamp: rangeEnd,
          updateFrequency: 'Daily',
          provenance: 'satellite-derived estimate',
          spatialResolution: '0.5° × 0.625° (requires local verification)',
          status:
            soilWetnessIndex === null
              ? 'data unavailable'
              : soilWetnessIndex < 0.25
              ? 'below typical range'
              : soilWetnessIndex > 0.78
              ? 'elevated'
              : 'requires local verification',
          interpretation:
            soilWetnessIndex === null
              ? 'Unavailable'
              : soilWetnessIndex < 0.28
              ? 'Low surface moisture index — verify topsoil moisture before seeding'
              : 'Moderate modeled surface wetness (does not reflect private field irrigation)',
          interpretationAr:
            soilWetnessIndex === null
              ? 'غير متوفر'
              : soilWetnessIndex < 0.28
              ? 'مؤشر رطوبة سطحية منخفض — تحقق من رطوبة الحقل قبل البذر'
              : 'رطوبة سطحية متوسطة (لا تعكس الري الخاص بالحقل)',
          confidenceNote: 'Modeled land-surface wetness does not account for individual farm irrigation.',
          parameterCode: 'GWETTOP',
        },
        {
          id: 'humidity',
          name: 'Relative Humidity (2m)',
          nameAr: 'الرطوبة النسبية',
          value: avgHumidityPct,
          unit: '%',
          source: 'NASA POWER (MERRA-2)',
          timestamp: rangeEnd,
          updateFrequency: 'Daily',
          provenance: 'satellite-derived estimate',
          spatialResolution: '0.5° × 0.625°',
          status: avgHumidityPct === null ? 'data unavailable' : avgHumidityPct > 80 ? 'elevated' : 'suitable',
          interpretation:
            avgHumidityPct === null
              ? 'Unavailable'
              : avgHumidityPct > 78
              ? 'High canopy humidity increases fungal disease watch'
              : 'Balanced relative humidity',
          interpretationAr:
            avgHumidityPct === null
              ? 'غير متوفر'
              : avgHumidityPct > 78
              ? 'رطوبة جوية مرتفعة تستدعي مراقبة الأمراض الفطرية'
              : 'رطوبة نسبية متوازنة',
          confidenceNote: 'Irrigated fields may have higher local canopy humidity.',
          parameterCode: 'RH2M',
        },
      ];

      return res.json({
        id: `env_${Date.now()}`,
        farmId,
        lat,
        lng,
        fetchedAt,
        dataDateRange: { start: rangeStart, end: rangeEnd },
        isStale,
        elevationMeters,
        elevationSource,
        metrics,
        dailySeries: validSeries,
        summary: {
          avgTempC,
          maxTempC,
          minTempC,
          totalPrecip14dMm,
          baselineAnnualMonthlyAvgTempC: baselineTemp,
          baselinePeriodPrecip14dMm: baselinePrecip14d,
          avgSolarMjM2,
          avgHumidityPct,
          soilWetnessIndex,
          rootSoilWetnessIndex,
        },
        soilGridsReference,
        limitations: [
          'Field Shift is not an official NASA product. NASA POWER data is provided via NASA Langley Research Center POWER API.',
          'Satellite & reanalysis grids (0.5° × 0.625° / 1° × 1°) represent regional conditions and may not capture micro-topography or private farm irrigation.',
          ...(isStale ? [`Latest available NASA archive observation (${rangeEnd}) is over 10 days old relative to current system time.`] : []),
        ],
        sourceAttribution: [
          'NASA POWER Agricultural Meteorology & Solar API (power.larc.nasa.gov)',
          ...(elevationMeters !== null ? [elevationSource] : []),
          ...(soilGridsReference ? ['ISRIC SoilGrids v2.0 (250m)'] : []),
        ],
      });
    } catch (err) {
      return res.status(503).json({
        error:
          err instanceof Error
            ? `Live NASA POWER service unavailable: ${err.message}`
            : 'Unable to reach live NASA POWER Earth-observation API.',
      });
    }
  });

  // Fast structured extraction from natural language (English or Arabic) using gemini-3.1-flash-lite
  app.post('/api/ai/extract-farm', async (req, res) => {
    const text = String(req.body?.text || '').trim();
    if (!text) {
      return res.status(400).json({ error: 'Input text is required.' });
    }
    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({ error: 'Gemini API key is not configured on the server.' });
    }

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: `Extract agricultural farm details from this farmer note (English or Arabic). Do NOT invent values that were not mentioned. If a field is not clearly stated, leave it null/unknown and list it in ambiguousFields.\n\nFarmer input:\n"""${text}"""`,
        config: {
          systemInstruction:
            'You are a strict agricultural data extraction parser. Only extract facts explicitly stated by the user. Never fabricate coordinates, soil pH, or crops.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              farmName: { type: Type.STRING, nullable: true },
              locationQuery: { type: Type.STRING, nullable: true },
              areaHectares: { type: Type.NUMBER, nullable: true },
              previousCrop: {
                type: Type.STRING,
                enum: ['wheat', 'rice', 'faba_beans', 'cotton', 'maize', 'fallow', 'unknown'],
              },
              currentCrop: {
                type: Type.STRING,
                enum: ['wheat', 'rice', 'faba_beans', 'cotton', 'maize', 'none', 'unknown'],
              },
              season: {
                type: Type.STRING,
                enum: ['winter', 'spring', 'summer', 'autumn', 'unknown'],
              },
              waterAvailability: {
                type: Type.STRING,
                enum: ['abundant', 'moderate', 'limited', 'scarce', 'unknown'],
              },
              goal: {
                type: Type.STRING,
                enum: ['yield_stability', 'water_conservation', 'soil_recovery', 'drought_resilience', 'forage_production', 'unknown'],
              },
              soilPh: { type: Type.NUMBER, nullable: true },
              soilEcDsM: { type: Type.NUMBER, nullable: true },
              soilTexture: {
                type: Type.STRING,
                enum: ['sandy', 'loam', 'clay_loam', 'clay', 'silty_loam', 'unknown'],
              },
              ambiguousFields: { type: Type.ARRAY, items: { type: Type.STRING } },
              clarificationQuestion: { type: Type.STRING, nullable: true },
            },
            required: ['previousCrop', 'currentCrop', 'season', 'waterAvailability', 'goal', 'ambiguousFields'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      return res.json({ extracted: parsed, model: 'gemini-3.1-flash-lite' });
    } catch (err) {
      return res.status(isTransientError(err) ? 503 : 502).json({
        error: parseReadableGeminiError(err, 'Extraction failed'),
      });
    }
  });

  // Audio transcription using gemini-3.5-transcribe + structured extraction
  app.post('/api/ai/transcribe', async (req, res) => {
    const audioBase64 = String(req.body?.audioBase64 || '');
    const mimeType = String(req.body?.mimeType || 'audio/webm');
    if (!audioBase64) {
      return res.status(400).json({ error: 'Audio recording payload is required.' });
    }
    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({ error: 'Gemini API key is not configured on the server.' });
    }

    try {
      const transcribeRes = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [
            { inlineData: { mimeType, data: audioBase64 } },
            { text: 'Transcribe this farmer voice note accurately in its original language (Arabic or English). Output only the transcript.' },
          ],
        },
      });
      const transcript = (transcribeRes.text || '').trim();
      if (!transcript) {
        return res.status(422).json({ error: 'No speech detected in the recording. Please speak closer to the microphone and retry.' });
      }

      const extractRes = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: `Extract explicitly mentioned farm facts from this voice transcript:\n"""${transcript}"""`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              locationQuery: { type: Type.STRING, nullable: true },
              areaHectares: { type: Type.NUMBER, nullable: true },
              previousCrop: {
                type: Type.STRING,
                enum: ['wheat', 'rice', 'faba_beans', 'cotton', 'maize', 'fallow', 'unknown'],
              },
              currentCrop: {
                type: Type.STRING,
                enum: ['wheat', 'rice', 'faba_beans', 'cotton', 'maize', 'none', 'unknown'],
              },
              season: {
                type: Type.STRING,
                enum: ['winter', 'spring', 'summer', 'autumn', 'unknown'],
              },
              waterAvailability: {
                type: Type.STRING,
                enum: ['abundant', 'moderate', 'limited', 'scarce', 'unknown'],
              },
              goal: {
                type: Type.STRING,
                enum: ['yield_stability', 'water_conservation', 'soil_recovery', 'drought_resilience', 'forage_production', 'unknown'],
              },
              ambiguousFields: { type: Type.ARRAY, items: { type: Type.STRING } },
              clarificationQuestion: { type: Type.STRING, nullable: true },
            },
            required: ['previousCrop', 'currentCrop', 'season', 'waterAvailability', 'goal', 'ambiguousFields'],
          },
        },
      });

      const extracted = JSON.parse(extractRes.text || '{}');
      return res.json({
        transcript,
        extracted,
        models: ['gemini-3.5-transcribe', 'gemini-3.1-flash-lite'],
      });
    } catch (err) {
      return res.status(isTransientError(err) ? 503 : 502).json({
        error: parseReadableGeminiError(err, 'Transcription failed'),
      });
    }
  });

  // Rebuilt AI Field Scan: Crop photo, soil surface, and soil lab report OCR
  app.post('/api/ai/scan', async (req, res) => {
    const rawImage = String(req.body?.imageBase64 || '').trim();
    const dataUrlMatch = rawImage.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    const imageBase64 = dataUrlMatch ? dataUrlMatch[2] : rawImage;
    const mimeType = String(req.body?.mimeType || (dataUrlMatch ? dataUrlMatch[1] : 'image/jpeg'));
    const scanType = String(req.body?.scanType || 'crop_photo');
    const language = req.body?.language === 'ar' ? 'ar' : 'en';
    const envContext = req.body?.envContext || null;
    const farmContext = req.body?.farmContext || null;

    if (!imageBase64 || imageBase64.length < 32) {
      return res.status(400).json({ error: 'A valid image is required for AI Field Scan.' });
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
      return res.status(400).json({ error: 'Unsupported image format. Upload JPEG, PNG, or WebP.' });
    }
    if (!['crop_photo', 'soil_surface', 'soil_report_ocr'].includes(scanType)) {
      return res.status(400).json({ error: 'Invalid scan category requested.' });
    }
    if (imageBase64.length > 11_000_000) {
      return res.status(400).json({ error: 'Image file exceeds the 8 MB upload limit.' });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({
        error:
          language === 'ar'
            ? 'خدمة التحليل الذكي غير مهيأة على الخادم حالياً (GEMINI_API_KEY مفقود).'
            : 'Gemini API key is not configured on the server.',
      });
    }

    try {
      const targetLang = language === 'ar' ? 'clear Arabic' : 'clear English';
      const prompt = `Analyze this agricultural image for Field Shift (scanType="${scanType}").
Supported crops ONLY from the verified crop database: Wheat (Triticum aestivum), Rice (Oryza Sativa), Faba Beans (Viciafaba), Cotton (Gossypium), Maize (Zea Mays).

CRITICAL SAFETY & HONESTY RULES:
1. First inspect image clarity, framing, lighting, and agricultural relevance. If too dark, blurry, obstructed, or NOT a plant/soil/soil-lab document, mark qualityStatus as "low_quality" or "irrelevant" and explain how to retake cleanly.
2. If the crop visible is clearly NOT one of the 5 database crops (Wheat, Rice, Faba Beans, Cotton, Maize), mark qualityStatus as "unsupported_crop", detectedCrop as "unsupported", and name what appears visible.
3. Never claim a definitive lab disease diagnosis or yield guarantee. Frame all findings strictly as "preliminary visual indicator" or "visually consistent with — requires field verification".
4. NEVER prescribe pesticide chemical dosages or specific chemical treatments.
5. If scanType is "soil_report_ocr", extract only legible numeric values into ocrSoilValues; set unreadable fields to null.
6. Correlate visual cues ONLY with the real connected environmental record below; never invent environmental values if null.

Farm Context: ${JSON.stringify(farmContext || {})}
Connected Environmental Record: ${JSON.stringify(envContext || 'Not yet fetched')}`;

      const scanSchema = {
        type: Type.OBJECT,
        properties: {
          qualityStatus: {
            type: Type.STRING,
            enum: ['usable', 'low_quality', 'unsupported_crop', 'irrelevant'],
          },
          qualityReason: { type: Type.STRING },
          detectedCrop: {
            type: Type.STRING,
            enum: ['wheat', 'rice', 'faba_beans', 'cotton', 'maize', 'unsupported', 'soil_only', 'unknown'],
          },
          detectedCropLabel: { type: Type.STRING },
          preliminaryAssessment: { type: Type.STRING },
          confidenceLevel: { type: Type.STRING, enum: ['high', 'moderate', 'low'] },
          confidenceScore: { type: Type.NUMBER },
          visualEvidence: { type: Type.ARRAY, items: { type: Type.STRING } },
          stressCategories: {
            type: Type.ARRAY,
            items: {
              type: Type.STRING,
              enum: [
                'water_stress',
                'heat_stress',
                'nutrient_discoloration',
                'lesion_or_pest',
                'soil_crust_or_salinity',
                'healthy_vigor',
                'none',
              ],
            },
          },
          environmentalCorrelation: { type: Type.STRING },
          suggestedNextSteps: { type: Type.ARRAY, items: { type: Type.STRING } },
          limitations: { type: Type.ARRAY, items: { type: Type.STRING } },
          ocrSoilValues: {
            type: Type.OBJECT,
            nullable: true,
            properties: {
              ph: { type: Type.NUMBER, nullable: true },
              ecSalinityDsM: { type: Type.NUMBER, nullable: true },
              nitrogenPpm: { type: Type.NUMBER, nullable: true },
              phosphorusPpm: { type: Type.NUMBER, nullable: true },
              potassiumPpm: { type: Type.NUMBER, nullable: true },
              organicMatterPct: { type: Type.NUMBER, nullable: true },
              texture: {
                type: Type.STRING,
                nullable: true,
                enum: ['sandy', 'loam', 'clay_loam', 'clay', 'silty_loam', 'unknown'],
              },
              labDate: { type: Type.STRING, nullable: true },
              rawNotes: { type: Type.STRING, nullable: true },
            },
          },
        },
        required: [
          'qualityStatus',
          'qualityReason',
          'detectedCrop',
          'detectedCropLabel',
          'preliminaryAssessment',
          'confidenceLevel',
          'confidenceScore',
          'visualEvidence',
          'stressCategories',
          'environmentalCorrelation',
          'suggestedNextSteps',
          'limitations',
        ],
      };

      const scanContents = {
        parts: [
          { inlineData: { mimeType, data: imageBase64 } },
          { text: prompt },
        ],
      };

      let modelUsed = 'gemini-4-hydrogen';
      let response;
      try {
        response = await withTransientRetry(() =>
          ai.models.generateContent({
            model: 'gemini-4-hydrogen',
            contents: scanContents,
            config: {
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
              responseMimeType: 'application/json',
              responseSchema: scanSchema,
            },
          })
        );
      } catch (primaryErr) {
        if (!isTransientError(primaryErr)) {
          throw primaryErr;
        }
        modelUsed = 'gemini-3.1-flash-lite (fallback)';
        response = await withTransientRetry(() =>
          ai.models.generateContent({
            model: 'gemini-3.1-flash-lite',
            contents: scanContents,
            config: {
              responseMimeType: 'application/json',
              responseSchema: scanSchema,
            },
          })
        );
      }

      const parsed = extractJsonObject(response.text || '');
      const rawScore = typeof parsed.confidenceScore === 'number' ? parsed.confidenceScore : 50;
      const normalizedScore = Math.max(
        0,
        Math.min(100, Math.round(rawScore > 0 && rawScore <= 1 ? rawScore * 100 : rawScore))
      );

      return res.json({
        qualityStatus: parsed.qualityStatus || 'usable',
        qualityReason: String(parsed.qualityReason || ''),
        detectedCrop: parsed.detectedCrop || 'unknown',
        detectedCropLabel: String(parsed.detectedCropLabel || 'Field Subject'),
        preliminaryAssessment: String(parsed.preliminaryAssessment || 'Preliminary visual observation recorded.'),
        confidenceLevel: parsed.confidenceLevel || (normalizedScore >= 75 ? 'high' : normalizedScore >= 45 ? 'moderate' : 'low'),
        confidenceScore: normalizedScore,
        visualEvidence: Array.isArray(parsed.visualEvidence) ? parsed.visualEvidence.map(String) : [],
        stressCategories: Array.isArray(parsed.stressCategories) ? parsed.stressCategories : ['none'],
        environmentalCorrelation: String(
          parsed.environmentalCorrelation || 'No connected environmental record correlated yet.'
        ),
        suggestedNextSteps: Array.isArray(parsed.suggestedNextSteps) ? parsed.suggestedNextSteps.map(String) : [],
        limitations: Array.isArray(parsed.limitations)
          ? parsed.limitations.map(String)
          : ['Visual assessment is preliminary and requires field confirmation.'],
        ocrSoilValues: parsed.ocrSoilValues || undefined,
        modelVersion: modelUsed,
        provenance: 'AI-assisted visual assessment',
      });
    } catch (err) {
      const msg = parseReadableGeminiError(err, 'Field scan analysis failed');
      console.error('AI Field Scan error:', msg);
      const status = isTransientError(err) ? 503 : 422;
      return res.status(status).json({
        error:
          language === 'ar'
            ? `تعذر إتمام الفحص البصري الآن: ${msg}`
            : `Field scan could not complete: ${msg}`,
      });
    }
  });

  // Rebuilt Context-Aware Assistant (Ask Me & Action Center Field Copilot)
  app.post('/api/ai/copilot', async (req, res) => {
    const rawMessages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const context = req.body?.context || {};
    const pageContext = String(req.body?.pageContext || 'workspace');
    const groundingMode = String(req.body?.groundingMode || 'none'); // 'none' | 'search' | 'maps'
    const useDeepThinking = Boolean(req.body?.useDeepThinking);
    const structuredMode = req.body?.structuredMode !== false;
    const language = req.body?.language === 'ar' ? 'ar' : 'en';

    const messages = rawMessages
      .filter((m: any) => m && typeof m.text === 'string' && m.text.trim().length > 0)
      .slice(-14);

    if (messages.length === 0) {
      return res.status(400).json({ error: 'At least one user message is required.' });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({
        error:
          language === 'ar'
            ? 'خدمة المساعد الذكي غير مهيأة على الخادم حالياً (GEMINI_API_KEY مفقود).'
            : 'Gemini API key is not configured on the server.',
      });
    }

    try {
      const activeFarmName = context?.farm?.name || null;
      const contextUsed: string[] = [`View: ${pageContext}`];
      if (activeFarmName) contextUsed.push(`Farm: ${activeFarmName}`);
      if (context?.earthIntelligence) contextUsed.push('NASA POWER');
      if (context?.latestFieldScan) contextUsed.push('AI Field Scan');
      if (context?.decisionSummary) contextUsed.push('Decision Engine');
      if (context?.whatIfScenario) contextUsed.push('What-If Scenario');

      const responseFormatGuidance =
        structuredMode && groundingMode === 'none'
          ? `OUTPUT FORMAT: Return valid JSON with exactly these two keys:
- "reply": concise, clear, scannable primary answer (3–6 short sentences or bullet lines) using real connected numbers and distinguishing [Connected Data], [Calculated Output], and [Uncertainty]. Never include fake metrics.
- "technicalDetails": optional deeper agronomic / calculation / source explanation paragraph(s) or bullets for users who expand "Technical details", or empty string "" if none needed.`
          : `OUTPUT FORMAT: Keep the answer concise, well-structured, scannable, and clearly distinguish [Connected Data], [Calculated Output], [Agronomic Guidance], and [Uncertainty].`;

      const systemInstruction = `You are "Ask Me", the context-aware agricultural decision assistant inside Field Shift.
Respond in ${language === 'ar' ? 'clear, natural Arabic' : 'clear, concise English'}.
Current active workspace view: "${pageContext}".

STRICT DATA INTEGRITY RULES:
1. NEVER invent or hallucinate farm coordinates, soil pH/EC, NASA temperatures, rainfall, crop scores, or disease diagnoses.
2. If no farm is selected or a specific dataset (NASA POWER, soil lab test, or AI Field Scan) is missing, explicitly state what is missing and guide the user to capture or connect it in the appropriate tab.
3. Supported crops in Field Shift's Decision Engine are strictly: wheat, rice, faba_beans, cotton, and maize.
4. Never guarantee yield or profit, and never prescribe specific chemical pesticide dosages.
${responseFormatGuidance}

ACTIVE WORKSPACE CONTEXT:
${JSON.stringify(context)}`;

      const contents = messages.map((m: { role: string; text: string }) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.text }],
      }));

      const buildConfig = (modelName: string, mode: string) => {
        const cfg: any = {
          systemInstruction,
        };
        if (modelName === 'gemini-4-hydrogen') {
          cfg.thinkingConfig = {
            thinkingLevel: useDeepThinking ? ThinkingLevel.HIGH : ThinkingLevel.LOW,
          };
        }
        if (structuredMode && mode === 'none') {
          cfg.responseMimeType = 'application/json';
          cfg.responseSchema = {
            type: Type.OBJECT,
            properties: {
              reply: { type: Type.STRING },
              technicalDetails: { type: Type.STRING },
            },
            required: ['reply', 'technicalDetails'],
          };
        } else if (mode === 'search') {
          cfg.tools = [{ googleSearch: {} }];
        } else if (mode === 'maps') {
          cfg.tools = [{ googleMaps: {} }];
          const lat = context?.farm?.centerLat;
          const lng = context?.farm?.centerLng;
          if (typeof lat === 'number' && typeof lng === 'number') {
            cfg.toolConfig = {
              retrievalConfig: {
                latLng: { latitude: lat, longitude: lng },
              },
            };
          }
        }
        return cfg;
      };

      let usedFallbackNoTool = false;
      let effectiveMode = groundingMode;
      let modelUsed = 'gemini-4-hydrogen';
      let response;
      try {
        response = await withTransientRetry(() =>
          ai.models.generateContent({
            model: 'gemini-4-hydrogen',
            contents,
            config: buildConfig('gemini-4-hydrogen', effectiveMode),
          })
        );
      } catch (primaryErr) {
        if (groundingMode !== 'none' && !isTransientError(primaryErr)) {
          effectiveMode = 'none';
          usedFallbackNoTool = true;
          try {
            response = await withTransientRetry(() =>
              ai.models.generateContent({
                model: 'gemini-4-hydrogen',
                contents,
                config: buildConfig('gemini-4-hydrogen', 'none'),
              })
            );
          } catch (retryErr) {
            if (!isTransientError(retryErr)) throw retryErr;
            modelUsed = 'gemini-3.1-flash-lite (fallback)';
            response = await withTransientRetry(() =>
              ai.models.generateContent({
                model: 'gemini-3.1-flash-lite',
                contents,
                config: buildConfig('gemini-3.1-flash-lite', 'none'),
              })
            );
          }
        } else if (isTransientError(primaryErr)) {
          effectiveMode = 'none';
          usedFallbackNoTool = groundingMode !== 'none';
          modelUsed = 'gemini-3.1-flash-lite (fallback)';
          response = await withTransientRetry(() =>
            ai.models.generateContent({
              model: 'gemini-3.1-flash-lite',
              contents,
              config: buildConfig('gemini-3.1-flash-lite', 'none'),
            })
          );
        } else {
          throw primaryErr;
        }
      }

      let replyText = (response.text || '').trim();
      let technicalDetails = '';

      if (structuredMode && effectiveMode === 'none') {
        try {
          const parsed = extractJsonObject(replyText);
          replyText = String(parsed.reply || replyText);
          technicalDetails = String(parsed.technicalDetails || '');
        } catch {
          // Keep raw text safely if model answered in plain markdown
        }
      }

      if (usedFallbackNoTool) {
        const notice =
          language === 'ar'
            ? '\n\n(ملاحظة: تعذر الاتصال بأداة البحث الخارجي حالياً، لذا اعتمدت الإجابة على سياق مزرعتك المتصل فقط.)'
            : '\n\n(Note: External search/maps grounding was temporarily unavailable, so this reply uses your connected farm context only.)';
        replyText = `${replyText}${notice}`;
      }

      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const groundingUrls: Array<{ title: string; uri: string; type: 'search' | 'maps' }> = [];
      for (const c of chunks) {
        if (c.web?.uri) {
          groundingUrls.push({
            title: c.web.title || c.web.uri,
            uri: c.web.uri,
            type: 'search',
          });
        }
        if (c.maps?.uri) {
          groundingUrls.push({
            title: c.maps.title || 'View on Google Maps',
            uri: c.maps.uri,
            type: 'maps',
          });
        }
      }

      return res.json({
        reply: replyText || (language === 'ar' ? 'تعذر توليد رد.' : 'Unable to generate a response.'),
        technicalDetails,
        contextUsed,
        groundingUrls,
        usedThinking: modelUsed === 'gemini-4-hydrogen' && useDeepThinking,
        model: modelUsed,
      });
    } catch (err) {
      const msg = parseReadableGeminiError(err, 'Assistant request failed');
      console.error('AI Copilot error:', msg);
      const status = isTransientError(err) ? 503 : 422;
      return res.status(status).json({
        error:
          language === 'ar'
            ? `تعذر إتمام طلب المساعد الآن: ${msg}`
            : `Assistant could not respond: ${msg}`,
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Field Shift server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
