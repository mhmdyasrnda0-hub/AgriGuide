// Generated from data/Database_for_crops_google.xlsx. Do not edit manually.
// Regenerate with: npm run data:generate

export const CROP_WORKBOOK_SOURCE = {
  "file": "data/Database_for_crops.xlsx",
  "sheet": "Sheet1"
} as const;

export const CROP_WORKBOOK_RECORDS = [
  {
    "cropName": "Wheat",
    "scientificName": "Triticum aestivum L",
    "sourceFamily": "Gramineae",
    "growingSeason": "Winter",
    "plantingDates": "15 November to 30 November",
    "growthDurationText": "Takes 180 to 250 day",
    "growthDurationDays": [
      180,
      250
    ],
    "temperatureRequirementText": "15°C to 24°C",
    "temperatureRangeC": [
      15,
      24
    ],
    "nextSuitableCrops": "Next: Heat-tolerant, fast-growing, nitrogen-restoring, non-cereal"
  },
  {
    "cropName": "Rice",
    "scientificName": "Oryza Sativa",
    "sourceFamily": "Poaceae",
    "growingSeason": "Summer",
    "plantingDates": "April and May",
    "growthDurationText": "105 to 150 day",
    "growthDurationDays": [
      105,
      150
    ],
    "temperatureRequirementText": "25°C to 35°C",
    "temperatureRangeC": [
      25,
      35
    ],
    "nextSuitableCrops": "Lagumes, like (Soyabeans and mungbeans)"
  },
  {
    "cropName": "Faba Beans",
    "scientificName": "Viciafaba",
    "sourceFamily": "fabaceae",
    "growingSeason": "Winter",
    "plantingDates": "Mid October",
    "growthDurationText": "140 to 165 day",
    "growthDurationDays": [
      140,
      165
    ],
    "temperatureRequirementText": "15°C to 22°C",
    "temperatureRangeC": [
      15,
      22
    ],
    "nextSuitableCrops": "Next: Enriches soil for summer crops"
  },
  {
    "cropName": "Cotton",
    "scientificName": "Gossypium",
    "sourceFamily": "Malvaceae",
    "growingSeason": "Summer",
    "plantingDates": "Spring",
    "growthDurationText": "150 to 180 days",
    "growthDurationDays": [
      150,
      180
    ],
    "temperatureRequirementText": "25°C to 35°C",
    "temperatureRangeC": [
      25,
      35
    ],
    "nextSuitableCrops": "Next: Winter crops (like wheat, clover, or faba beans)"
  },
  {
    "cropName": "Maize",
    "scientificName": "Zea Mays",
    "sourceFamily": "Poaceae",
    "growingSeason": "Summer",
    "plantingDates": "October to December",
    "growthDurationText": "90 to 120 days",
    "growthDurationDays": [
      90,
      120
    ],
    "temperatureRequirementText": "21°C to 27°C",
    "temperatureRangeC": [
      21,
      27
    ],
    "nextSuitableCrops": "Next: Winter crops (wheat, faba beans, berseem)"
  }
] as const;
