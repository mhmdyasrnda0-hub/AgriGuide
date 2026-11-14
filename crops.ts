import { CropId, CropProfile } from '../types/fieldshift';
import { CROP_WORKBOOK_RECORDS, CROP_WORKBOOK_SOURCE } from './cropWorkbook.generated';

const workbookRecordByName = new Map(CROP_WORKBOOK_RECORDS.map((record) => [record.cropName.toLowerCase(), record]));

/**
 * STRICT DATABASE: Exactly matches the 5 crops from "Database for crops.xlsx"
 * No external synthetic crops or unauthorized additions.
 */
export const SUPPORTED_CROPS: Record<CropId, CropProfile> = {
  wheat: {
    id: 'wheat',
    name: 'Wheat',
    nameAr: 'القمح',
    scientificName: 'Triticum aestivum L',
    family: 'Poaceae',
    familyAr: 'النجيلية (Gramineae)',
    roleLabel: 'Cool-season staple cereal',
    roleLabelAr: 'محصول شتوي أساسي',
    preferredSeasons: ['winter'],
    marginalSeasons: ['autumn'],
    optimalTempC: [15, 24],
    viableTempC: [10, 28],
    waterDemandLevel: 'moderate',
    seasonalWaterMm: [450, 650],
    rainfallSensitivity: 'Planting Dates: 15 November to 30 November. Growth Duration: 180 to 250 days.',
    rainfallSensitivityAr: 'مواعيد الزراعة: 15 إلى 30 نوفمبر. مدة النمو: 180 إلى 250 يوماً.',
    compatibleTextures: ['loam', 'clay_loam', 'silty_loam', 'clay'],
    optimalPhRange: [6.0, 7.5],
    viablePhRange: [5.5, 8.2],
    maxSafeEcDsM: 6.0,
    severeEcDsM: 9.5,
    drainageRequirement: 'moderate_to_well',
    growthDurationDays: [180, 250],
    rotationBenefits: 'Next: Heat-tolerant, fast-growing, nitrogen-restoring, non-cereal',
    rotationBenefitsAr: 'المحصول التالي المناسب: محصول متحمل للحرارة، سريع النمو، معوض للنيتروجين، وغير نجيلي.',
    avoidAfterSameCrop: true,
    avoidAfterFamily: 'Poaceae',
    stressIndicators: [
      'Yellowing leaves indicating nitrogen deficiency',
      'Leaf tip burn under moisture deficit',
    ],
    pestAndDiseaseCategories: ['Rusts', 'Aphids'],
    sources: ['Database for crops.xlsx'],
    uncertaintyNotes: 'Temperature requirement: 15°C to 24°C',
  },

  rice: {
    id: 'rice',
    name: 'Rice',
    nameAr: 'الأرز',
    scientificName: 'Oryza Sativa',
    family: 'Poaceae',
    familyAr: 'النجيلية (Poaceae)',
    roleLabel: 'Warm-season cereal',
    roleLabelAr: 'محصول صيفي أساسي',
    preferredSeasons: ['summer'],
    marginalSeasons: [],
    optimalTempC: [25, 35],
    viableTempC: [20, 38],
    waterDemandLevel: 'high',
    seasonalWaterMm: [900, 1400],
    rainfallSensitivity: 'Planting Dates: April and May. Growth Duration: 105 to 150 days.',
    rainfallSensitivityAr: 'مواعيد الزراعة: أبريل ومايو. مدة النمو: 105 إلى 150 يوماً.',
    compatibleTextures: ['clay', 'clay_loam'],
    optimalPhRange: [5.5, 7.0],
    viablePhRange: [5.0, 7.8],
    maxSafeEcDsM: 3.0,
    severeEcDsM: 6.0,
    drainageRequirement: 'tolerant',
    growthDurationDays: [105, 150],
    rotationBenefits: 'Next: Legumes, like (Soybeans and mungbeans)',
    rotationBenefitsAr: 'المحصول التالي المناسب: بقوليات مثل فول الصويا واللوبيا.',
    avoidAfterSameCrop: true,
    avoidAfterFamily: 'Poaceae',
    stressIndicators: ['Leaf rolling under water deficit', 'Blast lesions'],
    pestAndDiseaseCategories: ['Stem borers', 'Blast'],
    sources: ['Database for crops.xlsx'],
    uncertaintyNotes: 'Temperature requirement: 25°C to 35°C',
  },

  faba_beans: {
    id: 'faba_beans',
    name: 'Faba Beans',
    nameAr: 'الفول البلدي',
    scientificName: 'Viciafaba',
    family: 'Fabaceae',
    familyAr: 'البقولية (Fabaceae)',
    roleLabel: 'Cool-season legume',
    roleLabelAr: 'محصول شتوي بقولي',
    preferredSeasons: ['winter'],
    marginalSeasons: [],
    optimalTempC: [15, 22],
    viableTempC: [10, 26],
    waterDemandLevel: 'moderate',
    seasonalWaterMm: [350, 550],
    rainfallSensitivity: 'Planting Dates: Mid October. Growth Duration: 140 to 165 days.',
    rainfallSensitivityAr: 'مواعيد الزراعة: منتصف أكتوبر. مدة النمو: 140 إلى 165 يوماً.',
    compatibleTextures: ['loam', 'clay_loam', 'silty_loam'],
    optimalPhRange: [6.5, 8.0],
    viablePhRange: [6.0, 8.5],
    maxSafeEcDsM: 3.5,
    severeEcDsM: 6.5,
    drainageRequirement: 'moderate_to_well',
    growthDurationDays: [140, 165],
    rotationBenefits: 'Next: Enriches soil for summer crops',
    rotationBenefitsAr: 'المحصول التالي المناسب: يغني التربة بالخصوبة للمحاصيل الصيفية اللاحقة.',
    avoidAfterSameCrop: true,
    avoidAfterFamily: 'Fabaceae',
    stressIndicators: ['Chocolate spot', 'Flower drop under early heat'],
    pestAndDiseaseCategories: ['Chocolate spot', 'Aphids'],
    sources: ['Database for crops.xlsx'],
    uncertaintyNotes: 'Temperature requirement: 15°C to 22°C',
  },

  cotton: {
    id: 'cotton',
    name: 'Cotton',
    nameAr: 'القطن',
    scientificName: 'Gossypium',
    family: 'Asteraceae',
    familyAr: 'الخبازية (Malvaceae)',
    roleLabel: 'Warm-season fiber crop',
    roleLabelAr: 'محصول صيفي اقتصادي',
    preferredSeasons: ['summer'],
    marginalSeasons: ['spring'],
    optimalTempC: [25, 35],
    viableTempC: [18, 40],
    waterDemandLevel: 'high',
    seasonalWaterMm: [700, 1050],
    rainfallSensitivity: 'Planting Dates: Spring. Growth Duration: 150 to 180 days.',
    rainfallSensitivityAr: 'مواعيد الزراعة: فصل الربيع. مدة النمو: 150 إلى 180 يوماً.',
    compatibleTextures: ['clay_loam', 'loam', 'silty_loam'],
    optimalPhRange: [6.0, 7.5],
    viablePhRange: [5.5, 8.5],
    maxSafeEcDsM: 7.7,
    severeEcDsM: 11.0,
    drainageRequirement: 'moderate_to_well',
    growthDurationDays: [150, 180],
    rotationBenefits: 'Next: Winter crops (like wheat, clover, or faba beans)',
    rotationBenefitsAr: 'المحصول التالي المناسب: محاصيل شتوية (كالقمح أو البرسيم أو الفول البلدي).',
    avoidAfterSameCrop: true,
    avoidAfterFamily: undefined,
    stressIndicators: ['Boll shedding', 'Foliar wilting'],
    pestAndDiseaseCategories: ['Bollworms', 'Whitefly'],
    sources: ['Database for crops.xlsx'],
    uncertaintyNotes: 'Temperature requirement: 25°C to 35°C',
  },

  maize: {
    id: 'maize',
    name: 'Maize',
    nameAr: 'الذرة الشامية',
    scientificName: 'Zea Mays',
    family: 'Poaceae',
    familyAr: 'النجيلية (Poaceae)',
    roleLabel: 'Warm-season cereal',
    roleLabelAr: 'محصول صيفي نجيلي',
    preferredSeasons: ['summer'],
    marginalSeasons: [],
    optimalTempC: [21, 27],
    viableTempC: [15, 35],
    waterDemandLevel: 'high',
    seasonalWaterMm: [550, 800],
    rainfallSensitivity: 'Planting Dates: October to December. Growth Duration: 90 to 120 days.',
    rainfallSensitivityAr: 'مواعيد الزراعة: أكتوبر إلى ديسمبر (أو صيفي حسب العروة). مدة النمو: 90 إلى 120 يوماً.',
    compatibleTextures: ['loam', 'silty_loam', 'clay_loam'],
    optimalPhRange: [5.8, 7.2],
    viablePhRange: [5.2, 8.0],
    maxSafeEcDsM: 2.5,
    severeEcDsM: 5.5,
    drainageRequirement: 'well_drained',
    growthDurationDays: [90, 120],
    rotationBenefits: 'Next: Winter crops (wheat, faba beans, berseem)',
    rotationBenefitsAr: 'المحصول التالي المناسب: محاصيل شتوية (قمح، فول بلدي، برسيم).',
    avoidAfterSameCrop: true,
    avoidAfterFamily: 'Poaceae',
    stressIndicators: ['Leaf rolling under water deficit', 'Tassel blasting under heat'],
    pestAndDiseaseCategories: ['Fall armyworm', 'Corn borers'],
    sources: ['Database for crops.xlsx'],
    uncertaintyNotes: 'Temperature requirement: 21°C to 27°C',
  },
};

/**
 * EXACT 5 CROPS from user's Excel file:
 * Wheat, Rice, Faba Beans, Cotton, Maize
 */
export const CROP_IDS: CropId[] = ['wheat', 'rice', 'faba_beans', 'cotton', 'maize'];

const cropIdByWorkbookName: Record<string, CropId> = {
  wheat: 'wheat',
  rice: 'rice',
  'faba beans': 'faba_beans',
  cotton: 'cotton',
  maize: 'maize',
};

// Apply authoritative values from the uploaded workbook without replacing the
// extended agronomic fields that are not present in that workbook.
for (const [workbookName, cropId] of Object.entries(cropIdByWorkbookName)) {
  const source = workbookRecordByName.get(workbookName);
  const crop = SUPPORTED_CROPS[cropId];
  if (!source || !crop) continue;
  crop.scientificName = source.scientificName;
  crop.sourceFamily = source.sourceFamily;
  crop.optimalTempC = [...source.temperatureRangeC] as [number, number];
  crop.growthDurationDays = [...source.growthDurationDays] as [number, number];
  crop.rainfallSensitivity = `Planting Dates: ${source.plantingDates}. Growth Duration: ${source.growthDurationText}.`;
  crop.rotationBenefits = source.nextSuitableCrops;
  crop.sources = [CROP_WORKBOOK_SOURCE.file];
  crop.uncertaintyNotes = `Temperature requirement: ${source.temperatureRequirementText}; source family: ${source.sourceFamily}.`;
}
