import {
  CurrentCropOption,
  DecisionWeights,
  EnvironmentalSnapshot,
  FarmGoal,
  FarmProfile,
  FieldScanResult,
  Language,
  PreviousCropOption,
  SeasonOption,
  SoilData,
  WaterAvailability,
} from '../types/fieldshift';
import { computePolygonAreaHectares, isValidCoordinate } from './geo';

const VALID_SEASONS: SeasonOption[] = ['winter', 'spring', 'summer', 'autumn'];
const VALID_WATER: WaterAvailability[] = ['abundant', 'moderate', 'limited', 'scarce'];
const VALID_GOALS: FarmGoal[] = [
  'yield_stability',
  'water_conservation',
  'soil_recovery',
  'drought_resilience',
  'forage_production',
];
const VALID_PREV_CROPS: PreviousCropOption[] = [
  'wheat',
  'rice',
  'faba_beans',
  'cotton',
  'maize',
  'fallow',
  'unknown',
];
const VALID_CURR_CROPS: CurrentCropOption[] = [
  'wheat',
  'rice',
  'faba_beans',
  'cotton',
  'maize',
  'none',
  'unknown',
];
const VALID_TEXTURES: NonNullable<SoilData['texture']>[] = [
  'sandy',
  'loam',
  'clay_loam',
  'clay',
  'silty_loam',
  'unknown',
];
const VALID_DRAINAGES: NonNullable<SoilData['drainage']>[] = [
  'well_drained',
  'moderate',
  'poor',
  'unknown',
];

function finiteInRange(val: unknown, min: number, max: number): number | undefined {
  if (typeof val !== 'number' || !Number.isFinite(val)) return undefined;
  if (val < min || val > max) return undefined;
  return Number(val.toFixed(2));
}

export function sanitizeSoilData(raw: SoilData | undefined | null): SoilData | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const ph = finiteInRange(raw.ph, 2.5, 10.5);
  const ecSalinityDsM = finiteInRange(raw.ecSalinityDsM, 0, 40);
  const nitrogenPpm = finiteInRange(raw.nitrogenPpm, 0, 2000);
  const phosphorusPpm = finiteInRange(raw.phosphorusPpm, 0, 1000);
  const potassiumPpm = finiteInRange(raw.potassiumPpm, 0, 5000);
  const organicMatterPct = finiteInRange(raw.organicMatterPct, 0, 40);
  const texture = raw.texture && VALID_TEXTURES.includes(raw.texture) ? raw.texture : undefined;
  const drainage = raw.drainage && VALID_DRAINAGES.includes(raw.drainage) ? raw.drainage : undefined;

  const hasAnyValue =
    ph !== undefined ||
    ecSalinityDsM !== undefined ||
    nitrogenPpm !== undefined ||
    phosphorusPpm !== undefined ||
    potassiumPpm !== undefined ||
    organicMatterPct !== undefined ||
    (texture && texture !== 'unknown') ||
    (drainage && drainage !== 'unknown');

  if (!hasAnyValue) return undefined;

  return {
    ph,
    ecSalinityDsM,
    nitrogenPpm,
    phosphorusPpm,
    potassiumPpm,
    organicMatterPct,
    texture: texture ?? 'unknown',
    drainage: drainage ?? 'unknown',
    source: raw.source || 'user-provided data',
    sourceLabel: raw.sourceLabel ? String(raw.sourceLabel).slice(0, 140) : undefined,
    recordedAt: raw.recordedAt || new Date().toISOString(),
  };
}

export function normalizeFarmProfile(raw: FarmProfile): FarmProfile {
  const safeLat = isValidCoordinate(raw.centerLat, raw.centerLng) ? Number(raw.centerLat.toFixed(6)) : 0;
  const safeLng = isValidCoordinate(raw.centerLat, raw.centerLng) ? Number(raw.centerLng.toFixed(6)) : 0;
  const validBoundary = Array.isArray(raw.boundary)
    ? raw.boundary.filter((pt) => pt && isValidCoordinate(pt.lat, pt.lng)).slice(0, 50)
    : undefined;

  const computedArea =
    validBoundary && validBoundary.length >= 3
      ? computePolygonAreaHectares(validBoundary)
      : raw.areaHectares;

  return {
    ...raw,
    id: String(raw.id || `farm_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_'),
    name: String(raw.name || '').trim().slice(0, 120) || 'Unnamed Parcel',
    locationLabel: String(raw.locationLabel || '').trim().slice(0, 200),
    centerLat: safeLat,
    centerLng: safeLng,
    locationAccuracyMode:
      validBoundary && validBoundary.length >= 3 ? 'polygon' : raw.locationAccuracyMode || 'point',
    boundary: validBoundary && validBoundary.length >= 3 ? validBoundary : undefined,
    areaHectares:
      typeof computedArea === 'number' && Number.isFinite(computedArea) && computedArea > 0
        ? Number(computedArea.toFixed(2))
        : undefined,
    previousCrop: VALID_PREV_CROPS.includes(raw.previousCrop) ? raw.previousCrop : 'unknown',
    currentCrop: VALID_CURR_CROPS.includes(raw.currentCrop) ? raw.currentCrop : 'unknown',
    season: VALID_SEASONS.includes(raw.season) ? raw.season : 'winter',
    waterAvailability: VALID_WATER.includes(raw.waterAvailability) ? raw.waterAvailability : 'moderate',
    goal: VALID_GOALS.includes(raw.goal) ? raw.goal : 'yield_stability',
    soilData: sanitizeSoilData(raw.soilData),
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function normalizeDecisionWeights(weights: DecisionWeights): DecisionWeights {
  const w = {
    water: Math.max(0, Number(weights.water) || 0),
    climate: Math.max(0, Number(weights.climate) || 0),
    soil: Math.max(0, Number(weights.soil) || 0),
    season: Math.max(0, Number(weights.season) || 0),
    rotation: Math.max(0, Number(weights.rotation) || 0),
  };
  const sum = w.water + w.climate + w.soil + w.season + w.rotation;
  if (sum <= 0) {
    return { water: 0.3, climate: 0.25, soil: 0.2, season: 0.15, rotation: 0.1 };
  }
  return {
    water: Number((w.water / sum).toFixed(4)),
    climate: Number((w.climate / sum).toFixed(4)),
    soil: Number((w.soil / sum).toFixed(4)),
    season: Number((w.season / sum).toFixed(4)),
    rotation: Number((w.rotation / sum).toFixed(4)),
  };
}

export function sanitizeEnvironmentalSnapshot(raw: unknown): EnvironmentalSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, any>;
  if (
    !obj.id ||
    !obj.summary ||
    !obj.dataDateRange ||
    !Array.isArray(obj.metrics) ||
    !Array.isArray(obj.dailySeries)
  ) {
    return null;
  }
  return obj as EnvironmentalSnapshot;
}

export function sanitizeFieldScanResponse(
  raw: unknown,
  farmId: string,
  scanType: FieldScanResult['scanType'],
  imageName: string,
  imagePreviewDataUrl?: string
): FieldScanResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Record<string, any>;
  const validStatus = ['usable', 'low_quality', 'unsupported_crop', 'irrelevant'].includes(d.qualityStatus)
    ? d.qualityStatus
    : 'usable';
  const rawScore = typeof d.confidenceScore === 'number' && Number.isFinite(d.confidenceScore)
    ? d.confidenceScore
    : 50;
  const normalizedScore = Math.max(0, Math.min(100, Math.round(rawScore > 0 && rawScore <= 1 ? rawScore * 100 : rawScore)));

  return {
    id: `scan_${Date.now()}`,
    farmId,
    scanType,
    imageName: imageName || 'field-image.jpg',
    imagePreviewDataUrl,
    analyzedAt: new Date().toISOString(),
    qualityStatus: validStatus,
    qualityReason: String(d.qualityReason || ''),
    detectedCrop: d.detectedCrop || 'unknown',
    detectedCropLabel: String(d.detectedCropLabel || 'Field Subject'),
    preliminaryAssessment: String(d.preliminaryAssessment || 'Preliminary visual observation recorded.'),
    confidenceLevel:
      d.confidenceLevel === 'high' || d.confidenceLevel === 'moderate' || d.confidenceLevel === 'low'
        ? d.confidenceLevel
        : normalizedScore >= 75
        ? 'high'
        : normalizedScore >= 45
        ? 'moderate'
        : 'low',
    confidenceScore: normalizedScore,
    visualEvidence: Array.isArray(d.visualEvidence) ? d.visualEvidence.map(String) : [],
    stressCategories: Array.isArray(d.stressCategories) ? d.stressCategories : ['none'],
    environmentalCorrelation: String(d.environmentalCorrelation || ''),
    suggestedNextSteps: Array.isArray(d.suggestedNextSteps) ? d.suggestedNextSteps.map(String) : [],
    limitations: Array.isArray(d.limitations)
      ? d.limitations.map(String)
      : ['Visual assessment is preliminary and requires local confirmation.'],
    ocrSoilValues: d.ocrSoilValues && typeof d.ocrSoilValues === 'object' ? d.ocrSoilValues : undefined,
    modelVersion: String(d.modelVersion || 'gemini-4-hydrogen'),
    provenance: 'AI-assisted visual assessment',
  };
}

export function validateEmailFormat(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

export function validateSignInInput(
  email: string,
  password: string,
  lang: Language
): string | null {
  const isAr = lang === 'ar';
  if (!email.trim()) {
    return isAr ? 'يرجى إدخال البريد الإلكتروني.' : 'Please enter your email address.';
  }
  if (!validateEmailFormat(email)) {
    return isAr ? 'صيغة البريد الإلكتروني غير صحيحة.' : 'Please enter a valid email address.';
  }
  if (!password) {
    return isAr ? 'يرجى إدخال كلمة المرور.' : 'Please enter your password.';
  }
  return null;
}

export function validateSignUpInput(
  firstName: string,
  lastName: string,
  email: string,
  password: string,
  lang: Language
): string | null {
  const isAr = lang === 'ar';
  if (!firstName.trim()) {
    return isAr ? 'يرجى إدخال الاسم الأول.' : 'First name is required.';
  }
  if (!lastName.trim()) {
    return isAr ? 'يرجى إدخال اسم العائلة.' : 'Last name is required.';
  }
  if (!validateEmailFormat(email)) {
    return isAr ? 'يرجى إدخال بريد إلكتروني صحيح.' : 'Please enter a valid email address.';
  }
  if (password.length < 8) {
    return isAr
      ? 'يجب أن تتكون كلمة المرور من 8 أحرف على الأقل.'
      : 'Password must be at least 8 characters long.';
  }
  return null;
}
