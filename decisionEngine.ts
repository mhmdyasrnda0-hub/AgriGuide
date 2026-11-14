import { CROP_IDS, SUPPORTED_CROPS } from '../data/crops';
import {
  CropEvaluation,
  CropId,
  CropProfile,
  CropScenarioDelta,
  DecisionRun,
  DecisionWeights,
  EnvironmentalSnapshot,
  FactorContribution,
  FarmAlert,
  FarmGoal,
  FarmProfile,
  FieldScanResult,
  HardConstraintFlag,
  RotationPlan,
  RotationSeasonStep,
  ScenarioInput,
  SeasonOption,
  SimulationComparison,
  SoilData,
  WaterAvailability,
} from '../types/fieldshift';
import { normalizeDecisionWeights } from './validators';

export const RULE_VERSION = 'fs-rules-2026.2';

export const DEFAULT_DECISION_WEIGHTS: DecisionWeights = {
  water: 0.3,
  climate: 0.25,
  soil: 0.2,
  season: 0.15,
  rotation: 0.1,
};

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}

function getGoalWeightAdjustment(goal: FarmGoal, base: DecisionWeights): DecisionWeights {
  if (goal === 'water_conservation' || goal === 'drought_resilience') {
    return normalizeDecisionWeights({
      water: 0.38,
      climate: 0.24,
      soil: 0.16,
      season: 0.12,
      rotation: 0.1,
    });
  }
  if (goal === 'soil_recovery') {
    return normalizeDecisionWeights({
      water: 0.24,
      climate: 0.2,
      soil: 0.24,
      season: 0.12,
      rotation: 0.2,
    });
  }
  return normalizeDecisionWeights(base);
}

/**
 * Real FAO-29 / Maas-Hoffman Crop Salt Tolerance Equation:
 *   Yr(%) = clamp(100 - b * max(0, ECe - ECt), 0, 100)
 * where ECt is maxSafeEcDsM (threshold before yield decline) and
 * slope b = 50 / (severeEcDsM - maxSafeEcDsM) calibrated so severeEcDsM corresponds to ~50% relative yield.
 */
export function computeMaasHoffmanRelativeYield(
  ecDsM: number,
  thresholdEcDsM: number,
  severeEcDsM: number
): number {
  if (!Number.isFinite(ecDsM) || ecDsM < 0) return 100;
  if (ecDsM <= thresholdEcDsM) return 100;
  const span = Math.max(0.5, severeEcDsM - thresholdEcDsM);
  const slopePctPerDsM = 50 / span;
  const relativeYield = 100 - slopePctPerDsM * (ecDsM - thresholdEcDsM);
  return Number(clamp(relativeYield, 0, 100).toFixed(1));
}

/**
 * FAO Texture Available Water Capacity (AWC) seasonal supply adjustment in mm-equivalent ratio.
 * Loam/clay-loam buffer drought between irrigations; coarse sand drains rapidly.
 */
function getTextureWaterRetentionFactor(texture?: SoilData['texture']): number {
  switch (texture) {
    case 'loam':
    case 'clay_loam':
    case 'silty_loam':
      return 1.05;
    case 'clay':
      return 1.02;
    case 'sandy':
      return 0.88;
    default:
      return 1.0;
  }
}

/**
 * FAO-56 inspired Seasonal Water Supply-to-Demand Budget:
 * Converts farm irrigation tier, scenario availability multiplier, effective 14d satellite rainfall,
 * soil texture retention, and root-zone / surface wetness into an effective seasonal water budget (mm),
 * then evaluates the ratio (Supply / Midpoint Crop Demand).
 */
export function evaluateWaterFactor(
  crop: CropProfile,
  water: WaterAvailability,
  precip14dMm: number | null,
  surfaceWetness: number | null,
  rootWetness: number | null,
  texture?: SoilData['texture'],
  scenarioWaterPct = 100
): {
  score: number;
  budgetRatio: number;
  effectiveSupplyMm: number;
  cropDemandMidMm: number;
  status: FactorContribution['status'];
  explanation: string;
  explanationAr: string;
  hardConstraint?: HardConstraintFlag;
} {
  const cropDemandMidMm = (crop.seasonalWaterMm[0] + crop.seasonalWaterMm[1]) / 2;

  // Base farm irrigation capacity across a 120-day growing window (mm-equivalent)
  const tierBaseSupplyMm: Record<WaterAvailability, number> = {
    abundant: 780,
    moderate: 560,
    limited: 410,
    scarce: 255,
  };

  const irrigationSupplyMm = tierBaseSupplyMm[water] * (scenarioWaterPct / 100);

  // FAO effective rainfall estimate (0.75 efficiency capped over a 14d rolling signal scaled seasonally)
  const effectiveRainBoostMm =
    precip14dMm !== null && Number.isFinite(precip14dMm)
      ? Math.min(120, Math.max(0, precip14dMm) * 1.45)
      : 0;

  // Root-zone wetness bonus/deficit relative to 0.45 neutral moisture
  const activeWetness = rootWetness ?? surfaceWetness;
  const wetnessDeltaMm =
    activeWetness !== null && Number.isFinite(activeWetness)
      ? (activeWetness - 0.45) * 90
      : 0;

  const retentionMult = getTextureWaterRetentionFactor(texture);
  const effectiveSupplyMm = Math.max(
    60,
    Math.round((irrigationSupplyMm + effectiveRainBoostMm + wetnessDeltaMm) * retentionMult)
  );

  const budgetRatio = Number((effectiveSupplyMm / cropDemandMidMm).toFixed(2));
  let score: number;

  if (budgetRatio >= 1.1) {
    // Surplus water is ideal up to 1.35; excess beyond 1.55 slightly stresses well-drained crops
    const excessPenalty =
      crop.drainageRequirement === 'well_drained' && budgetRatio > 1.5
        ? Math.round((budgetRatio - 1.5) * 28)
        : 0;
    score = clamp(95 - excessPenalty, 68, 96);
  } else if (budgetRatio >= 0.85) {
    // Smooth linear ramp between 0.85 (score 76) and 1.10 (score 95)
    score = Math.round(76 + ((budgetRatio - 0.85) / 0.25) * 19);
  } else if (budgetRatio >= 0.62) {
    // Moderate deficit ramp between 0.62 (score 38) and 0.85 (score 76)
    score = Math.round(38 + ((budgetRatio - 0.62) / 0.23) * 38);
  } else {
    // Severe hydrological deficit
    score = clamp(Math.round(10 + (budgetRatio / 0.62) * 28), 8, 38);
  }

  // Waterlogging guard when surface soil wetness exceeds aerobic threshold or heavy storm on well-drained crops
  if (
    crop.drainageRequirement === 'well_drained' &&
    ((surfaceWetness !== null && surfaceWetness > 0.78) || (precip14dMm !== null && precip14dMm > 60))
  ) {
    score = clamp(score - 9);
  }

  let hardConstraint: HardConstraintFlag | undefined;
  if (budgetRatio < 0.62) {
    hardConstraint = {
      code: water === 'scarce' ? 'WATER_SCARCE_EXCLUSION' : 'WATER_DEFICIT_HIGH_DEMAND',
      severity: 'exclusion',
      message: `Seasonal water budget deficit: estimated supply (~${effectiveSupplyMm} mm) covers only ${Math.round(
        budgetRatio * 100
      )}% of ${crop.name}'s midpoint need (${cropDemandMidMm} mm).`,
      messageAr: `عجز في الميزانية المائية: الإمداد المقدر (~${effectiveSupplyMm} ملم) يغطي فقط ${Math.round(
        budgetRatio * 100
      )}% من احتياج ${crop.nameAr} (${cropDemandMidMm} ملم).`,
    };
  } else if (budgetRatio < 0.82 && water === 'scarce') {
    hardConstraint = {
      code: 'SCARCE_WATER_CAUTION',
      severity: 'caution',
      message: `Scarce-water margin is tight (~${effectiveSupplyMm} mm vs ${cropDemandMidMm} mm midpoint); critical irrigation timing needed at establishment.`,
      messageAr: `الهامش المائي ضيق (~${effectiveSupplyMm} ملم مقابل احتياج ${cropDemandMidMm} ملم)؛ يتطلب ضبط مواعيد الري الحرجة.`,
    };
  }

  const status: FactorContribution['status'] =
    score >= 75 ? 'strong' : score >= 50 ? 'acceptable' : 'constrained';

  const explanation = `Water budget ~${effectiveSupplyMm} mm vs ${crop.name} midpoint ${cropDemandMidMm} mm (${Math.round(
    budgetRatio * 100
  )}% supply ratio; ${water} tier${
    precip14dMm !== null ? `, ${precip14dMm.toFixed(1)} mm 14d rain` : ''
  }).`;
  const explanationAr = `الميزانية المائية ~${effectiveSupplyMm} ملم مقابل احتياج ${crop.nameAr} (${cropDemandMidMm} ملم؛ نسبة تغطية ${Math.round(
    budgetRatio * 100
  )}%، توفر المياه: ${water}).`;

  return {
    score,
    budgetRatio,
    effectiveSupplyMm,
    cropDemandMidMm,
    status,
    explanation,
    explanationAr,
    hardConstraint,
  };
}

const CROP_FROST_THRESHOLD_C: Record<CropId, number> = {
  wheat: -4,
  rice: 10,
  faba_beans: -2,
  cotton: 5,
  maize: 3,
};

/**
 * Piecewise-Continuous Agronomic Thermal Suitability Curve:
 * - Centered peak inside [optMin, optMax] (90–96 pts)
 * - Smooth cosine/linear ramp between [viaMin, optMin] and [optMax, viaMax] (48–88 pts)
 * - Rapid biological penalty outside viable limits + Anthesis heat-peak & Frost stress penalties
 */
export function evaluateClimateFactor(
  crop: CropProfile,
  env: EnvironmentalSnapshot | null,
  tempDeltaC = 0
): {
  score: number;
  status: FactorContribution['status'];
  explanation: string;
  explanationAr: string;
  hardConstraint?: HardConstraintFlag;
} {
  const avgTemp =
    env?.summary.avgTempC !== null && env?.summary.avgTempC !== undefined
      ? env.summary.avgTempC + tempDeltaC
      : null;
  const maxTemp =
    env?.summary.maxTempC !== null && env?.summary.maxTempC !== undefined
      ? env.summary.maxTempC + tempDeltaC
      : null;
  const minTemp =
    env?.summary.minTempC !== null && env?.summary.minTempC !== undefined
      ? env.summary.minTempC + tempDeltaC
      : null;

  if (avgTemp === null) {
    return {
      score: 55,
      status: 'missing_data',
      explanation:
        'Live NASA POWER meteorology is not yet loaded; neutral thermal score applied with lowered confidence.',
      explanationAr:
        'بيانات NASA POWER المناخية غير محملة بعد؛ تم تطبيق درجة حرارية محايدة مع خفض مستوى الثقة.',
    };
  }

  const [optMin, optMax] = crop.optimalTempC;
  const [viaMin, viaMax] = crop.viableTempC;
  let score: number;
  let hardConstraint: HardConstraintFlag | undefined;

  if (avgTemp >= optMin && avgTemp <= optMax) {
    // Distance from exact optimal midpoint adjusts mildly between 90 and 96
    const optMid = (optMin + optMax) / 2;
    const halfOptSpan = Math.max(1, (optMax - optMin) / 2);
    const centrality = 1 - Math.abs(avgTemp - optMid) / halfOptSpan;
    score = Math.round(90 + centrality * 6);
  } else if (avgTemp >= viaMin && avgTemp < optMin) {
    const progress = (avgTemp - viaMin) / Math.max(1, optMin - viaMin);
    score = Math.round(48 + progress * 40);
  } else if (avgTemp > optMax && avgTemp <= viaMax) {
    const progress = (viaMax - avgTemp) / Math.max(1, viaMax - optMax);
    score = Math.round(48 + progress * 40);
  } else {
    const outDist = avgTemp < viaMin ? viaMin - avgTemp : avgTemp - viaMax;
    score = clamp(Math.round(34 - outDist * 5.5), 5, 34);
    hardConstraint = {
      code: 'EXTREME_TEMPERATURE_MISMATCH',
      severity: outDist > 3 ? 'exclusion' : 'caution',
      message: `Mean temperature (${avgTemp.toFixed(1)}°C) sits outside ${crop.name}'s biological viable envelope (${viaMin}–${viaMax}°C).`,
      messageAr: `متوسط الحرارة (${avgTemp.toFixed(1)}°م) خارج النطاق الحراري الحيوي لمحصول ${crop.nameAr} (${viaMin}–${viaMax}°م).`,
    };
  }

  // Anthesis / Pollination Heat Peak Penalty
  if (maxTemp !== null && maxTemp > viaMax + 1.5) {
    const heatExcess = maxTemp - (viaMax + 1.5);
    const heatPenalty = Math.min(20, Math.round(5 + heatExcess * 2.5));
    score = clamp(score - heatPenalty);
    if (!hardConstraint) {
      hardConstraint = {
        code: 'HEAT_PEAK_STRESS',
        severity: heatExcess > 4 ? 'exclusion' : 'caution',
        message: `Heat peak reached ${maxTemp.toFixed(1)}°C (above ${viaMax}°C ceiling), elevating pollination & evapotranspiration stress for ${crop.name}.`,
        messageAr: `بلغت الذروة الحرارية ${maxTemp.toFixed(1)}°م (أعلى من حد ${viaMax}°م)، مما يرفع خطر إجهاد التلقيح لمحصول ${crop.nameAr}.`,
      };
    }
  }

  // Frost / Freezing Stress Penalty
  const frostThreshold = CROP_FROST_THRESHOLD_C[crop.id];
  if (minTemp !== null && minTemp < frostThreshold) {
    const frostDepth = frostThreshold - minTemp;
    const frostPenalty = Math.min(24, Math.round(6 + frostDepth * 3));
    score = clamp(score - frostPenalty);
    if (!hardConstraint || frostDepth > 3) {
      hardConstraint = {
        code: 'FROST_STRESS_RISK',
        severity: frostDepth > 3 ? 'exclusion' : 'caution',
        message: `Minimum air temperature dropped to ${minTemp.toFixed(1)}°C (below ${frostThreshold}°C frost threshold for ${crop.name}).`,
        messageAr: `انخفضت الحرارة الصغرى إلى ${minTemp.toFixed(1)}°م (دون عتبة الصقيع ${frostThreshold}°م لمحصول ${crop.nameAr}).`,
      };
    }
  }

  // Growing-Degree-Day (GDD) thermal accumulation signal (base = viaMin)
  const dailyGddAvg = Math.max(0, avgTemp - viaMin);

  const status: FactorContribution['status'] =
    score >= 75 ? 'strong' : score >= 50 ? 'acceptable' : 'constrained';

  const explanation = `Mean ${avgTemp.toFixed(1)}°C (min ${minTemp !== null ? `${minTemp.toFixed(1)}°C` : 'n/a'}, peak ${
    maxTemp !== null ? `${maxTemp.toFixed(1)}°C` : 'n/a'
  }, ~${dailyGddAvg.toFixed(1)} GDD/d) vs ${crop.name} optimal ${optMin}–${optMax}°C.`;
  const explanationAr = `متوسط الحرارة ${avgTemp.toFixed(1)}°م (الصغرى ${
    minTemp !== null ? `${minTemp.toFixed(1)}°م` : 'غير متاح'
  }، العظمى ${maxTemp !== null ? `${maxTemp.toFixed(1)}°م` : 'غير متاح'}) مقابل النطاق الأمثل لـ${crop.nameAr} (${optMin}–${optMax}°م).`;

  return { score, status, explanation, explanationAr, hardConstraint };
}

/**
 * Evaluates Soil Chemistry & Physics:
 * 1. Continuous quadratic pH curve (peak nutrient availability inside optimalPhRange)
 * 2. Real Maas-Hoffman relative yield reduction from ECe salinity
 * 3. Texture & drainage compatibility
 * 4. Optional N-P-K and Organic Matter fertility modifiers (when verified from Soil Lab OCR or user)
 */
export function evaluateSoilFactor(
  crop: CropProfile,
  farm: FarmProfile,
  env: EnvironmentalSnapshot | null
): {
  score: number;
  maasHoffmanRelativeYieldPct: number | null;
  status: FactorContribution['status'];
  explanation: string;
  explanationAr: string;
  missing: string[];
  missingAr: string[];
  hardConstraint?: HardConstraintFlag;
} {
  const soil = farm.soilData;
  const sgPh = env?.soilGridsReference?.phH2o ?? null;
  const ph = soil?.ph ?? sgPh ?? undefined;
  const ec = soil?.ecSalinityDsM;
  const texture = soil?.texture && soil.texture !== 'unknown' ? soil.texture : undefined;
  const drainage = soil?.drainage && soil.drainage !== 'unknown' ? soil.drainage : undefined;
  const hasNpk =
    soil?.nitrogenPpm !== undefined ||
    soil?.phosphorusPpm !== undefined ||
    soil?.potassiumPpm !== undefined;

  const missing: string[] = [];
  const missingAr: string[] = [];
  if (ph === undefined) {
    missing.push('Soil pH lab or report reading');
    missingAr.push('قراءة حموضة التربة (pH)');
  }
  if (ec === undefined) {
    missing.push('Soil salinity (EC dS/m) measurement');
    missingAr.push('قياس ملوحة التربة (EC)');
  }
  if (!texture) {
    missing.push('Field soil texture classification');
    missingAr.push('قوام التربة الحقلي');
  }

  if (ph === undefined && ec === undefined && !texture && !drainage && !hasNpk) {
    return {
      score: 58,
      maasHoffmanRelativeYieldPct: null,
      status: 'missing_data',
      explanation:
        'No verified soil lab report or field texture entered; neutral baseline applied with reduced confidence.',
      explanationAr:
        'لا توجد نتائج تحليل تربة مؤكدة؛ تم تطبيق تقييم محايد للتربة مع خفض مستوى الثقة.',
      missing,
      missingAr,
    };
  }

  let score = 84;
  let hardConstraint: HardConstraintFlag | undefined;
  let maasHoffmanPct: number | null = null;

  // 1. Continuous pH availability penalty
  if (ph !== undefined) {
    const [optMin, optMax] = crop.optimalPhRange;
    const [viaMin, viaMax] = crop.viablePhRange;
    if (ph >= optMin && ph <= optMax) {
      score += 8;
    } else if (ph >= viaMin && ph <= viaMax) {
      const dist = ph < optMin ? optMin - ph : ph - optMax;
      const span = ph < optMin ? Math.max(0.2, optMin - viaMin) : Math.max(0.2, viaMax - optMax);
      score -= Math.round(6 + (dist / span) * 14);
    } else {
      const outDist = ph < viaMin ? viaMin - ph : ph - viaMax;
      score -= Math.round(28 + Math.min(25, outDist * 14));
      hardConstraint = {
        code: 'SEVERE_PH_MISMATCH',
        severity: 'exclusion',
        message: `Soil pH (${ph.toFixed(1)}) is outside ${crop.name}'s viable availability band (${viaMin}–${viaMax}).`,
        messageAr: `درجة حموضة التربة (${ph.toFixed(1)}) خارج النطاق المقبول لمحصول ${crop.nameAr} (${viaMin}–${viaMax}).`,
      };
    }
  }

  // 2. Real Maas-Hoffman Salinity Yield Response
  if (ec !== undefined) {
    maasHoffmanPct = computeMaasHoffmanRelativeYield(ec, crop.maxSafeEcDsM, crop.severeEcDsM);
    if (ec <= crop.maxSafeEcDsM) {
      score += 6;
    } else {
      // Scale soil score proportionally to Maas-Hoffman relative yield loss
      const yieldLossPct = 100 - maasHoffmanPct;
      score -= Math.round(yieldLossPct * 0.92);
      if (ec > crop.severeEcDsM || maasHoffmanPct < 55) {
        hardConstraint = {
          code: 'SEVERE_SALINITY_EXCLUSION',
          severity: 'exclusion',
          message: `Severe salinity (EC ${ec.toFixed(1)} dS/m): Maas-Hoffman model projects ${maasHoffmanPct}% relative yield potential for ${crop.name} (threshold ${crop.maxSafeEcDsM} dS/m).`,
          messageAr: `ملوحة شديدة (${ec.toFixed(1)} dS/m): معادلة ماس-هوفمان تقدر احتفاظ المحصول بـ${maasHoffmanPct}% من طاقته الإنتاجية (الحد الآمن ${crop.maxSafeEcDsM} dS/m).`,
        };
      } else if (!hardConstraint) {
        hardConstraint = {
          code: 'SALINITY_CAUTION',
          severity: 'caution',
          message: `Moderate salinity (EC ${ec.toFixed(1)} dS/m): Maas-Hoffman relative yield potential estimates ${maasHoffmanPct}% for ${crop.name}.`,
          messageAr: `ملوحة متوسطة (${ec.toFixed(1)} dS/m): تقدير ماس-هوفمان للإنتاج النسبي ${maasHoffmanPct}% لمحصول ${crop.nameAr}.`,
        };
      }
    }
  }

  // 3. Soil Texture & Drainage
  if (texture) {
    if (crop.compatibleTextures.includes(texture)) {
      score += 5;
    } else {
      score -= 13;
    }
  }

  if (drainage === 'poor' && crop.drainageRequirement === 'well_drained') {
    score -= 22;
    if (!hardConstraint) {
      hardConstraint = {
        code: 'POOR_DRAINAGE_RISK',
        severity: 'caution',
        message: `Poor drainage elevates hypoxia and root-rot risk for ${crop.name}.`,
        messageAr: `ضعف الصرف يرفع خطر نقص الأكسجين وأعفان الجذور لمحصول ${crop.nameAr}.`,
      };
    }
  }

  // 4. Optional Lab N-P-K & Organic Matter check
  if (soil?.nitrogenPpm !== undefined) {
    if (soil.nitrogenPpm < 15 && crop.family === 'Poaceae') score -= 6;
    if (soil.nitrogenPpm < 15 && crop.family === 'Fabaceae') score += 2; // Legumes handle low-N better via fixation
  }
  if (soil?.organicMatterPct !== undefined) {
    if (soil.organicMatterPct >= 2.0) score += 3;
    else if (soil.organicMatterPct < 0.8) score -= 4;
  }

  score = clamp(Math.round(score));
  const status: FactorContribution['status'] =
    score >= 75 ? 'strong' : score >= 50 ? 'acceptable' : 'constrained';

  const parts: string[] = [];
  if (ph !== undefined) parts.push(`pH ${ph.toFixed(1)}`);
  if (ec !== undefined) parts.push(`EC ${ec.toFixed(1)} dS/m (Maas-Hoffman ${maasHoffmanPct}% Yr)`);
  if (texture) parts.push(`texture ${texture.replace('_', ' ')}`);
  if (soil?.organicMatterPct !== undefined) parts.push(`OM ${soil.organicMatterPct}%`);

  return {
    score,
    maasHoffmanRelativeYieldPct: maasHoffmanPct,
    status,
    explanation: `Evaluated from ${parts.join(', ')}${
      soil?.ph === undefined && sgPh !== null ? ' (pH baseline from SoilGrids 250m)' : ''
    }.`,
    explanationAr: `تم التقييم بناءً على بيانات التربة (${parts.join('، ')}).`,
    missing,
    missingAr,
    hardConstraint,
  };
}

function evaluateSeasonFactor(
  crop: CropProfile,
  season: SeasonOption
): {
  score: number;
  status: FactorContribution['status'];
  explanation: string;
  explanationAr: string;
  hardConstraint?: HardConstraintFlag;
} {
  if (crop.preferredSeasons.includes(season)) {
    return {
      score: 94,
      status: 'strong',
      explanation: `${season} is a primary recommended planting window for ${crop.name} (${crop.growthDurationDays[0]}–${crop.growthDurationDays[1]} days).`,
      explanationAr: `موسم ${season} نافذة زراعة أساسية موصى بها لمحصول ${crop.nameAr}.`,
    };
  }
  if (crop.marginalSeasons.includes(season)) {
    return {
      score: 54,
      status: 'acceptable',
      explanation: `${season} is marginal for ${crop.name}; sowing date precision and cultivar maturity are critical.`,
      explanationAr: `موسم ${season} هامشي لمحصول ${crop.nameAr}؛ دقة موعد الزراعة والصنف ضرورية.`,
    };
  }
  return {
    score: 14,
    status: 'constrained',
    explanation: `${crop.name} is outside its seasonal calendar in ${season}, creating high establishment and photoperiod risk.`,
    explanationAr: `محصول ${crop.nameAr} خارج موسمه المعتاد في ${season}، مما يرفع مخاطر الفشل الحقلية.`,
    hardConstraint: {
      code: 'UNSUITABLE_SEASON',
      severity: 'exclusion',
      message: `Excluded: ${season} is outside the viable growing calendar for ${crop.name}.`,
      messageAr: `مستبعد: موسم ${season} غير مناسب لزراعة ${crop.nameAr}.`,
    },
  };
}

function evaluateRotationFactor(
  crop: CropProfile,
  farm: FarmProfile,
  scan: FieldScanResult | null
): {
  score: number;
  status: FactorContribution['status'];
  explanation: string;
  explanationAr: string;
  hardConstraint?: HardConstraintFlag;
} {
  const prev = farm.previousCrop;
  if (prev === 'unknown') {
    return {
      score: 62,
      status: 'missing_data',
      explanation: 'Previous crop history unknown; neutral rotation score held until history is specified.',
      explanationAr: 'المحصول السابق غير معروف؛ أُبقيت درجة الدورة الزراعية محايدة.',
    };
  }
  if (prev === 'fallow') {
    return {
      score: 84,
      status: 'strong',
      explanation: 'Preceding fallow period reduces immediate host disease and weed pressure.',
      explanationAr: 'إراحة الأرض سابقاً تقلل من انتقال الأمراض والأعشاب الضارة.',
    };
  }

  const prevCrop = SUPPORTED_CROPS[prev];
  let score = 78;
  let hardConstraint: HardConstraintFlag | undefined;

  const hasDiseaseFlag =
    scan?.qualityStatus === 'usable' && scan.stressCategories.includes('lesion_or_pest');

  if (prev === crop.id && crop.avoidAfterSameCrop) {
    score = hasDiseaseFlag ? 16 : 32;
    hardConstraint = {
      code: 'CONTINUOUS_MONOCULTURE_CONFLICT',
      severity: hasDiseaseFlag ? 'exclusion' : 'caution',
      message: `Planting ${crop.name} after ${prevCrop.name} repeats same-species host pest pressure${
        hasDiseaseFlag ? ' (compounded by lesion/pest cues in field scan)' : ''
      }.`,
      messageAr: `زراعة ${crop.nameAr} مباشرة بعد ${prevCrop.nameAr} تكرر ضغط الآفات والأمراض لنفس النوع.`,
    };
  } else if (crop.avoidAfterFamily && prevCrop.family === crop.avoidAfterFamily) {
    score = 48;
  } else if (prevCrop.family === 'Fabaceae' && crop.family === 'Poaceae') {
    score = 96; // Legume N-carryover synergy to cereal
  } else if (crop.family === 'Fabaceae' && prevCrop.family === 'Poaceae') {
    score = 92; // Cereals depleted N restored cleanly by legume
  } else if (prevCrop.family !== crop.family) {
    score = 86;
  }

  const status: FactorContribution['status'] =
    score >= 75 ? 'strong' : score >= 50 ? 'acceptable' : 'constrained';

  return {
    score,
    status,
    explanation: `Following ${prevCrop.name} (${prevCrop.family}) with ${crop.name} (${crop.family}). ${crop.rotationBenefits}`,
    explanationAr: `زراعة ${crop.nameAr} بعد ${prevCrop.nameAr}. ${crop.rotationBenefitsAr}`,
    hardConstraint,
  };
}

export function evaluateCrops(
  farm: FarmProfile,
  env: EnvironmentalSnapshot | null,
  scan: FieldScanResult | null = null,
  weightsInput: DecisionWeights = DEFAULT_DECISION_WEIGHTS,
  scenario?: ScenarioInput
): DecisionRun {
  const weights = getGoalWeightAdjustment(farm.goal, weightsInput);

  let effectiveWater = farm.waterAvailability;
  const scenarioWaterPct = scenario?.waterAvailabilityPct ?? 100;
  const tempDelta = scenario?.tempDeltaC ?? 0;
  let precipAdjusted = env?.summary.totalPrecip14dMm ?? null;
  let surfaceWetnessAdjusted = env?.summary.soilWetnessIndex ?? null;
  let rootWetnessAdjusted = env?.summary.rootSoilWetnessIndex ?? null;

  if (scenario) {
    if (scenario.waterAvailabilityPct <= 55) {
      effectiveWater = 'scarce';
    } else if (scenario.waterAvailabilityPct <= 80) {
      effectiveWater = farm.waterAvailability === 'abundant' ? 'moderate' : 'limited';
    } else if (scenario.waterAvailabilityPct >= 115 && farm.waterAvailability === 'moderate') {
      effectiveWater = 'abundant';
    }
    if (precipAdjusted !== null) {
      precipAdjusted = Math.max(0, precipAdjusted * (1 + scenario.rainfallDeltaPct / 100));
    }
    if (surfaceWetnessAdjusted !== null) {
      if (scenario.soilMoistureScenario === 'dry') {
        surfaceWetnessAdjusted = Math.max(0.05, surfaceWetnessAdjusted - 0.25);
      }
      if (scenario.soilMoistureScenario === 'wet') {
        surfaceWetnessAdjusted = Math.min(0.95, surfaceWetnessAdjusted + 0.25);
      }
    }
    if (rootWetnessAdjusted !== null) {
      if (scenario.soilMoistureScenario === 'dry') {
        rootWetnessAdjusted = Math.max(0.08, rootWetnessAdjusted - 0.22);
      }
      if (scenario.soilMoistureScenario === 'wet') {
        rootWetnessAdjusted = Math.min(0.95, rootWetnessAdjusted + 0.22);
      }
    }
  }

  const missingInputs: string[] = [];
  const missingInputsAr: string[] = [];
  if (!env) {
    missingInputs.push('Live NASA POWER environmental observation');
    missingInputsAr.push('بيانات الرصد الجوي الفضائي من NASA POWER');
  } else if (env.isStale) {
    missingInputs.push('Fresh environmental observation (currently using cached stale record)');
    missingInputsAr.push('بيانات مناخية حديثة (السجل الحالي قديم)');
  }
  if (
    !farm.soilData ||
    (farm.soilData.ph === undefined &&
      farm.soilData.ecSalinityDsM === undefined &&
      (!farm.soilData.texture || farm.soilData.texture === 'unknown'))
  ) {
    missingInputs.push('Verified field soil lab test (pH, EC, texture)');
    missingInputsAr.push('تحليل تربة حقلي موثق (الحموضة والملوحة والقوام)');
  }
  if (farm.previousCrop === 'unknown') {
    missingInputs.push('Previous season crop history');
    missingInputsAr.push('تاريخ المحصول السابق');
  }
  if (farm.locationAccuracyMode === 'approximate') {
    missingInputs.push('Exact farm polygon boundary (currently using approximate point)');
    missingInputsAr.push('حدود المزرعة الدقيقة (يُستخدم موقع تقريبي حالياً)');
  }

  const evaluations: CropEvaluation[] = CROP_IDS.map((cropId) => {
    const crop = SUPPORTED_CROPS[cropId];
    const waterEval = evaluateWaterFactor(
      crop,
      effectiveWater,
      precipAdjusted,
      surfaceWetnessAdjusted,
      rootWetnessAdjusted,
      farm.soilData?.texture,
      scenarioWaterPct
    );
    const climateEval = evaluateClimateFactor(crop, env, tempDelta);
    const soilEval = evaluateSoilFactor(crop, farm, env);
    const seasonEval = evaluateSeasonFactor(crop, farm.season);
    const rotationEval = evaluateRotationFactor(crop, farm, scan);

    const factors: FactorContribution[] = [
      {
        factor: 'water',
        label: 'Water Fit',
        labelAr: 'توافق المياه',
        score: waterEval.score,
        weight: weights.water,
        weightedContribution: Number((waterEval.score * weights.water).toFixed(1)),
        status: waterEval.status,
        explanation: waterEval.explanation,
        explanationAr: waterEval.explanationAr,
      },
      {
        factor: 'climate',
        label: 'Climate Fit',
        labelAr: 'توافق المناخ',
        score: climateEval.score,
        weight: weights.climate,
        weightedContribution: Number((climateEval.score * weights.climate).toFixed(1)),
        status: climateEval.status,
        explanation: climateEval.explanation,
        explanationAr: climateEval.explanationAr,
      },
      {
        factor: 'soil',
        label: 'Soil Fit',
        labelAr: 'توافق التربة',
        score: soilEval.score,
        weight: weights.soil,
        weightedContribution: Number((soilEval.score * weights.soil).toFixed(1)),
        status: soilEval.status,
        explanation: soilEval.explanation,
        explanationAr: soilEval.explanationAr,
      },
      {
        factor: 'season',
        label: 'Season Fit',
        labelAr: 'ملاءمة الموسم',
        score: seasonEval.score,
        weight: weights.season,
        weightedContribution: Number((seasonEval.score * weights.season).toFixed(1)),
        status: seasonEval.status,
        explanation: seasonEval.explanation,
        explanationAr: seasonEval.explanationAr,
      },
      {
        factor: 'rotation',
        label: 'Rotation Fit',
        labelAr: 'توافق الدورة الزراعية',
        score: rotationEval.score,
        weight: weights.rotation,
        weightedContribution: Number((rotationEval.score * weights.rotation).toFixed(1)),
        status: rotationEval.status,
        explanation: rotationEval.explanation,
        explanationAr: rotationEval.explanationAr,
      },
    ];

    let rawIndex = factors.reduce((sum, f) => sum + f.score * f.weight, 0);

    if (farm.goal === 'forage_production' && crop.id === 'faba_beans') rawIndex += 8;
    if (farm.goal === 'soil_recovery' && crop.family === 'Fabaceae') rawIndex += 6;
    if (farm.goal === 'drought_resilience' && crop.waterDemandLevel === 'low') rawIndex += 6;

    const hardConstraints: HardConstraintFlag[] = [
      waterEval.hardConstraint,
      climateEval.hardConstraint,
      soilEval.hardConstraint,
      seasonEval.hardConstraint,
      rotationEval.hardConstraint,
    ].filter((c): c is HardConstraintFlag => Boolean(c));

    const excluded = hardConstraints.some((c) => c.severity === 'exclusion');
    const finalIndex = excluded
      ? Math.min(34, Math.round(rawIndex * 0.55))
      : clamp(Math.round(rawIndex), 0, 99);

    let confScore = 92;
    if (!env) confScore -= 26;
    else if (env.isStale) confScore -= 12;
    if (soilEval.missing.length >= 3) confScore -= 22;
    else if (soilEval.missing.length > 0) confScore -= soilEval.missing.length * 6;
    if (farm.previousCrop === 'unknown') confScore -= 10;
    if (farm.locationAccuracyMode === 'approximate') confScore -= 8;
    confScore = clamp(confScore, 25, 96);
    const confidence: CropEvaluation['confidence'] =
      confScore >= 75 ? 'high' : confScore >= 52 ? 'moderate' : 'low';

    const positiveFactors = factors
      .filter((f) => f.score >= 75)
      .map((f) => `${f.label}: ${f.explanation}`);
    const positiveFactorsAr = factors
      .filter((f) => f.score >= 75)
      .map((f) => `${f.labelAr}: ${f.explanationAr}`);

    const mainRisks = [
      ...hardConstraints.map((c) => c.message),
      ...factors.filter((f) => f.score < 55).map((f) => f.explanation),
    ];
    const mainRisksAr = [
      ...hardConstraints.map((c) => c.messageAr),
      ...factors.filter((f) => f.score < 55).map((f) => f.explanationAr),
    ];

    const cropMissing = [...soilEval.missing];
    const cropMissingAr = [...soilEval.missingAr];
    if (!env) {
      cropMissing.push('Real-time NASA POWER climate baseline');
      cropMissingAr.push('بيانات المناخ من NASA POWER');
    }

    // Link Crop requirements with NASA Daily Climate Series (Python logic integration)
    let nasaMatchDetails: CropEvaluation['nasaMatchDetails'] = undefined;
    if (env && env.dailySeries && env.dailySeries.length > 0) {
      const [tMin, tMax] = crop.optimalTempC;
      const withMeanTemperature = env.dailySeries
        .map((day) => ({
          day,
          meanTemperature:
            day.t2m !== null && Number.isFinite(day.t2m)
              ? day.t2m
              : day.t2mMax !== null && day.t2mMin !== null && Number.isFinite(day.t2mMax) && Number.isFinite(day.t2mMin)
              ? (day.t2mMax + day.t2mMin) / 2
              : null,
        }))
        .filter((entry): entry is { day: (typeof env.dailySeries)[number]; meanTemperature: number } =>
          entry.meanTemperature !== null && Number.isFinite(entry.meanTemperature)
        );

      const matchedDays = withMeanTemperature
        .filter(({ meanTemperature }) => meanTemperature >= tMin && meanTemperature <= tMax)
        .map(({ day }) => day);

      const totalDays = withMeanTemperature.length;
      const suitabilityPct = totalDays > 0 ? Number(((matchedDays.length / totalDays) * 100).toFixed(2)) : 0;
      const finiteValues = (values: Array<number | null | undefined>) =>
        values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
      const solarValues = finiteValues(matchedDays.map((day) => day.solarMjM2));
      const precipValues = finiteValues(matchedDays.map((day) => day.precipMm));
      const rootValues = finiteValues(
        matchedDays.map((day) => day.soilWetnessRoot ?? env.summary.rootSoilWetnessIndex ?? day.soilWetnessTop ?? env.summary.soilWetnessIndex)
      );

      nasaMatchDetails = {
        suitableDaysCount: matchedDays.length,
        totalDaysCount: totalDays,
        suitabilityPct,
        avgSolarRadiation: solarValues.length > 0 ? Number((solarValues.reduce((sum, value) => sum + value, 0) / solarValues.length).toFixed(2)) : undefined,
        totalPrecipitation: precipValues.length > 0 ? Number(precipValues.reduce((sum, value) => sum + value, 0).toFixed(2)) : undefined,
        avgRootMoisture: rootValues.length > 0 ? Number((rootValues.reduce((sum, value) => sum + value, 0) / rootValues.length).toFixed(3)) : undefined,
      };
    }

    return {
      cropId: crop.id,
      cropName: crop.name,
      cropNameAr: crop.nameAr,
      scientificName: crop.scientificName,
      family: crop.family,
      rank: 0,
      suitabilityIndex: finalIndex,
      excluded,
      confidence,
      confidenceScore: confScore,
      factors,
      positiveFactors,
      positiveFactorsAr,
      mainRisks: Array.from(new Set(mainRisks)),
      mainRisksAr: Array.from(new Set(mainRisksAr)),
      missingData: cropMissing,
      missingDataAr: cropMissingAr,
      hardConstraints,
      nasaMatchDetails,
    };
  });

  evaluations.sort((a, b) => {
    if (a.excluded !== b.excluded) return a.excluded ? 1 : -1;
    return b.suitabilityIndex - a.suitabilityIndex;
  });
  evaluations.forEach((ev, idx) => {
    ev.rank = idx + 1;
  });

  const avgConf = Math.round(
    evaluations.reduce((s, e) => s + e.confidenceScore, 0) / evaluations.length
  );

  return {
    id: `dec_${Date.now()}`,
    farmId: farm.id,
    ruleVersion: RULE_VERSION,
    computedAt: new Date().toISOString(),
    provenance: 'calculated suitability index',
    weights,
    overallConfidence: avgConf >= 75 ? 'high' : avgConf >= 52 ? 'moderate' : 'low',
    overallConfidenceScore: avgConf,
    missingInputs,
    missingInputsAr,
    inputSnapshot: {
      lat: farm.centerLat,
      lng: farm.centerLng,
      season: farm.season,
      waterAvailability: effectiveWater,
      previousCrop: farm.previousCrop,
      currentCrop: farm.currentCrop,
      goal: farm.goal,
      hasSoilData: Boolean(
        farm.soilData?.ph !== undefined || farm.soilData?.ecSalinityDsM !== undefined
      ),
      hasEnvironmentalData: Boolean(env),
      environmentalFetchedAt: env?.fetchedAt,
      scanId: scan?.id,
    },
    evaluations,
    limitations: [
      'Suitability Index is an advisory multi-criteria score—not a yield forecast or guarantee of harvest outcome.',
      'Local microclimate, cultivar maturity group, irrigation scheduling, and market logistics require local agronomic verification.',
      ...(env
        ? []
        : [
            'Environmental data not connected yet; climate suitability uses neutral baseline until NASA POWER data is fetched.',
          ]),
    ],
  };
}

export function runWhatIfSimulation(
  farm: FarmProfile,
  env: EnvironmentalSnapshot | null,
  scan: FieldScanResult | null,
  scenario: ScenarioInput
): SimulationComparison {
  const baselineRun = evaluateCrops(farm, env, scan);
  const scenarioRun = evaluateCrops(farm, env, scan, DEFAULT_DECISION_WEIGHTS, scenario);

  const deltas: CropScenarioDelta[] = scenarioRun.evaluations.map((scEv) => {
    const baseEv = baselineRun.evaluations.find((b) => b.cropId === scEv.cropId)!;
    const scoreDelta = scEv.suitabilityIndex - baseEv.suitabilityIndex;
    const rankDelta = baseEv.rank - scEv.rank;

    let maxFactorDiff = 0;
    let driver = 'No significant factor change';
    let driverAr = 'لا يوجد تغير جوهري في العوامل';
    for (const sf of scEv.factors) {
      const bf = baseEv.factors.find((x) => x.factor === sf.factor);
      if (bf) {
        const diff = sf.score - bf.score;
        if (Math.abs(diff) > Math.abs(maxFactorDiff)) {
          maxFactorDiff = diff;
          driver = `${sf.label} (${diff >= 0 ? '+' : ''}${diff} pts)`;
          driverAr = `${sf.labelAr} (${diff >= 0 ? '+' : ''}${diff} نقطة)`;
        }
      }
    }

    let riskShift = 'Unchanged risk profile';
    if (!baseEv.excluded && scEv.excluded) riskShift = 'Triggered hard exclusion constraint';
    else if (baseEv.excluded && !scEv.excluded) riskShift = 'Cleared hard exclusion constraint';
    else if (scoreDelta <= -10) riskShift = 'Elevated stress / suitability drop';
    else if (scoreDelta >= 8) riskShift = 'Improved relative resilience';

    return {
      cropId: scEv.cropId,
      cropName: scEv.cropName,
      cropNameAr: scEv.cropNameAr,
      baselineRank: baseEv.rank,
      scenarioRank: scEv.rank,
      rankDelta,
      baselineScore: baseEv.suitabilityIndex,
      scenarioScore: scEv.suitabilityIndex,
      scoreDelta,
      baselineExcluded: baseEv.excluded,
      scenarioExcluded: scEv.excluded,
      primaryDriver: driver,
      primaryDriverAr: driverAr,
      riskShift,
    };
  });

  const nonExcluded = scenarioRun.evaluations.filter((e) => !e.excluded);
  const topResilient = nonExcluded[0] ?? scenarioRun.evaluations[0];

  return {
    scenario,
    computedAt: new Date().toISOString(),
    baselineRun,
    scenarioRun,
    deltas,
    mostResilientCropId: topResilient.cropId,
    mostResilientCropName: topResilient.cropName,
    mostResilientCropNameAr: topResilient.cropNameAr,
    disclaimer:
      'Scenario analysis output recalculated by Field Shift Decision Engine. Represents comparative agronomic sensitivity, not a meteorological forecast or guaranteed yield.',
  };
}

function getNextSeason(s: SeasonOption): SeasonOption {
  const order: SeasonOption[] = ['winter', 'spring', 'summer', 'autumn'];
  return order[(order.indexOf(s) + 1) % 4];
}

function getPrevSeason(s: SeasonOption): SeasonOption {
  const order: SeasonOption[] = ['winter', 'spring', 'summer', 'autumn'];
  return order[(order.indexOf(s) + 3) % 4];
}

export function generateRotationPlan(
  farm: FarmProfile,
  env: EnvironmentalSnapshot | null,
  scan: FieldScanResult | null
): RotationPlan {
  const currentDecision = evaluateCrops(farm, env, scan);
  const nextSeason = farm.season;
  const currentSeason = getPrevSeason(nextSeason);
  const prevSeason = getPrevSeason(currentSeason);
  const futureSeason = getNextSeason(nextSeason);

  const prevCropKey = farm.previousCrop;
  const currCropKey = farm.currentCrop;

  const prevStep: RotationSeasonStep = {
    slot: 'previous',
    slotLabel: 'Previous Season',
    slotLabelAr: 'الموسم السابق',
    seasonName: prevSeason,
    chosenCrop: prevCropKey,
    chosenCropName:
      prevCropKey === 'fallow'
        ? 'Fallow'
        : prevCropKey === 'unknown'
        ? 'Unknown'
        : SUPPORTED_CROPS[prevCropKey].name,
    chosenCropNameAr:
      prevCropKey === 'fallow'
        ? 'أرض مستريحة'
        : prevCropKey === 'unknown'
        ? 'غير معروف'
        : SUPPORTED_CROPS[prevCropKey].nameAr,
    alternatives: [],
    cropFamily:
      prevCropKey === 'fallow' || prevCropKey === 'unknown'
        ? 'N/A'
        : SUPPORTED_CROPS[prevCropKey].family,
    waterDemand:
      prevCropKey === 'fallow' || prevCropKey === 'unknown'
        ? 'unknown'
        : SUPPORTED_CROPS[prevCropKey].waterDemandLevel,
    environmentalFit: 'Historical user-reported context',
    environmentalFitAr: 'سياق تاريخي مُدخل من المستخدم',
    reason: 'Establishes pest, disease, and nitrogen carryover baseline.',
    reasonAr: 'يحدد خط الأساس لتبقي النيتروجين واحتمال استمرار الآفات.',
    rotationBenefit: 'Baseline reference',
    rotationBenefitAr: 'مرجع أساسي للدورة',
    riskNote: prevCropKey === 'unknown' ? 'Missing prior crop increases uncertainty' : 'Recorded',
    riskNoteAr: prevCropKey === 'unknown' ? 'عدم معرفة المحصول السابق يقلل دقة التخطيط' : 'مسجل',
    confidence: prevCropKey === 'unknown' ? 'low' : 'high',
  };

  const currStep: RotationSeasonStep = {
    slot: 'current',
    slotLabel: 'Current Season',
    slotLabelAr: 'الموسم الحالي',
    seasonName: currentSeason,
    chosenCrop: currCropKey,
    chosenCropName:
      currCropKey === 'none'
        ? 'Unplanted / Preparing'
        : currCropKey === 'unknown'
        ? 'Unknown'
        : SUPPORTED_CROPS[currCropKey].name,
    chosenCropNameAr:
      currCropKey === 'none'
        ? 'غير مزروع / قيد التجهيز'
        : currCropKey === 'unknown'
        ? 'غير معروف'
        : SUPPORTED_CROPS[currCropKey].nameAr,
    alternatives: [],
    cropFamily:
      currCropKey === 'none' || currCropKey === 'unknown'
        ? 'N/A'
        : SUPPORTED_CROPS[currCropKey].family,
    waterDemand:
      currCropKey === 'none' || currCropKey === 'unknown'
        ? 'unknown'
        : SUPPORTED_CROPS[currCropKey].waterDemandLevel,
    environmentalFit: scan ? `Latest AI Field Scan: ${scan.preliminaryAssessment}` : 'Active field status',
    environmentalFitAr: scan ? `آخر فحص ذكي للحقل: ${scan.preliminaryAssessment}` : 'الحالة الحالية للحقل',
    reason: 'Anchors immediate transition to the next planting window.',
    reasonAr: 'يربط الحالة الراهنة بالانتقال إلى الموسم القادم.',
    rotationBenefit:
      currCropKey !== 'none' &&
      currCropKey !== 'unknown' &&
      SUPPORTED_CROPS[currCropKey].family === 'Fabaceae'
        ? 'Active nitrogen fixation benefit'
        : 'Current field occupancy',
    rotationBenefitAr:
      currCropKey !== 'none' &&
      currCropKey !== 'unknown' &&
      SUPPORTED_CROPS[currCropKey].family === 'Fabaceae'
        ? 'تثبيت نيتروجين نشط في التربة'
        : 'المحصول القائم حالياً',
    riskNote: scan?.stressCategories.includes('lesion_or_pest')
      ? 'Foliar lesion/pest indicator flagged — break host family next season'
      : 'Monitor moisture & vigor before harvest',
    riskNoteAr: scan?.stressCategories.includes('lesion_or_pest')
      ? 'تم رصد مؤشرات آفة/تبقع — يُنصح بتغيير العائلة النباتية لاحقاً'
      : 'راقب الرطوبة والحيوية قبل الحصاد',
    confidence: currCropKey === 'unknown' ? 'low' : 'moderate',
  };

  const effectivePredecessorForNext: FarmProfile['previousCrop'] =
    currCropKey !== 'none' && currCropKey !== 'unknown' ? currCropKey : farm.previousCrop;
  const nextEvalRun = evaluateCrops({ ...farm, previousCrop: effectivePredecessorForNext }, env, scan);
  const nextTop = nextEvalRun.evaluations[0];
  const nextCropProfile = SUPPORTED_CROPS[nextTop.cropId];
  const nextAlts = nextEvalRun.evaluations.slice(1, 3).map((e) => e.cropId);

  const nextStep: RotationSeasonStep = {
    slot: 'next',
    slotLabel: 'Next Season',
    slotLabelAr: 'الموسم القادم',
    seasonName: nextSeason,
    chosenCrop: nextTop.cropId,
    chosenCropName: nextCropProfile.name,
    chosenCropNameAr: nextCropProfile.nameAr,
    alternatives: nextAlts,
    cropFamily: nextCropProfile.family,
    waterDemand: nextCropProfile.waterDemandLevel,
    environmentalFit: `Suitability Index ${nextTop.suitabilityIndex}/100`,
    environmentalFitAr: `مؤشر الملاءمة ${nextTop.suitabilityIndex}/100`,
    reason:
      nextTop.positiveFactors[0] ?? 'Highest multi-criteria fit for upcoming season and water profile.',
    reasonAr: nextTop.positiveFactorsAr[0] ?? 'أعلى ملاءمة متعددة المعايير للموسم والمياه.',
    rotationBenefit: nextCropProfile.rotationBenefits,
    rotationBenefitAr: nextCropProfile.rotationBenefitsAr,
    riskNote: nextTop.mainRisks[0] ?? 'Low structural rotation conflict detected',
    riskNoteAr: nextTop.mainRisksAr[0] ?? 'لا يوجد تعارض رئيسي في الدورة',
    confidence: nextTop.confidence,
  };

  const futureRun = evaluateCrops(
    {
      ...farm,
      season: futureSeason,
      previousCrop: nextTop.cropId,
      currentCrop: nextTop.cropId,
    },
    env,
    null
  );
  const futureTop = futureRun.evaluations[0];
  const futureCropProfile = SUPPORTED_CROPS[futureTop.cropId];
  const futureAlts = futureRun.evaluations.slice(1, 3).map((e) => e.cropId);

  const futureStep: RotationSeasonStep = {
    slot: 'future',
    slotLabel: 'Following Season',
    slotLabelAr: 'الموسم المستقبلي',
    seasonName: futureSeason,
    chosenCrop: futureTop.cropId,
    chosenCropName: futureCropProfile.name,
    chosenCropNameAr: futureCropProfile.nameAr,
    alternatives: futureAlts,
    cropFamily: futureCropProfile.family,
    waterDemand: futureCropProfile.waterDemandLevel,
    environmentalFit: `Projected Index ${futureTop.suitabilityIndex}/100 (${futureSeason})`,
    environmentalFitAr: `مؤشر متوقع ${futureTop.suitabilityIndex}/100 (${futureSeason})`,
    reason: `Follows ${nextCropProfile.name} (${nextCropProfile.family}) with ${futureCropProfile.family} to diversify root depth and break pest continuity.`,
    reasonAr: `يتبع ${nextCropProfile.nameAr} بتنويع العائلة النباتية لتجديد التربة وكسر دورة الآفات.`,
    rotationBenefit: futureCropProfile.rotationBenefits,
    rotationBenefitAr: futureCropProfile.rotationBenefitsAr,
    riskNote: 'Long-range seasonal plan depends on actual future water allocation and weather.',
    riskNoteAr: 'الخطة المستقبلية تعتمد على توفر المياه والظروف الجوية الفعلية لاحقاً.',
    confidence: 'low',
  };

  return {
    farmId: farm.id,
    generatedAt: new Date().toISOString(),
    advisoryNotice:
      'Advisory environmental and resource rotation plan — verify planting dates and cultivar maturity locally before purchasing seed.',
    advisoryNoticeAr:
      'خطة دورة زراعية استرشادية للموارد والبيئة — يرجى التحقق محلياً من مواعيد الزراعة والأصناف المناسبة.',
    steps: [prevStep, currStep, nextStep, futureStep],
    missingInfo: currentDecision.missingInputs,
  };
}

export function generateFarmAlerts(
  farm: FarmProfile,
  env: EnvironmentalSnapshot | null,
  scan: FieldScanResult | null,
  decision: DecisionRun
): FarmAlert[] {
  const alerts: FarmAlert[] = [];

  if (
    scan &&
    scan.qualityStatus === 'usable' &&
    scan.stressCategories.some((c) => c !== 'healthy_vigor' && c !== 'none')
  ) {
    alerts.push({
      id: 'alert_scan_stress',
      severity: scan.stressCategories.includes('lesion_or_pest') ? 'urgent' : 'warning',
      title: `Field scan detected: ${scan.preliminaryAssessment}`,
      titleAr: `مؤشر فحص الحقل: ${scan.preliminaryAssessment}`,
      reason:
        scan.visualEvidence.slice(0, 2).join('; ') ||
        'Visible stress indicators observed in uploaded photo.',
      reasonAr:
        scan.visualEvidence.slice(0, 2).join('؛ ') ||
        'تمت ملاحظة مؤشرات إجهاد مرئية في الصورة المرفوعة.',
      suggestedAction:
        scan.suggestedNextSteps[0] ??
        'Inspect multiple field zones and consult a local agronomist before intervention.',
      suggestedActionAr:
        scan.suggestedNextSteps[0] ?? 'افحص عدة نقاط في الحقل واستشر مهندساً زراعياً محلياً.',
      source: 'AI Field Scan (visual assessment)',
    });
  }

  if (env?.summary.maxTempC !== null && env?.summary.maxTempC !== undefined && env.summary.maxTempC >= 35) {
    alerts.push({
      id: 'alert_heat_peak',
      severity: 'urgent',
      title: `Elevated heat peak (${env.summary.maxTempC.toFixed(1)}°C)`,
      titleAr: `ذروة حرارة مرتفعة (${env.summary.maxTempC.toFixed(1)}°م)`,
      reason:
        'Recent NASA POWER maximum air temperature exceeded 35°C, increasing evapotranspiration and pollination stress.',
      reasonAr:
        'تجاوزت الحرارة العظمى في بيانات NASA POWER عتبة 35°م مما يرفع البخر والإجهاد.',
      suggestedAction:
        'Prioritize heat-resilient crops or shift irrigation timing to early morning/evening.',
      suggestedActionAr:
        'فضّل المحاصيل الأكثر تحملاً للحرارة أو انقل مواعيد الري إلى الصباح الباكر.',
      source: 'NASA POWER (satellite-derived)',
    });
  }

  if (farm.waterAvailability === 'scarce' || farm.waterAvailability === 'limited') {
    const excludedCount = decision.evaluations.filter((e) => e.excluded).length;
    if (excludedCount > 0) {
      alerts.push({
        id: 'alert_water_constraint',
        severity: 'warning',
        title: `${excludedCount} crop(s) constrained by ${farm.waterAvailability} water`,
        titleAr: `${excludedCount} محصول/محاصيل مقيدة بسبب ${
          farm.waterAvailability === 'scarce' ? 'شح' : 'محدودية'
        } المياه`,
        reason:
          'High water-demand crops fail the seasonal water budget compatibility check under current farm water status.',
        reasonAr:
          'المحاصيل عالية الاستهلاك للمياه لا تتوافق مع الميزانية المائية الحالية للمزرعة.',
        suggestedAction:
          'Review Sunflower or Clover options or run the What-If Simulator before finalizing planting.',
        suggestedActionAr: 'راجع خيارات دوار الشمس أو البرسيم أو جرّب محاكي السيناريوهات.',
        source: 'Field Shift Decision Engine',
      });
    }
  }

  if (decision.missingInputs.length > 0) {
    alerts.push({
      id: 'alert_missing_data',
      severity: 'info',
      title: `Confidence limited (${decision.overallConfidenceScore}%) due to ${decision.missingInputs.length} missing input(s)`,
      titleAr: `مستوى الثقة محدود (${decision.overallConfidenceScore}%) لنقص ${decision.missingInputs.length} مدخلات`,
      reason: decision.missingInputs.slice(0, 2).join('; '),
      reasonAr: decision.missingInputsAr.slice(0, 2).join('؛ '),
      suggestedAction:
        'Upload a soil report photo or draw exact farm boundaries to strengthen recommendation confidence.',
      suggestedActionAr:
        'ارفع صورة تحليل التربة أو ارسم حدود المزرعة بدقة لرفع موثوقية التوصية.',
      source: 'Data Completeness Check',
    });
  }

  return alerts;
}
