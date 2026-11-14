import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import XLSX from 'xlsx';

const root = process.cwd();
const input = path.join(root, 'data', 'Database_for_crops.xlsx');
const output = path.join(root, 'src', 'data', 'cropWorkbook.generated.ts');

const normalize = (value) => String(value ?? '').replace(/\u00a0/g, ' ').trim();
const key = (value) => normalize(value).toLowerCase().replace(/\s+/g, ' ');

function parseRange(value, label) {
  const matches = normalize(value).match(/-?\d+(?:\.\d+)?/g) ?? [];
  if (matches.length < 2) throw new Error(`Could not parse ${label}: ${value}`);
  return [Number(matches[0]), Number(matches[1])];
}

function parseDuration(value) {
  const matches = normalize(value).match(/\d+(?:\.\d+)?/g) ?? [];
  if (matches.length < 2) throw new Error(`Could not parse growth duration: ${value}`);
  return [Number(matches[0]), Number(matches[1])];
}

if (!fs.existsSync(input)) throw new Error(`Missing input workbook: ${input}`);
const workbook = XLSX.readFile(input, { cellDates: false });
const sheetName = workbook.SheetNames[0];
const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '' });
if (!rows.length || !rows[0]?.length) throw new Error('The crop workbook is empty.');

const parameterRow = new Map();
for (let row = 1; row < rows.length; row += 1) {
  const parameter = key(rows[row][0]);
  if (parameter) parameterRow.set(parameter, row);
}
const cropNames = rows[1]?.slice(1).map(normalize).filter(Boolean) ?? [];
if (!cropNames.length) throw new Error('No crop columns detected in row 2.');

const required = [
  'crop name',
  'scientific name',
  'crop family',
  'growing season',
  'planting dates',
  'growth duration',
  'temperature requirements',
  'next suitable crops',
];
for (const field of required) if (!parameterRow.has(field)) throw new Error(`Missing workbook parameter row: ${field}`);

const get = (parameter, column) => normalize(rows[parameterRow.get(parameter)][column]);
const records = cropNames.map((cropName, index) => {
  const column = index + 1;
  const temperatureText = get('temperature requirements', column);
  const durationText = get('growth duration', column);
  const [temperatureMinC, temperatureMaxC] = parseRange(temperatureText, 'temperature range');
  const [growthDurationMinDays, growthDurationMaxDays] = parseDuration(durationText);
  return {
    cropName,
    scientificName: get('scientific name', column),
    sourceFamily: get('crop family', column),
    growingSeason: get('growing season', column),
    plantingDates: get('planting dates', column),
    growthDurationText: durationText,
    growthDurationDays: [growthDurationMinDays, growthDurationMaxDays],
    temperatureRequirementText: temperatureText,
    temperatureRangeC: [temperatureMinC, temperatureMaxC],
    nextSuitableCrops: get('next suitable crops', column),
  };
});

const content = `// Generated from data/Database_for_crops_google.xlsx. Do not edit manually.\n` +
  `// Regenerate with: npm run data:generate\n\n` +
  `export const CROP_WORKBOOK_SOURCE = ${JSON.stringify({ file: 'data/Database_for_crops.xlsx', sheet: sheetName }, null, 2)} as const;\n\n` +
  `export const CROP_WORKBOOK_RECORDS = ${JSON.stringify(records, null, 2)} as const;\n`;

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, content);
console.log(`Generated ${records.length} crop records from ${sheetName} -> ${output}`);
