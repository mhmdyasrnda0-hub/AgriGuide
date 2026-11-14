import React, { useMemo, useState } from 'react';
import { ArrowRight, Droplets, Info, Thermometer } from 'lucide-react';
import { useFieldShift } from '../../context/FieldShiftContext';
import { runWhatIfSimulation } from '../../lib/decisionEngine';
import { EnvironmentalSnapshot, FarmProfile } from '../../types/fieldshift';

// Explicitly disclosed synthetic reference profile strictly for the interactive public preview calculator
const SYNTHETIC_PREVIEW_PARCEL: FarmProfile = {
  id: 'preview_reference_parcel',
  name: 'Simulation Preview Baseline (Synthetic)',
  locationLabel: 'Synthetic Loam Winter Reference',
  centerLat: 30.05,
  centerLng: 31.23,
  locationAccuracyMode: 'point',
  previousCrop: 'wheat',
  currentCrop: 'none',
  season: 'winter',
  waterAvailability: 'moderate',
  goal: 'yield_stability',
  soilData: {
    ph: 7.2,
    ecSalinityDsM: 2.1,
    texture: 'loam',
    drainage: 'well_drained',
    source: 'user-provided data',
    recordedAt: '2026-01-01T00:00:00.000Z',
  },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const SYNTHETIC_ENV_BASELINE: EnvironmentalSnapshot = {
  id: 'preview_env',
  farmId: 'preview_reference_parcel',
  lat: 30.05,
  lng: 31.23,
  fetchedAt: '2026-01-01T00:00:00.000Z',
  isStale: false,
  elevationMeters: 24,
  dataDateRange: { start: '2025-12-15', end: '2026-01-14' },
  sourceAttribution: ['Simulation Preview Climate Input (17.5°C mean winter baseline)'],
  summary: {
    avgTempC: 17.5,
    maxTempC: 23.2,
    minTempC: 11.4,
    totalPrecip14dMm: 18,
    baselineAnnualMonthlyAvgTempC: 18.0,
    baselinePeriodPrecip14dMm: 20,
    avgSolarMjM2: 14.5,
    avgHumidityPct: 58,
    soilWetnessIndex: 0.44,
    rootSoilWetnessIndex: 0.46,
  },
  metrics: [],
  dailySeries: [],
  limitations: ['Synthetic baseline used strictly for interactive what-if demonstration.'],
};

export function ScenarioPreviewSection() {
  const { language, setActiveSection } = useFieldShift();
  const isAr = language === 'ar';
  const [waterPct, setWaterPct] = useState(100);
  const [tempDeltaC, setTempDeltaC] = useState(0);

  const comparison = useMemo(
    () =>
      runWhatIfSimulation(SYNTHETIC_PREVIEW_PARCEL, SYNTHETIC_ENV_BASELINE, null, {
        waterAvailabilityPct: waterPct,
        tempDeltaC,
        rainfallDeltaPct: waterPct < 80 ? -25 : 0,
        soilMoistureScenario: waterPct <= 60 ? 'dry' : 'baseline',
      }),
    [waterPct, tempDeltaC]
  );

  return (
    <section
      id="scenario-preview-section"
      aria-labelledby="scenario-preview-heading"
      className="py-16 sm:py-20 bg-white"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
          {/* Left Narrative + Interactive Controls */}
          <div className="lg:col-span-5 space-y-5">
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-[#1769E0]">
                {isAr ? 'محاكي سيناريوهات المناخ والمياه' : 'What-If Climate & Water Stress Lab'}
              </p>
              <h2
                id="scenario-preview-heading"
                className="text-2xl sm:text-3xl font-bold text-[#0B2A5B] tracking-tight"
              >
                {isAr
                  ? 'اختبر صمود قرارك قبل تغيّر الحرارة أو شح المياه.'
                  : 'Test what shifts when water drops or heat rises.'}
              </h2>
              <p className="text-sm text-[#66758A] leading-relaxed">
                {isAr
                  ? 'يحسب المحرك الفعلي معادلات الإجهاد المائي والحراري مباشرة. حرّك المؤشرات لمشاهدة تغير ملاءمة المحاصيل.'
                  : 'Adjust irrigation supply and temperature offset below. Field Shift recalculates deterministic FAO water budgets and thermal curves in real time.'}
              </p>
            </div>

            <div className="rounded-2xl bg-[#F7FAFE] border border-[#DCE7F5] p-5 space-y-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-[#0B2A5B]">
                  <label htmlFor="preview-water-slider" className="flex items-center gap-1.5">
                    <Droplets className="w-4 h-4 text-[#1769E0]" />
                    <span>{isAr ? 'توفر مياه الري' : 'Seasonal Water Availability'}</span>
                  </label>
                  <span className="font-mono tabular-nums text-[#1769E0]">{waterPct}%</span>
                </div>
                <input
                  id="preview-water-slider"
                  type="range"
                  min={40}
                  max={120}
                  step={5}
                  value={waterPct}
                  onChange={(e) => setWaterPct(Number(e.target.value))}
                  className="w-full accent-[#1769E0] cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-[#0B2A5B]">
                  <label htmlFor="preview-temp-slider" className="flex items-center gap-1.5">
                    <Thermometer className="w-4 h-4 text-[#E45C67]" />
                    <span>{isAr ? 'تغير متوسط الحرارة' : 'Temperature Shift (°C)'}</span>
                  </label>
                  <span className="font-mono tabular-nums text-[#0B2A5B]">
                    {tempDeltaC > 0 ? `+${tempDeltaC}°C` : `${tempDeltaC}°C`}
                  </span>
                </div>
                <input
                  id="preview-temp-slider"
                  type="range"
                  min={-2}
                  max={5}
                  step={0.5}
                  value={tempDeltaC}
                  onChange={(e) => setTempDeltaC(Number(e.target.value))}
                  className="w-full accent-[#1769E0] cursor-pointer"
                />
              </div>

              <div className="flex items-start gap-2 pt-2 border-t border-[#DCE7F5] text-[11px] text-[#66758A]">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#1769E0]" />
                <span>
                  {isAr
                    ? 'معاينة محاكاة مبنية على قطعة مرجعية افتراضية (تربة طميية شتوية، pH 7.2) للشرح التفاعلي فقط — سجّل مزرعتك لتشغيل الحساب على بياناتك الحقيقية.'
                    : 'Simulation Preview Baseline: Synthetic Loam Winter reference parcel (pH 7.2, 17.5°C baseline). Capture your farm to evaluate real site NASA POWER data.'}
                </span>
              </div>
            </div>
          </div>

          {/* Right Live Recalculated Sensitivity Matrix */}
          <div className="lg:col-span-7 rounded-2xl border border-[#DCE7F5] bg-[#F7FAFE] p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#DCE7F5]">
              <div>
                <h3 className="text-sm font-bold text-[#0B2A5B]">
                  {isAr ? 'نتائج استجابة المحاصيل للسيناريو' : 'Deterministic Engine Sensitivity Output'}
                </h3>
                <p className="text-xs text-[#66758A]">
                  {isAr ? 'أكثر محصول صموداً في هذا السيناريو:' : 'Most resilient under selected shift:'}{' '}
                  <strong className="text-[#1769E0]">
                    {isAr ? comparison.mostResilientCropNameAr : comparison.mostResilientCropName}
                  </strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveSection('capture')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1769E0] hover:underline cursor-pointer"
              >
                <span>{isAr ? 'شغّل المحاكي على مزرعتك' : 'Run on Your Real Field'}</span>
                <ArrowRight className={`w-3.5 h-3.5 ${isAr ? 'rotate-180' : ''}`} />
              </button>
            </div>

            <div className="space-y-2.5">
              {comparison.deltas.map((d) => (
                <div
                  key={d.cropId}
                  className="rounded-xl bg-white border border-[#DCE7F5] px-4 py-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[#0B2A5B]">
                        {isAr ? d.cropNameAr : d.cropName}
                      </span>
                      {d.scenarioExcluded && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-[#E45C67]/12 text-[#E45C67]">
                          {isAr ? 'قيد استبعاد' : 'Excluded'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#66758A] truncate">
                      {isAr ? d.primaryDriverAr : d.primaryDriver}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 font-mono tabular-nums">
                    <span className="text-xs text-[#66758A]">{d.baselineScore} →</span>
                    <span className="text-sm font-bold text-[#0B2A5B]">{d.scenarioScore}/100</span>
                    <span
                      className={`text-xs font-bold min-w-[44px] text-end ${
                        d.scoreDelta > 0
                          ? 'text-[#19A974]'
                          : d.scoreDelta < 0
                          ? 'text-[#E45C67]'
                          : 'text-[#66758A]'
                      }`}
                    >
                      {d.scoreDelta > 0 ? `+${d.scoreDelta}` : d.scoreDelta}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
