import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Compass,
  Droplets,
  Globe2,
  HelpCircle,
  Info,
  MapPin,
  ShieldAlert,
  Sparkles,
  X,
} from 'lucide-react';
import { useFieldShift } from '../context/FieldShiftContext';
import { SUPPORTED_CROPS } from '../data/crops';
import { generateRotationPlan } from '../lib/decisionEngine';
import { t } from '../i18n/translations';
import { CropEvaluation } from '../types/fieldshift';

function factorBarColor(status: string): string {
  if (status === 'strong') return 'bg-[#19A974]';
  if (status === 'acceptable') return 'bg-[#1769E0]';
  if (status === 'constrained') return 'bg-[#E45C67]';
  return 'bg-[#66758A]/40';
}

export function DecisionStudioView() {
  const {
    language,
    activeFarm,
    envByFarm,
    scansByFarm,
    activeDecision,
    decisionSubTab,
    setDecisionSubTab,
    setActiveSection,
    fetchEarthIntelligence,
    envLoading,
  } = useFieldShift();

  const [explainedCrop, setExplainedCrop] = useState<CropEvaluation | null>(null);
  const lastTriggerRef = React.useRef<HTMLButtonElement | null>(null);
  const closeDrawerRef = React.useRef<HTMLButtonElement | null>(null);
  const isAr = language === 'ar';
  const activeEnv = activeFarm ? envByFarm[activeFarm.id] ?? null : null;
  const latestScan = activeFarm ? scansByFarm[activeFarm.id]?.[0] ?? null : null;

  React.useEffect(() => {
    if (!explainedCrop) return;
    closeDrawerRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setExplainedCrop(null);
        lastTriggerRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [explainedCrop]);

  // Auto-connect real NASA POWER data immediately if not loaded yet
  React.useEffect(() => {
    if (activeFarm && !activeEnv && !envLoading) {
      fetchEarthIntelligence(activeFarm).catch(() => {});
    }
  }, [activeFarm, activeEnv, envLoading, fetchEarthIntelligence]);

  const rotationPlan = useMemo(() => {
    if (!activeFarm) return null;
    return generateRotationPlan(activeFarm, activeEnv, latestScan);
  }, [activeFarm, activeEnv, latestScan]);

  if (!activeFarm || !activeDecision) {
    return (
      <div className="bg-white rounded-2xl border border-[#DCE7F5] p-8 sm:p-12 text-center max-w-2xl mx-auto">
        <Compass className="w-10 h-10 text-[#1769E0] mx-auto mb-3" />
        <h1 className="text-xl font-bold text-[#0B2A5B] mb-2">
          {isAr ? 'استوديو القرار بانتظار تسجيل مزرعة' : 'Decision Studio requires a captured farm'}
        </h1>
        <p className="text-sm text-[#66758A] mb-6">
          {isAr
            ? 'سجّل موقع المزرعة وتوفر المياه والموسم لحساب مؤشر الملاءمة للمحاصيل الخمسة وخطة الدورة الزراعية.'
            : 'Capture your parcel location, upcoming season, water availability, and crop history to calculate transparent suitability rankings across the 5 supported crops.'}
        </p>
        <button
          type="button"
          onClick={() => setActiveSection('capture')}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#1769E0] text-white text-sm font-semibold hover:bg-[#0B2A5B] cursor-pointer"
        >
          <MapPin className="w-4 h-4" />
          <span>{t(language, 'scanYourFarm')}</span>
        </button>
      </div>
    );
  }

  const topCrop = activeDecision.evaluations[0];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0B2A5B] tracking-tight">
            {isAr ? 'استوديو القرار الزراعي' : 'Decision Studio'}
          </h1>
          <p className="text-sm text-[#66758A] mt-1">
            {activeFarm.name} · {activeFarm.season} ·{' '}
            <span className="font-mono text-xs">{activeDecision.ruleVersion}</span> ·{' '}
            <span className="font-semibold text-[#1769E0]">{activeDecision.provenance}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {!activeEnv && (
            <button
              type="button"
              onClick={() => fetchEarthIntelligence(activeFarm)}
              disabled={envLoading}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[#DCE7F5] bg-white text-xs font-semibold text-[#1769E0] hover:bg-[#EAF3FF] cursor-pointer"
            >
              <Globe2 className="w-3.5 h-3.5" />
              <span>{isAr ? 'ربط بيانات ناسا الآن' : 'Connect NASA Climate Data'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveSection('action')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1769E0] text-white text-xs font-semibold hover:bg-[#0B2A5B] cursor-pointer"
          >
            <span>{isAr ? 'محاكاة ماذا لو ومركز الإجراءات' : 'Simulate & Action Center'}</span>
            <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
          </button>
        </div>
      </div>

      {/* Mandatory Advisory & Missing Input Integrity Strip */}
      <div className="grid lg:grid-cols-1 gap-4">

        <div className="p-4 rounded-xl bg-white border border-[#DCE7F5] flex items-start justify-between gap-3 text-xs">
          <div>
            <p className="font-semibold text-[#0B2A5B] mb-1">
              {isAr ? 'اكتمال المدخلات ومستوى الثقة:' : 'Input Completeness & Model Confidence:'}{' '}
              <span className="tabular-nums text-[#1769E0]">
                {activeDecision.overallConfidenceScore}% ({activeDecision.overallConfidence})
              </span>
            </p>
            {activeDecision.missingInputs.length > 0 ? (
              <p className="text-[#66758A] leading-relaxed">
                {isAr ? 'لرفع دقة التقييم أضف: ' : 'To improve confidence, provide: '}
                {(isAr ? activeDecision.missingInputsAr : activeDecision.missingInputs).join(' · ')}
              </p>
            ) : (
              <p className="text-[#19A974] font-medium">
                {isAr
                  ? 'جميع المصادر الأساسية (موقع دقيق، ناسا، التربة، المحصول السابق) متوفرة.'
                  : 'All core inputs (location, live NASA POWER, soil record, and crop history) are connected.'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Sub-navigation tabs */}
      <div className="flex border-b border-[#DCE7F5] gap-6" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={decisionSubTab === 'suitability'}
          onClick={() => setDecisionSubTab('suitability')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
            decisionSubTab === 'suitability'
              ? 'border-[#1769E0] text-[#1769E0]'
              : 'border-transparent text-[#66758A] hover:text-[#12233F]'
          }`}
        >
          {isAr ? 'ترتيب المحاصيل الخمسة ومؤشر الملاءمة' : '5-Crop Suitability Ranking'}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={decisionSubTab === 'rotation'}
          onClick={() => setDecisionSubTab('rotation')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
            decisionSubTab === 'rotation'
              ? 'border-[#1769E0] text-[#1769E0]'
              : 'border-transparent text-[#66758A] hover:text-[#12233F]'
          }`}
        >
          {isAr ? 'مخطط الدورة الزراعية (4 مواسم)' : '4-Season Crop Rotation Planner'}
        </button>
      </div>

      {/* TAB 1: SUITABILITY RANKING */}
      {decisionSubTab === 'suitability' && (
        <div className="space-y-4">
          {/* Top Recommendation Summary Banner */}
          <div className="bg-white rounded-2xl border border-[#DCE7F5] p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-[#1769E0]">
                {isAr ? 'أعلى ملاءمة محسوبة للموسم القادم' : 'Highest Calculated Suitability for Next Season'} ·{' '}
                {activeDecision.provenance}
              </p>
              <h2 className="text-xl font-bold text-[#0B2A5B]">
                #{topCrop.rank} {isAr ? topCrop.cropNameAr : topCrop.cropName}{' '}
                <span className="text-sm font-normal text-[#66758A]">({topCrop.scientificName})</span>
              </h2>
              <p className="text-xs text-[#66758A]">
                {(isAr ? topCrop.positiveFactorsAr[0] : topCrop.positiveFactors[0]) ||
                  (isAr ? 'أفضل توازن عبر العوامل الخمسة' : 'Strongest balance across water, climate, soil, season, and rotation.')}
              </p>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <div className="text-end">
                <p className="text-3xl font-bold text-[#0B2A5B] tabular-nums">
                  {topCrop.suitabilityIndex}
                  <span className="text-sm font-normal text-[#66758A]">/100</span>
                </p>
                <p className="text-[11px] text-[#66758A]">
                  {isAr ? 'مستوى الثقة:' : 'Confidence:'} {topCrop.confidenceScore}% ({topCrop.confidence})
                </p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  lastTriggerRef.current = e.currentTarget;
                  setExplainedCrop(topCrop);
                }}
                className="px-4 py-2.5 rounded-xl bg-[#EAF3FF] text-[#1769E0] text-xs font-semibold hover:bg-[#1769E0] hover:text-white transition-colors cursor-pointer"
              >
                {isAr ? 'تفسير الدرجة' : 'Explain Score'}
              </button>
            </div>
          </div>

          {/* All 5 Supported Crops Ranked List */}
          <div className="grid gap-4">
            {activeDecision.evaluations.map((ev) => {
              const profile = SUPPORTED_CROPS[ev.cropId];
              return (
                <article
                  key={ev.cropId}
                  className={`bg-white rounded-2xl border p-5 transition-colors ${
                    ev.excluded ? 'border-red-200 bg-red-50/20' : 'border-[#DCE7F5]'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#DCE7F5]">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-[#EAF3FF] text-[#0B2A5B] tabular-nums">
                          #{ev.rank}
                        </span>
                        <h3 className="text-lg font-bold text-[#0B2A5B]">
                          {isAr ? ev.cropNameAr : ev.cropName}
                        </h3>
                        <span className="text-xs text-[#66758A]">
                          {ev.family} · {isAr ? profile.roleLabelAr : profile.roleLabel}
                        </span>
                        {ev.excluded && (
                          <span className="px-2 py-0.5 rounded-md bg-[#E45C67]/15 text-[#E45C67] text-[11px] font-semibold">
                            {isAr ? 'مستبعد بقيد صلب' : 'Hard Constraint Exclusion'}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#66758A]">
                        {isAr ? 'الاحتياج المائي:' : 'Seasonal water:'}{' '}
                        <span className="font-mono tabular-nums">
                          {profile.seasonalWaterMm[0]}–{profile.seasonalWaterMm[1]} mm
                        </span>{' '}
                        · {isAr ? 'مدة النمو:' : 'Growth cycle:'}{' '}
                        <span className="font-mono tabular-nums">
                          {profile.growthDurationDays[0]}–{profile.growthDurationDays[1]} d
                        </span>
                      </p>

                      {ev.nasaMatchDetails && (
                        <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-[#0B2A5B]">
                          <span className="bg-[#EAF3FF] px-2 py-0.5 rounded-md font-semibold text-[#1769E0]">
                            {isAr ? 'توافق ناسا المناخي: ' : 'NASA Match: '}
                            <span className="font-mono tabular-nums">{ev.nasaMatchDetails.suitableDaysCount}/{ev.nasaMatchDetails.totalDaysCount} {isAr ? 'أيام ملائمة' : 'days'} ({ev.nasaMatchDetails.suitabilityPct}%)</span>
                          </span>
                          {ev.nasaMatchDetails.avgSolarRadiation !== undefined && (
                            <span className="bg-[#F7FAFE] border border-[#DCE7F5] px-2 py-0.5 rounded-md font-mono text-[#66758A]">
                              ☀️ {ev.nasaMatchDetails.avgSolarRadiation} MJ/m²
                            </span>
                          )}
                          {ev.nasaMatchDetails.totalPrecipitation !== undefined && (
                            <span className="bg-[#F7FAFE] border border-[#DCE7F5] px-2 py-0.5 rounded-md font-mono text-[#66758A]">
                              🌧️ {ev.nasaMatchDetails.totalPrecipitation} mm
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-[11px] text-[#66758A]">
                          {isAr ? 'مؤشر الملاءمة المحسوب' : 'Calculated Suitability Index'}
                        </p>
                        <p
                          className={`text-2xl font-bold tabular-nums ${
                            ev.excluded
                              ? 'text-[#E45C67]'
                              : ev.suitabilityIndex >= 75
                              ? 'text-[#19A974]'
                              : ev.suitabilityIndex >= 55
                              ? 'text-[#1769E0]'
                              : 'text-[#F2A93B]'
                          }`}
                        >
                          {ev.suitabilityIndex}
                          <span className="text-xs font-normal text-[#66758A]">/100</span>
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          lastTriggerRef.current = e.currentTarget;
                          setExplainedCrop(ev);
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#DCE7F5] text-xs font-semibold text-[#0B2A5B] hover:border-[#1769E0] hover:text-[#1769E0] cursor-pointer"
                      >
                        <HelpCircle className="w-3.5 h-3.5" />
                        <span>{isAr ? 'تفسير الحساب' : 'Explain Score'}</span>
                      </button>
                    </div>
                  </div>

                  {/* 5 Factor Contribution Bars */}
                  <div className="grid sm:grid-cols-5 gap-3 py-4">
                    {ev.factors.map((f) => (
                      <div key={f.factor} className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-[#12233F]">
                            {isAr ? f.labelAr : f.label}
                          </span>
                          <span className="font-mono tabular-nums text-[#66758A]">
                            {f.score} ({Math.round(f.weight * 100)}%)
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-[#EAF3FF] overflow-hidden">
                          <div
                            className={`h-full rounded-full ${factorBarColor(f.status)}`}
                            style={{ width: `${f.score}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Positives, Risks & Missing Data */}
                  <div className="grid md:grid-cols-3 gap-4 pt-3 border-t border-[#DCE7F5] text-xs">
                    <div>
                      <p className="font-semibold text-[#19A974] mb-1 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{isAr ? 'نقاط القوة' : 'Positive Drivers'}</span>
                      </p>
                      {ev.positiveFactors.length > 0 ? (
                        <ul className="space-y-1 text-[#12233F]">
                          {(isAr ? ev.positiveFactorsAr : ev.positiveFactors).slice(0, 2).map((p, idx) => (
                            <li key={idx}>· {p}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-[#66758A]">{isAr ? 'لا توجد نقاط قوة بارزة حالياً' : 'No strong factor drivers under current constraints.'}</p>
                      )}
                    </div>

                    <div>
                      <p className="font-semibold text-[#E45C67] mb-1 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>{isAr ? 'المخاطر والقيود' : 'Risks & Constraints'}</span>
                      </p>
                      {ev.mainRisks.length > 0 ? (
                        <ul className="space-y-1 text-[#12233F]">
                          {(isAr ? ev.mainRisksAr : ev.mainRisks).slice(0, 2).map((r, idx) => (
                            <li key={idx}>· {r}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-[#66758A]">{isAr ? 'لا توجد مخاطر حرجة مرصودة' : 'No major hard-constraint risks flagged.'}</p>
                      )}
                    </div>

                    <div>
                      <p className="font-semibold text-[#66758A] mb-1 flex items-center gap-1">
                        <Info className="w-3.5 h-3.5" />
                        <span>{isAr ? 'بيانات ناقصة' : 'Missing Verification'}</span>
                      </p>
                      {ev.missingData.length > 0 ? (
                        <ul className="space-y-1 text-[#66758A]">
                          {(isAr ? ev.missingDataAr : ev.missingData).slice(0, 2).map((m, idx) => (
                            <li key={idx}>· {m}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-[#19A974]">{isAr ? 'لا توجد مدخلات أساسية مفقودة' : 'All primary inputs verified.'}</p>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: 4-SEASON CROP ROTATION PLANNER */}
      {decisionSubTab === 'rotation' && rotationPlan && (
        <div className="space-y-5">
          <div className="p-4 rounded-xl bg-[#EAF3FF]/60 border border-[#DCE7F5] flex items-start gap-3 text-xs text-[#0B2A5B]">
            <CalendarClock className="w-4 h-4 text-[#1769E0] shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-0.5">
                {isAr ? 'خطة الدورة الزراعية المستدامة' : 'Dynamic 4-Season Crop Rotation Timeline'}
              </p>
              <p className="text-[#12233F]">
                {isAr ? rotationPlan.advisoryNoticeAr : rotationPlan.advisoryNotice}
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {rotationPlan.steps.map((step, index) => (
              <article
                key={step.slot}
                className={`bg-white rounded-2xl border p-5 flex flex-col justify-between space-y-4 ${
                  step.slot === 'next' ? 'border-[#1769E0] ring-1 ring-[#1769E0]/20' : 'border-[#DCE7F5]'
                }`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#1769E0]">
                      0{index + 1} · {isAr ? step.slotLabelAr : step.slotLabel}
                    </span>
                    <span className="capitalize text-[#66758A] font-medium">{step.seasonName}</span>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-[#0B2A5B]">
                      {isAr ? step.chosenCropNameAr : step.chosenCropName}
                    </h3>
                    <p className="text-[11px] text-[#66758A] mt-0.5">
                      {step.cropFamily} ·{' '}
                      <span className="inline-flex items-center gap-1">
                        <Droplets className="w-3 h-3 text-[#1769E0]" />
                        {step.waterDemand}
                      </span>
                    </p>
                  </div>

                  <p className="text-xs text-[#12233F] leading-relaxed">
                    {isAr ? step.reasonAr : step.reason}
                  </p>

                  <div className="p-2.5 rounded-lg bg-[#F7FAFE] border border-[#DCE7F5] text-[11px] space-y-1">
                    <p className="font-semibold text-[#0B2A5B]">
                      {isAr ? step.environmentalFitAr : step.environmentalFit}
                    </p>
                    <p className="text-[#66758A]">
                      {isAr ? step.rotationBenefitAr : step.rotationBenefit}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#DCE7F5] text-[11px] space-y-1.5">
                  <p className="text-[#66758A]">
                    <strong className="text-[#12233F]">{isAr ? 'ملاحظة المخاطر:' : 'Risk note:'}</strong>{' '}
                    {isAr ? step.riskNoteAr : step.riskNote}
                  </p>
                  {step.alternatives.length > 0 && (
                    <p className="text-[#1769E0]">
                      {isAr ? 'البدائل:' : 'Alternatives:'}{' '}
                      {step.alternatives
                        .map((id) => (isAr ? SUPPORTED_CROPS[id].nameAr : SUPPORTED_CROPS[id].name))
                        .join(', ')}
                    </p>
                  )}
                  <p className="text-[#66758A]">
                    {isAr ? 'الثقة:' : 'Confidence:'} <span className="font-semibold">{step.confidence}</span>
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {/* EXPLAIN SCORE MODAL / DRAWER */}
      {explainedCrop && (
        <div
          className="fixed inset-0 z-50 bg-[#0B2A5B]/30 flex justify-end fs-fade-in"
          role="dialog"
          aria-modal="true"
          aria-label="Explain Score Details"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setExplainedCrop(null);
              lastTriggerRef.current?.focus();
            }
          }}
        >
          <div className="bg-white w-full max-w-xl h-full overflow-y-auto p-6 space-y-5 shadow-2xl border-s border-[#DCE7F5] fs-drawer-end">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#DCE7F5]">
              <div>
                <p className="text-xs font-semibold text-[#1769E0] flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{activeDecision.provenance}</span> ·{' '}
                  <span className="font-mono">{activeDecision.ruleVersion}</span>
                </p>
                <h2 className="text-xl font-bold text-[#0B2A5B] mt-1">
                  {isAr ? explainedCrop.cropNameAr : explainedCrop.cropName} — {explainedCrop.suitabilityIndex}/100
                </h2>
                <p className="text-xs text-[#66758A] mt-0.5">
                  {explainedCrop.scientificName} · Confidence {explainedCrop.confidenceScore}% ({explainedCrop.confidence})
                </p>
              </div>
              <button
                ref={closeDrawerRef}
                type="button"
                onClick={() => {
                  setExplainedCrop(null);
                  lastTriggerRef.current?.focus();
                }}
                aria-label="Close explanation"
                className="p-2 rounded-lg text-[#66758A] hover:bg-[#EAF3FF] hover:text-[#1769E0] cursor-pointer focus-visible:outline-2 focus-visible:outline-[#1769E0]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Weighted Factor Breakdown */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-[#0B2A5B]">
                {isAr ? 'تفصيل حساب العوامل الموزونة' : 'Weighted Factor Contribution Breakdown'}
              </h3>
              {explainedCrop.factors.map((f) => (
                <div key={f.factor} className="p-3.5 rounded-xl border border-[#DCE7F5] bg-[#F7FAFE] space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-[#0B2A5B]">{isAr ? f.labelAr : f.label}</span>
                    <span className="font-mono tabular-nums text-[#1769E0]">
                      Score {f.score}/100 × {Math.round(f.weight * 100)}% = +{f.weightedContribution} pts
                    </span>
                  </div>
                  <p className="text-xs text-[#12233F] leading-relaxed">
                    {isAr ? f.explanationAr : f.explanation}
                  </p>
                </div>
              ))}
            </div>

            {/* Hard Constraints */}
            {explainedCrop.hardConstraints.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-[#E45C67]">
                  {isAr ? 'القيود الصارمة والتنبيهات' : 'Triggered Hard Constraints & Cautions'}
                </h3>
                {explainedCrop.hardConstraints.map((hc, i) => (
                  <div key={i} className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-[#12233F]">
                    <span className="font-bold uppercase text-[#E45C67]">{hc.severity}: </span>
                    {isAr ? hc.messageAr : hc.message}
                  </div>
                ))}
              </div>
            )}

            {/* Agronomic Knowledge Base Sources & Uncertainty */}
            <div className="p-4 rounded-xl bg-white border border-[#DCE7F5] text-xs space-y-2 text-[#66758A]">
              <p className="font-semibold text-[#0B2A5B]">
                {isAr ? 'المراجع الزراعية وحدود اليقين' : 'Agronomic Profile Sources & Uncertainty'}
              </p>
              <p>{SUPPORTED_CROPS[explainedCrop.cropId].uncertaintyNotes}</p>
              <p className="font-mono text-[11px]">
                Sources: {SUPPORTED_CROPS[explainedCrop.cropId].sources.join(' · ')}
              </p>
              {activeEnv && (
                <p className="font-mono text-[11px]">
                  NASA POWER window: {activeEnv.dataDateRange.start} to {activeEnv.dataDateRange.end}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
