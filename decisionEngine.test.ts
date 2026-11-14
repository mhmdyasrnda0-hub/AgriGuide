import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computePolygonAreaHectares,
  computePolygonCentroid,
  computePolygonPerimeterMeters,
  haversineDistanceKm,
  isValidCoordinate,
  validatePolygon,
} from './geo.js';
import {
  computeMaasHoffmanRelativeYield,
  evaluateCrops,
  generateRotationPlan,
  runWhatIfSimulation,
} from './decisionEngine.js';
import { EnvironmentalSnapshot, FarmProfile } from '../types/fieldshift.js';

const sampleEnv: EnvironmentalSnapshot = {
  id: 'env_test',
  farmId: 'farm_test',
  lat: 31.04,
  lng: 31.38,
  fetchedAt: new Date().toISOString(),
  dataDateRange: { start: '2026-01-01', end: '2026-01-14' },
  isStale: false,
  elevationMeters: 15,
  elevationSource: 'Open-Elevation SRTM',
  metrics: [],
  dailySeries: [],
  summary: {
    avgTempC: 16.5,
    maxTempC: 21.0,
    minTempC: 11.2,
    totalPrecip14dMm: 18.0,
    baselineAnnualMonthlyAvgTempC: 15.8,
    baselinePeriodPrecip14dMm: 22.0,
    avgSolarMjM2: 14.5,
    avgHumidityPct: 68,
    soilWetnessIndex: 0.48,
    rootSoilWetnessIndex: 0.52,
  },
  soilGridsReference: null,
  limitations: [],
  sourceAttribution: ['NASA POWER'],
};

const baseFarm: FarmProfile = {
  id: 'farm_test',
  name: 'Dakahlia Winter Parcel',
  locationLabel: 'Dakahlia, Egypt',
  centerLat: 31.04,
  centerLng: 31.38,
  locationAccuracyMode: 'polygon',
  boundary: [
    { lat: 31.04, lng: 31.38 },
    { lat: 31.04, lng: 31.39 },
    { lat: 31.049, lng: 31.39 },
    { lat: 31.049, lng: 31.38 },
  ],
  areaHectares: 95.3,
  previousCrop: 'faba_beans',
  currentCrop: 'none',
  season: 'winter',
  waterAvailability: 'moderate',
  goal: 'yield_stability',
  soilData: {
    ph: 7.0,
    ecSalinityDsM: 1.4,
    texture: 'clay_loam',
    drainage: 'well_drained',
    organicMatterPct: 2.3,
    source: 'user-provided data',
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('Geospatial Area, Perimeter & Coordinate Validation', () => {
  it('computes realistic geodesic square area (~95 ha) and perimeter (~3900 m)', () => {
    const areaHa = computePolygonAreaHectares(baseFarm.boundary!);
    const perimM = computePolygonPerimeterMeters(baseFarm.boundary!);
    assert.ok(areaHa > 90 && areaHa < 102, `Expected ~95 ha, got ${areaHa}`);
    assert.ok(perimM > 3800 && perimM < 4100, `Expected ~3900 m, got ${perimM}`);

    const centroid = computePolygonCentroid(baseFarm.boundary!);
    assert.ok(centroid !== null);
    assert.ok(Math.abs(centroid.lat - 31.0445) < 0.001);
  });

  it('rejects degenerate / out-of-range polygons and validates coordinates', () => {
    assert.equal(isValidCoordinate(31.04, 31.38), true);
    assert.equal(isValidCoordinate(95, 31.38), false);
    assert.equal(isValidCoordinate(31.04, -185), false);
    const check = validatePolygon([
      { lat: 31.0, lng: 31.0 },
      { lat: 31.0, lng: 31.0 },
      { lat: 31.0, lng: 31.0 },
    ]);
    assert.equal(check.valid, false);
    assert.ok(haversineDistanceKm({ lat: 30, lng: 31 }, { lat: 31, lng: 31 }) > 105);
  });
});

describe('Maas-Hoffman Salinity & FAO Water Budget Algorithms', () => {
  it('computes Maas-Hoffman relative yield strictly without invented curves', () => {
    // Below threshold => 100%
    assert.equal(computeMaasHoffmanRelativeYield(2.0, 2.5, 5.5), 100);
    // Mid-way to severe => ~75%
    assert.equal(computeMaasHoffmanRelativeYield(4.0, 2.5, 5.5), 75);
    // At severe threshold => 50%
    assert.equal(computeMaasHoffmanRelativeYield(5.5, 2.5, 5.5), 50);
    // Wheat has higher salinity threshold (6.0 dS/m) than Maize (2.5 dS/m)
    const wheatYieldAt7 = computeMaasHoffmanRelativeYield(7.0, 6.0, 9.5);
    const maizeYieldAt7 = computeMaasHoffmanRelativeYield(7.0, 2.5, 5.5);
    assert.ok(wheatYieldAt7 > maizeYieldAt7, `Expected wheat (${wheatYieldAt7}) > maize (${maizeYieldAt7}) at 7 dS/m`);
  });

  it('ranks wheat/clover ahead of out-of-season summer crops in cool winter with legume predecessor', () => {
    const run = evaluateCrops(baseFarm, sampleEnv);
    assert.equal(run.evaluations.length, 5);
    assert.ok(['wheat', 'faba_beans'].includes(run.evaluations[0].cropId));
    assert.equal(run.overallConfidence, 'high');
    assert.equal(run.missingInputs.length, 0);

    const maize = run.evaluations.find((e) => e.cropId === 'maize')!;
    assert.equal(maize.excluded, true);
  });

  it('lowers confidence honestly and flags missing inputs when NASA & soil are absent', () => {
    const minimalFarm: FarmProfile = {
      ...baseFarm,
      previousCrop: 'unknown',
      locationAccuracyMode: 'approximate',
      soilData: undefined,
    };
    const run = evaluateCrops(minimalFarm, null);
    assert.equal(run.overallConfidence, 'low');
    assert.ok(run.missingInputs.length >= 3);
  });

  it('enforces severe salinity exclusion via Maas-Hoffman on sensitive crops', () => {
    const salineFarm: FarmProfile = {
      ...baseFarm,
      season: 'summer',
      waterAvailability: 'abundant',
      soilData: { ph: 7.1, ecSalinityDsM: 6.2, texture: 'loam', source: 'user-provided data' },
    };
    const warmEnv: EnvironmentalSnapshot = {
      ...sampleEnv,
      summary: { ...sampleEnv.summary, avgTempC: 25, maxTempC: 31, minTempC: 18 },
    };
    const run = evaluateCrops(salineFarm, warmEnv);
    const maize = run.evaluations.find((e) => e.cropId === 'maize')!;
    assert.equal(maize.excluded, true);
    assert.ok(maize.hardConstraints.some((c) => c.code === 'SEVERE_SALINITY_EXCLUSION'));
  });

  it('recomputes heat-peak and water-scarce deltas in What-If Simulator consistently', () => {
    const summerFarm: FarmProfile = {
      ...baseFarm,
      season: 'summer',
      waterAvailability: 'moderate',
      previousCrop: 'wheat',
    };
    const summerEnv: EnvironmentalSnapshot = {
      ...sampleEnv,
      summary: { ...sampleEnv.summary, avgTempC: 26, maxTempC: 33, minTempC: 19 },
    };
    const sim = runWhatIfSimulation(summerFarm, summerEnv, null, {
      tempDeltaC: 4,
      waterAvailabilityPct: 50,
      rainfallDeltaPct: -40,
      soilMoistureScenario: 'dry',
    });
    const cottonDelta = sim.deltas.find((d) => d.cropId === 'cotton')!;
    const maizeDelta = sim.deltas.find((d) => d.cropId === 'maize')!;
    assert.ok(maizeDelta.scoreDelta < 0);
    assert.ok(cottonDelta.scenarioScore >= maizeDelta.scenarioScore);
  });

  it('triggers frost stress penalty cleanly when night temps fall below crop threshold', () => {
    const winterFarm: FarmProfile = {
      ...baseFarm,
      season: 'spring',
      waterAvailability: 'abundant',
    };
    const frostyEnv: EnvironmentalSnapshot = {
      ...sampleEnv,
      summary: { ...sampleEnv.summary, avgTempC: 14, maxTempC: 20, minTempC: -1.5 },
    };
    const run = evaluateCrops(winterFarm, frostyEnv);
    const maize = run.evaluations.find((e) => e.cropId === 'maize')!;
    assert.ok(maize.hardConstraints.some((c) => c.code === 'FROST_STRESS_RISK'));
  });

  it('avoids back-to-back continuous wheat in dynamic 4-season rotation', () => {
    const fabaBeansPrevFarm: FarmProfile = { ...baseFarm, previousCrop: 'faba_beans', currentCrop: 'none' };
    const plan = generateRotationPlan(fabaBeansPrevFarm, sampleEnv, null);
    assert.equal(plan.steps.length, 4);
    assert.equal(plan.steps[2].chosenCrop, 'wheat');
    assert.notEqual(plan.steps[3].chosenCrop, 'wheat');

    const wheatPrevFarm: FarmProfile = { ...baseFarm, previousCrop: 'wheat', currentCrop: 'none' };
    const planAfterWheat = generateRotationPlan(wheatPrevFarm, sampleEnv, null);
    assert.notEqual(planAfterWheat.steps[2].chosenCrop, 'wheat');
  });
});
