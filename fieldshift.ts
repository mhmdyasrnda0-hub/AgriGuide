export type Language = 'en' | 'ar';

export type CropId = 'wheat' | 'rice' | 'faba_beans' | 'cotton' | 'maize';

export type PreviousCropOption = CropId | 'fallow' | 'unknown';
export type CurrentCropOption = CropId | 'none' | 'unknown';
export type SeasonOption = 'winter' | 'spring' | 'summer' | 'autumn';
export type WaterAvailability = 'abundant' | 'moderate' | 'limited' | 'scarce';
export type FarmGoal =
  | 'yield_stability'
  | 'water_conservation'
  | 'soil_recovery'
  | 'drought_resilience'
  | 'forage_production';

export type LocationAccuracyMode = 'polygon' | 'gps' | 'point' | 'approximate';

export type DataProvenanceLabel =
  | 'measured data'
  | 'satellite-derived estimate'
  | 'user-provided data'
  | 'AI-assisted visual assessment'
  | 'calculated suitability index'
  | 'scenario simulation output';

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface SoilData {
  ph?: number;
  ecSalinityDsM?: number;
  texture?: 'sandy' | 'loam' | 'clay_loam' | 'clay' | 'silty_loam' | 'unknown';
  drainage?: 'well_drained' | 'moderate' | 'poor' | 'unknown';
  nitrogenPpm?: number;
  phosphorusPpm?: number;
  potassiumPpm?: number;
  organicMatterPct?: number;
  source: DataProvenanceLabel;
  sourceLabel?: string;
  recordedAt?: string;
}

export interface FarmProfile {
  id: string;
  ownerId?: string;
  name: string;
  locationLabel: string;
  centerLat: number;
  centerLng: number;
  locationAccuracyMode: LocationAccuracyMode;
  locationAccuracyMeters?: number;
  boundary?: GeoPoint[];
  areaHectares?: number;
  previousCrop: PreviousCropOption;
  currentCrop: CurrentCropOption;
  season: SeasonOption;
  waterAvailability: WaterAvailability;
  goal: FarmGoal;
  soilData?: SoilData;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type MetricStatus =
  | 'suitable'
  | 'elevated'
  | 'below typical range'
  | 'data unavailable'
  | 'stale data'
  | 'requires local verification';

export interface EnvironmentalMetric {
  id: string;
  name: string;
  nameAr: string;
  value: number | null;
  unit: string;
  baselineValue?: number | null;
  baselineDelta?: number | null;
  source: string;
  timestamp: string;
  updateFrequency: string;
  provenance: DataProvenanceLabel;
  spatialResolution: string;
  status: MetricStatus;
  interpretation: string;
  interpretationAr: string;
  confidenceNote: string;
  parameterCode?: string;
}

export interface DailyClimatePoint {
  date: string;
  t2m: number | null;
  t2mMax: number | null;
  t2mMin: number | null;
  precipMm: number | null;
  solarMjM2: number | null;
  rh2m: number | null;
  soilWetnessTop: number | null;
  soilWetnessRoot: number | null;
}

export interface EnvironmentalSnapshot {
  id: string;
  farmId: string;
  lat: number;
  lng: number;
  fetchedAt: string;
  dataDateRange: { start: string; end: string };
  isStale: boolean;
  elevationMeters: number | null;
  elevationSource?: string;
  metrics: EnvironmentalMetric[];
  dailySeries: DailyClimatePoint[];
  summary: {
    avgTempC: number | null;
    maxTempC: number | null;
    minTempC: number | null;
    totalPrecip14dMm: number | null;
    baselineAnnualMonthlyAvgTempC: number | null;
    baselinePeriodPrecip14dMm: number | null;
    avgSolarMjM2: number | null;
    avgHumidityPct: number | null;
    soilWetnessIndex: number | null; // 0..1 surface wetness from NASA POWER GWETTOP
    rootSoilWetnessIndex: number | null; // 0..1 root zone wetness from NASA POWER GWETROOT
  };
  soilGridsReference?: {
    phH2o?: number | null;
    clayPct?: number | null;
    sandPct?: number | null;
    organicCarbonGKg?: number | null;
    source: string;
    spatialResolution: string;
    timestamp: string;
  } | null;
  limitations: string[];
  sourceAttribution: string[];
}

export type ScanCategory = 'crop_photo' | 'soil_surface' | 'soil_report_ocr';
export type ScanQualityStatus = 'usable' | 'low_quality' | 'unsupported_crop' | 'irrelevant';

export interface FieldScanResult {
  id: string;
  farmId: string;
  scanType: ScanCategory;
  imageName: string;
  imagePreviewDataUrl?: string;
  analyzedAt: string;
  qualityStatus: ScanQualityStatus;
  qualityReason: string;
  detectedCrop: CropId | 'unsupported' | 'soil_only' | 'unknown';
  detectedCropLabel: string;
  preliminaryAssessment: string;
  confidenceLevel: 'high' | 'moderate' | 'low';
  confidenceScore: number; // 0-100 visual assessment confidence
  visualEvidence: string[];
  stressCategories: Array<'water_stress' | 'heat_stress' | 'nutrient_discoloration' | 'lesion_or_pest' | 'soil_crust_or_salinity' | 'healthy_vigor' | 'none'>;
  environmentalCorrelation: string;
  suggestedNextSteps: string[];
  limitations: string[];
  ocrSoilValues?: {
    ph?: number | null;
    ecSalinityDsM?: number | null;
    nitrogenPpm?: number | null;
    phosphorusPpm?: number | null;
    potassiumPpm?: number | null;
    organicMatterPct?: number | null;
    texture?: SoilData['texture'] | null;
    labDate?: string | null;
    rawNotes?: string | null;
  };
  modelVersion: string;
  provenance: DataProvenanceLabel;
}

export interface CropProfile {
  id: CropId;
  name: string;
  nameAr: string;
  scientificName: string;
  family: 'Poaceae' | 'Asteraceae' | 'Fabaceae';
  sourceFamily?: string;
  familyAr: string;
  roleLabel: string;
  roleLabelAr: string;
  preferredSeasons: SeasonOption[];
  marginalSeasons: SeasonOption[];
  optimalTempC: [number, number];
  viableTempC: [number, number];
  waterDemandLevel: 'low' | 'moderate' | 'high';
  seasonalWaterMm: [number, number];
  rainfallSensitivity: string;
  rainfallSensitivityAr: string;
  compatibleTextures: Array<'sandy' | 'loam' | 'clay_loam' | 'clay' | 'silty_loam'>;
  optimalPhRange: [number, number];
  viablePhRange: [number, number];
  maxSafeEcDsM: number;
  severeEcDsM: number;
  drainageRequirement: 'well_drained' | 'moderate_to_well' | 'tolerant';
  growthDurationDays: [number, number];
  rotationBenefits: string;
  rotationBenefitsAr: string;
  avoidAfterSameCrop: boolean;
  avoidAfterFamily?: 'Poaceae' | 'Asteraceae' | 'Fabaceae';
  stressIndicators: string[];
  pestAndDiseaseCategories: string[];
  sources: string[];
  uncertaintyNotes: string;
}

export interface DecisionWeights {
  water: number;
  climate: number;
  soil: number;
  season: number;
  rotation: number;
}

export interface FactorContribution {
  factor: 'water' | 'climate' | 'soil' | 'season' | 'rotation';
  label: string;
  labelAr: string;
  score: number; // 0-100
  weight: number; // 0-1
  weightedContribution: number;
  status: 'strong' | 'acceptable' | 'constrained' | 'missing_data';
  explanation: string;
  explanationAr: string;
}

export interface HardConstraintFlag {
  code: string;
  severity: 'exclusion' | 'caution';
  message: string;
  messageAr: string;
}

export interface CropEvaluation {
  cropId: CropId;
  cropName: string;
  cropNameAr: string;
  scientificName: string;
  family: string;
  rank: number;
  suitabilityIndex: number; // 0-100 calculated suitability index
  excluded: boolean;
  confidence: 'high' | 'moderate' | 'low';
  confidenceScore: number; // 0-100
  factors: FactorContribution[];
  positiveFactors: string[];
  positiveFactorsAr: string[];
  mainRisks: string[];
  mainRisksAr: string[];
  missingData: string[];
  missingDataAr: string[];
  hardConstraints: HardConstraintFlag[];
  nasaMatchDetails?: {
    suitableDaysCount: number;
    totalDaysCount: number;
    suitabilityPct: number;
    avgSolarRadiation?: number;
    totalPrecipitation?: number;
    avgRootMoisture?: number;
  };
}

export interface DecisionRun {
  id: string;
  farmId: string;
  ruleVersion: string;
  computedAt: string;
  provenance: DataProvenanceLabel;
  weights: DecisionWeights;
  overallConfidence: 'high' | 'moderate' | 'low';
  overallConfidenceScore: number;
  missingInputs: string[];
  missingInputsAr: string[];
  inputSnapshot: {
    lat: number;
    lng: number;
    season: SeasonOption;
    waterAvailability: WaterAvailability;
    previousCrop: PreviousCropOption;
    currentCrop: CurrentCropOption;
    goal: FarmGoal;
    hasSoilData: boolean;
    hasEnvironmentalData: boolean;
    environmentalFetchedAt?: string;
    scanId?: string;
  };
  evaluations: CropEvaluation[];
  limitations: string[];
}

export interface RotationSeasonStep {
  slot: 'previous' | 'current' | 'next' | 'future';
  slotLabel: string;
  slotLabelAr: string;
  seasonName: SeasonOption;
  chosenCrop: CropId | 'fallow' | 'none' | 'unknown';
  chosenCropName: string;
  chosenCropNameAr: string;
  alternatives: CropId[];
  cropFamily: string;
  waterDemand: 'low' | 'moderate' | 'high' | 'unknown';
  environmentalFit: string;
  environmentalFitAr: string;
  reason: string;
  reasonAr: string;
  rotationBenefit: string;
  rotationBenefitAr: string;
  riskNote: string;
  riskNoteAr: string;
  confidence: 'high' | 'moderate' | 'low';
}

export interface RotationPlan {
  farmId: string;
  generatedAt: string;
  advisoryNotice: string;
  advisoryNoticeAr: string;
  steps: RotationSeasonStep[];
  missingInfo: string[];
}

export interface ScenarioInput {
  tempDeltaC: number; // e.g., -2 to +5
  waterAvailabilityPct: number; // 40% to 120%
  rainfallDeltaPct: number; // -50% to +50%
  soilMoistureScenario: 'baseline' | 'dry' | 'wet';
}

export interface CropScenarioDelta {
  cropId: CropId;
  cropName: string;
  cropNameAr: string;
  baselineRank: number;
  scenarioRank: number;
  rankDelta: number;
  baselineScore: number;
  scenarioScore: number;
  scoreDelta: number;
  baselineExcluded: boolean;
  scenarioExcluded: boolean;
  primaryDriver: string;
  primaryDriverAr: string;
  riskShift: string;
}

export interface SimulationComparison {
  scenario: ScenarioInput;
  computedAt: string;
  baselineRun: DecisionRun;
  scenarioRun: DecisionRun;
  deltas: CropScenarioDelta[];
  mostResilientCropId: CropId;
  mostResilientCropName: string;
  mostResilientCropNameAr: string;
  disclaimer: string;
}

export interface FarmAlert {
  id: string;
  severity: 'urgent' | 'warning' | 'info';
  title: string;
  titleAr: string;
  reason: string;
  reasonAr: string;
  suggestedAction: string;
  suggestedActionAr: string;
  source: string;
}

export interface FarmReport {
  id: string;
  farmId: string;
  mode: 'farmer' | 'technical';
  generatedAt: string;
  farmName: string;
  locationLabel: string;
  topCropName: string;
  topSuitabilityIndex: number;
  confidence: string;
  summaryText: string;
  sections: Array<{
    heading: string;
    body: string;
    provenance: DataProvenanceLabel | string;
  }>;
  sourcesAndTimestamps: Array<{
    source: string;
    timestamp: string;
    resolutionOrScope: string;
  }>;
  limitations: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  technicalDetails?: string;
  contextUsed?: string[];
  timestamp: string;
  groundingUrls?: Array<{ title: string; uri: string; type: 'search' | 'maps' }>;
  usedThinking?: boolean;
}
