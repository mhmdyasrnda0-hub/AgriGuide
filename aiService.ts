import {
  ChatMessage,
  DecisionRun,
  EnvironmentalSnapshot,
  FarmProfile,
  FieldScanResult,
  Language,
  ScenarioInput,
  ScanCategory,
} from '../types/fieldshift';
import { sanitizeFieldScanResponse } from '../lib/validators';

export interface CopilotRequestParams {
  messages: Array<{ role: 'user' | 'assistant'; text: string }>;
  farm: FarmProfile | null;
  env: EnvironmentalSnapshot | null;
  latestScan: FieldScanResult | null;
  decision: DecisionRun | null;
  scenario: ScenarioInput;
  pageContext: string;
  groundingMode: 'none' | 'search' | 'maps';
  useDeepThinking: boolean;
  language: Language;
  signal?: AbortSignal;
}

export interface CopilotResponseResult {
  message: ChatMessage;
  model?: string;
}

/**
 * Single authoritative builder for Field Copilot & Ask Me workspace context payloads.
 * Strictly passes only connected/verified farm data and rule outputs.
 */
export function buildCopilotContextPayload(params: {
  farm: FarmProfile | null;
  env: EnvironmentalSnapshot | null;
  latestScan: FieldScanResult | null;
  decision: DecisionRun | null;
  scenario: ScenarioInput;
  pageContext: string;
}): Record<string, unknown> {
  const { farm, env, latestScan, decision, scenario, pageContext } = params;
  if (!farm) {
    return {
      farm: null,
      activeView: pageContext,
      note: 'No farm captured yet by user.',
    };
  }
  return {
    farm: {
      name: farm.name,
      locationLabel: farm.locationLabel,
      centerLat: farm.centerLat,
      centerLng: farm.centerLng,
      areaHectares: farm.areaHectares,
      season: farm.season,
      waterAvailability: farm.waterAvailability,
      previousCrop: farm.previousCrop,
      currentCrop: farm.currentCrop,
      goal: farm.goal,
      soilData: farm.soilData || null,
    },
    earthIntelligence: env
      ? {
          fetchedAt: env.fetchedAt,
          dataDateRange: env.dataDateRange,
          isStale: env.isStale,
          summary: env.summary,
          elevationMeters: env.elevationMeters,
          soilGridsReference: env.soilGridsReference,
        }
      : null,
    latestFieldScan: latestScan
      ? {
          scanType: latestScan.scanType,
          qualityStatus: latestScan.qualityStatus,
          detectedCropLabel: latestScan.detectedCropLabel,
          preliminaryAssessment: latestScan.preliminaryAssessment,
          confidenceScore: latestScan.confidenceScore,
          stressCategories: latestScan.stressCategories,
        }
      : null,
    decisionSummary: decision
      ? {
          ruleVersion: decision.ruleVersion,
          overallConfidenceScore: decision.overallConfidenceScore,
          missingInputs: decision.missingInputs,
          rankings: decision.evaluations.map((e) => ({
            rank: e.rank,
            crop: e.cropName,
            suitabilityIndex: e.suitabilityIndex,
            excluded: e.excluded,
            mainRisks: e.mainRisks.slice(0, 2),
          })),
        }
      : null,
    whatIfScenario: scenario,
  };
}

export async function requestFieldCopilot(
  params: CopilotRequestParams
): Promise<CopilotResponseResult> {
  const contextPayload = buildCopilotContextPayload({
    farm: params.farm,
    env: params.env,
    latestScan: params.latestScan,
    decision: params.decision,
    scenario: params.scenario,
    pageContext: params.pageContext,
  });

  const res = await fetch('/api/ai/copilot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: params.signal,
    body: JSON.stringify({
      messages: params.messages,
      context: contextPayload,
      pageContext: params.pageContext,
      groundingMode: params.groundingMode,
      useDeepThinking: params.useDeepThinking,
      structuredMode: true,
      language: params.language,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Assistant error (${res.status}).`);
  }

  return {
    message: {
      id: `msg_${Date.now()}_a`,
      role: 'assistant',
      text: String(data.reply || ''),
      technicalDetails: data.technicalDetails ? String(data.technicalDetails) : undefined,
      contextUsed: Array.isArray(data.contextUsed) ? data.contextUsed.map(String) : undefined,
      timestamp: new Date().toISOString(),
      groundingUrls: Array.isArray(data.groundingUrls) ? data.groundingUrls : [],
      usedThinking: Boolean(data.usedThinking),
    },
    model: data.model,
  };
}

export async function transcribeAudioNote(
  audioBase64: string,
  mimeType: string
): Promise<{ transcript: string; extracted: Record<string, any> }> {
  const res = await fetch('/api/ai/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audioBase64, mimeType }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Voice transcription failed (${res.status}).`);
  }
  return {
    transcript: String(data.transcript || ''),
    extracted: (data.extracted && typeof data.extracted === 'object' ? data.extracted : {}) as Record<
      string,
      any
    >,
  };
}

export async function extractFarmFromNote(
  text: string
): Promise<Record<string, any>> {
  const res = await fetch('/api/ai/extract-farm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Text extraction failed (${res.status}).`);
  }
  return (data.extracted && typeof data.extracted === 'object' ? data.extracted : {}) as Record<
    string,
    any
  >;
}

export async function requestAiFieldScan(params: {
  farm: FarmProfile;
  env: EnvironmentalSnapshot | null;
  imageBase64: string;
  mimeType: string;
  scanType: ScanCategory;
  imageName: string;
  imagePreviewDataUrl?: string;
  language: Language;
  signal?: AbortSignal;
}): Promise<FieldScanResult> {
  const res = await fetch('/api/ai/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: params.signal,
    body: JSON.stringify({
      imageBase64: params.imageBase64,
      mimeType: params.mimeType,
      scanType: params.scanType,
      language: params.language,
      farmContext: {
        name: params.farm.name,
        season: params.farm.season,
        currentCrop: params.farm.currentCrop,
        waterAvailability: params.farm.waterAvailability,
      },
      envContext: params.env
        ? {
            avgTempC: params.env.summary.avgTempC,
            maxTempC: params.env.summary.maxTempC,
            totalPrecip14dMm: params.env.summary.totalPrecip14dMm,
            avgHumidityPct: params.env.summary.avgHumidityPct,
            soilWetnessIndex: params.env.summary.soilWetnessIndex,
            dataDateRange: params.env.dataDateRange,
          }
        : null,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `AI Field Scan failed (${res.status})`);
  }

  const normalized = sanitizeFieldScanResponse(
    data,
    params.farm.id,
    params.scanType,
    params.imageName,
    params.imagePreviewDataUrl
  );
  if (!normalized) {
    throw new Error('Server returned an unreadable scan payload.');
  }
  return normalized;
}
