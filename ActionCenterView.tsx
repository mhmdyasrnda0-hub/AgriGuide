import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  FileText,
  Globe2,
  Loader2,
  MapPin,
  RotateCcw,
  Send,
  ShieldAlert,
  Sliders,
  Sparkles,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useFieldShift } from '../context/FieldShiftContext';
import { generateFarmAlerts, runWhatIfSimulation } from '../lib/decisionEngine';
import { t } from '../i18n/translations';
import { requestFieldCopilot } from '../services/aiService';
import { CopilotMarkdown } from './shared/CopilotMarkdown';
import { ChatMessage, ScenarioInput } from '../types/fieldshift';

export function ActionCenterView() {
  const {
    language,
    activeFarm,
    envByFarm,
    scansByFarm,
    activeDecision,
    scenario,
    setScenario,
    chatMessagesByFarm,
    appendChatMessage,
    clearChatHistory,
    setActiveSection,
  } = useFieldShift();

  const isAr = language === 'ar';
  const activeEnv = activeFarm ? envByFarm[activeFarm.id] ?? null : null;
  const latestScan = activeFarm ? scansByFarm[activeFarm.id]?.[0] ?? null : null;
  const chatHistory = activeFarm ? chatMessagesByFarm[activeFarm.id] || [] : [];

  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [lastFailedMsg, setLastFailedMsg] = useState<string | null>(null);
  const [groundingMode, setGroundingMode] = useState<'none' | 'search' | 'maps'>('none');
  const [useDeepThinking, setUseDeepThinking] = useState(false);
  const [expandedTech, setExpandedTech] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const alerts = useMemo(() => {
    if (!activeFarm || !activeDecision) return [];
    return generateFarmAlerts(activeFarm, activeEnv, latestScan, activeDecision);
  }, [activeFarm, activeEnv, latestScan, activeDecision]);

  const simulation = useMemo(() => {
    if (!activeFarm) return null;
    return runWhatIfSimulation(activeFarm, activeEnv, latestScan, scenario);
  }, [activeFarm, activeEnv, latestScan, scenario]);

  if (!activeFarm || !activeDecision || !simulation) {
    return (
      <div className="bg-white rounded-2xl border border-[#DCE7F5] p-8 sm:p-12 text-center max-w-2xl mx-auto">
        <Activity className="w-10 h-10 text-[#1769E0] mx-auto mb-3" />
        <h1 className="text-xl font-bold text-[#0B2A5B] mb-2">
          {isAr ? 'مركز الإجراءات ومحاكي السيناريوهات' : 'Action Center & What-If Simulator'}
        </h1>
        <p className="text-sm text-[#66758A] mb-6">
          {isAr
            ? 'سجّل مزرعتك أولاً لعرض التنبيهات ذات الأولوية، اختبار سيناريوهات المناخ والمياه، والتحدث مع المساعد الزراعي.'
            : 'Capture a farm parcel first to unlock prioritized risk alerts, climate/water What-If simulation, and your context-aware Field Copilot.'}
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

  const cancelChat = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setChatLoading(false);
    setChatError(isAr ? 'تم إلغاء الطلب.' : 'Request cancelled.');
  };

  const handleSendChat = async (promptOverride?: string, isRetry = false) => {
    const text = (promptOverride ?? chatInput).trim();
    if (!text || chatLoading) return;
    setChatError(null);
    setLastFailedMsg(null);

    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}_u`,
      role: 'user',
      text,
      timestamp: new Date().toISOString(),
    };
    const nextHistory = isRetry ? chatHistory : [...chatHistory, userMsg];
    if (!isRetry) {
      appendChatMessage(activeFarm.id, userMsg);
      if (!promptOverride) setChatInput('');
    }
    setChatLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;
    const timeoutId = window.setTimeout(() => controller.abort(), 45000);

    try {
      const nextMessages = nextHistory.map((m) => ({ role: m.role, text: m.text }));
      const { message: botMsg } = await requestFieldCopilot({
        messages: nextMessages,
        farm: activeFarm,
        env: activeEnv,
        latestScan,
        decision: activeDecision,
        scenario,
        pageContext: 'action',
        groundingMode,
        useDeepThinking,
        language,
        signal: controller.signal,
      });
      appendChatMessage(activeFarm.id, botMsg);
    } catch (err) {
      setLastFailedMsg(text);
      if ((err as Error)?.name === 'AbortError') {
        setChatError(isAr ? 'تم إلغاء الطلب أو انتهت المهلة.' : 'Request cancelled or timed out.');
      } else {
        setChatError(err instanceof Error ? err.message : 'Unable to reach Field Copilot.');
      }
    } finally {
      window.clearTimeout(timeoutId);
      abortRef.current = null;
      setChatLoading(false);
    }
  };

  const quickPrompts = isAr
    ? [
        'لماذا تصدّر المحصول الأول الترتيب، وما هي أهم مخاطره؟',
        'كيف أتصرف عملياً إذا انخفضت المياه المتاحة بنسبة 30%؟',
        'ما البيانات الناقصة التي يجب أن أجمعها لرفع ثقة القرار؟',
      ]
    : [
        `Why did ${topCrop.cropName} rank #1, and what are its main risks?`,
        'If irrigation water drops by 30%, which crop shift makes sense?',
        'What missing farm data should I collect next to raise confidence?',
      ];

  const resetScenario = () =>
    setScenario({
      tempDeltaC: 0,
      waterAvailabilityPct: 100,
      rainfallDeltaPct: 0,
      soilMoistureScenario: 'baseline',
    });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0B2A5B] tracking-tight">
            {isAr ? 'مركز الإجراءات ومحاكي المناخ' : 'Action Center'}
          </h1>
          <p className="text-sm text-[#66758A] mt-1">
            {activeFarm.name} · {isAr ? 'الهدف:' : 'Goal:'} {activeFarm.goal.replace('_', ' ')} ·{' '}
            {isAr ? 'الثقة الكلية:' : 'Confidence:'} {activeDecision.overallConfidenceScore}%
          </p>
        </div>
        <button
          type="button"
          onClick={() => setActiveSection('reports')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0B2A5B] text-white text-xs font-semibold hover:bg-[#1769E0] cursor-pointer self-start sm:self-auto"
        >
          <FileText className="w-3.5 h-3.5" />
          <span>{isAr ? 'توليد تقرير المزرعة' : 'Open Farm Reports'}</span>
          <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
        </button>
      </div>

      {/* Farm Overview KPIs */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-[#DCE7F5] p-4">
          <p className="text-[11px] font-semibold text-[#66758A]">
            {isAr ? 'أعلى محصول ملائم' : 'Top Ranked Crop'}
          </p>
          <p className="text-xl font-bold text-[#0B2A5B] mt-1">
            {isAr ? topCrop.cropNameAr : topCrop.cropName}
          </p>
          <p className="text-xs text-[#1769E0] font-semibold mt-0.5 tabular-nums">
            {topCrop.suitabilityIndex}/100 · {activeDecision.provenance}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-[#DCE7F5] p-4">
          <p className="text-[11px] font-semibold text-[#66758A]">
            {isAr ? 'مناخ NASA POWER (14 يوماً)' : 'NASA POWER 14d Climate'}
          </p>
          {activeEnv ? (
            <>
              <p className="text-xl font-bold text-[#0B2A5B] mt-1 tabular-nums">
                {activeEnv.summary.avgTempC ?? '—'}°C · {activeEnv.summary.totalPrecip14dMm ?? '—'} mm
              </p>
              <p className="text-xs text-[#66758A] mt-0.5 font-mono">
                {activeEnv.dataDateRange.end} · satellite-derived
              </p>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setActiveSection('earth')}
              className="mt-2 text-xs font-semibold text-[#1769E0] hover:underline cursor-pointer"
            >
              {isAr ? 'اتصل بخدمة ناسا الآن →' : 'Connect NASA POWER data →'}
            </button>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-[#DCE7F5] p-4">
          <p className="text-[11px] font-semibold text-[#66758A]">
            {isAr ? 'آخر فحص بصري للحقل' : 'Latest AI Field Scan'}
          </p>
          {latestScan ? (
            <>
              <p className="text-sm font-bold text-[#0B2A5B] mt-1 line-clamp-1">
                {latestScan.preliminaryAssessment}
              </p>
              <p className="text-xs text-[#66758A] mt-1 tabular-nums">
                {latestScan.confidenceScore}% · {latestScan.provenance}
              </p>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setActiveSection('scan')}
              className="mt-2 text-xs font-semibold text-[#1769E0] hover:underline cursor-pointer"
            >
              {isAr ? 'ارفع صورة حقل أو تحليل تربة →' : 'Scan field photo or soil report →'}
            </button>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-[#DCE7F5] p-4">
          <p className="text-[11px] font-semibold text-[#66758A]">
            {isAr ? 'أكثر محصول صموداً بالمحاكاة' : 'Scenario-Resilient Leader'}
          </p>
          <p className="text-xl font-bold text-[#19A974] mt-1">
            {isAr ? simulation.mostResilientCropNameAr : simulation.mostResilientCropName}
          </p>
          <p className="text-xs text-[#66758A] mt-0.5">
            {isAr ? 'مخرجات محاكاة السيناريو' : 'scenario simulation output'}
          </p>
        </div>
      </div>

      {/* Prioritized Alerts */}
      <section className="bg-white rounded-2xl border border-[#DCE7F5] p-5 space-y-3">
        <h2 className="text-base font-bold text-[#0B2A5B]">
          {isAr ? 'التنبيهات والإجراءات المقترحة حسب الأولوية' : 'Prioritized Alerts & Next Actions'}
        </h2>
        {alerts.length === 0 ? (
          <div className="flex items-center gap-2 text-xs text-[#19A974]">
            <CheckCircle2 className="w-4 h-4" />
            <span>
              {isAr
                ? 'لا توجد تنبيهات حرجة حالياً بناءً على البيانات المتصلة.'
                : 'No urgent agronomic alerts detected from currently connected inputs.'}
            </span>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {alerts.map((al) => (
              <div
                key={al.id}
                className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                  al.severity === 'urgent'
                    ? 'bg-red-50/70 border-red-200'
                    : al.severity === 'warning'
                    ? 'bg-amber-50/70 border-amber-200'
                    : 'bg-[#F7FAFE] border-[#DCE7F5]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold text-[#0B2A5B] flex items-center gap-1.5">
                    <AlertTriangle
                      className={`w-3.5 h-3.5 shrink-0 ${
                        al.severity === 'urgent'
                          ? 'text-[#E45C67]'
                          : al.severity === 'warning'
                          ? 'text-[#F2A93B]'
                          : 'text-[#1769E0]'
                      }`}
                    />
                    <span>{isAr ? al.titleAr : al.title}</span>
                  </p>
                  <span className="text-[10px] font-semibold uppercase text-[#66758A]">{al.severity}</span>
                </div>
                <p className="text-[#12233F]">{isAr ? al.reasonAr : al.reason}</p>
                <p className="text-[#1769E0] font-medium">
                  {isAr ? 'الإجراء:' : 'Next step:'} {isAr ? al.suggestedActionAr : al.suggestedAction}
                </p>
                <p className="text-[10px] text-[#66758A]">Source: {al.source}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Main Split: What-If Simulator & Context-Aware Field Copilot */}
      <div className="grid lg:grid-cols-12 gap-6 items-start">
        {/* LEFT: Deterministic What-If Climate & Water Simulator */}
        <section className="lg:col-span-6 bg-white rounded-2xl border border-[#DCE7F5] p-5 space-y-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-[#0B2A5B] flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#1769E0]" />
                <span>{isAr ? 'محاكي ماذا لو (المياه والمناخ)' : 'What-If Climate & Water Simulator'}</span>
              </h2>
              <p className="text-xs text-[#66758A] mt-0.5">
                {isAr
                  ? 'يعيد حساب محرك القرار الحتمي فوريًا مقارنة بخط الأساس.'
                  : 'Deterministically recomputes crop suitability & risk shifts against baseline.'}
              </p>
            </div>
            <button
              type="button"
              onClick={resetScenario}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#DCE7F5] text-xs font-medium text-[#66758A] hover:text-[#1769E0] cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>{isAr ? 'إعادة ضبط' : 'Reset'}</span>
            </button>
          </div>

          {/* Controls */}
          <div className="space-y-4 bg-[#F7FAFE] p-4 rounded-xl border border-[#DCE7F5]">
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <label htmlFor="sim-water">{isAr ? 'توفر المياه في السيناريو' : 'Irrigation / Water Availability'}</label>
                <span className="font-mono tabular-nums text-[#1769E0]">{scenario.waterAvailabilityPct}%</span>
              </div>
              <input
                id="sim-water"
                type="range"
                min={40}
                max={120}
                step={5}
                value={scenario.waterAvailabilityPct}
                onChange={(e) =>
                  setScenario({ ...scenario, waterAvailabilityPct: Number(e.target.value) })
                }
                className="w-full accent-[#1769E0]"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <label htmlFor="sim-temp">{isAr ? 'تغير درجة الحرارة' : 'Temperature Shift'}</label>
                <span className="font-mono tabular-nums text-[#1769E0]">
                  {scenario.tempDeltaC >= 0 ? `+${scenario.tempDeltaC}` : scenario.tempDeltaC}°C
                </span>
              </div>
              <input
                id="sim-temp"
                type="range"
                min={-2}
                max={5}
                step={0.5}
                value={scenario.tempDeltaC}
                onChange={(e) => setScenario({ ...scenario, tempDeltaC: Number(e.target.value) })}
                className="w-full accent-[#1769E0]"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <label htmlFor="sim-rain">{isAr ? 'تغير الهطول المطري' : 'Rainfall Anomaly'}</label>
                <span className="font-mono tabular-nums text-[#1769E0]">
                  {scenario.rainfallDeltaPct >= 0 ? `+${scenario.rainfallDeltaPct}` : scenario.rainfallDeltaPct}%
                </span>
              </div>
              <input
                id="sim-rain"
                type="range"
                min={-50}
                max={50}
                step={10}
                value={scenario.rainfallDeltaPct}
                onChange={(e) =>
                  setScenario({ ...scenario, rainfallDeltaPct: Number(e.target.value) })
                }
                className="w-full accent-[#1769E0]"
              />
            </div>

            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-[#12233F]">
                {isAr ? 'حالة رطوبة التربة' : 'Soil Moisture Regime'}
              </span>
              <div className="flex gap-1.5">
                {(['baseline', 'dry', 'wet'] as ScenarioInput['soilMoistureScenario'][]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setScenario({ ...scenario, soilMoistureScenario: mode })}
                    className={`px-2.5 py-1 rounded-lg border text-xs font-medium capitalize cursor-pointer ${
                      scenario.soilMoistureScenario === mode
                        ? 'bg-[#1769E0] text-white border-[#1769E0]'
                        : 'bg-white text-[#66758A] border-[#DCE7F5]'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Before / After Comparison Table */}
          <div className="space-y-2.5">
            {simulation.deltas.map((d) => (
              <div
                key={d.cropId}
                className="p-3 rounded-xl border border-[#DCE7F5] flex items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0">
                  <p className="font-bold text-[#0B2A5B]">
                    #{d.scenarioRank} {isAr ? d.cropNameAr : d.cropName}
                    {d.scenarioExcluded && (
                      <span className="ms-2 text-[#E45C67] font-semibold">
                        ({isAr ? 'مستبعد' : 'excluded'})
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-[#66758A] truncate">
                    {isAr ? d.primaryDriverAr : d.primaryDriver}
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0 font-mono tabular-nums">
                  <span className="text-[#66758A]">{d.baselineScore} →</span>
                  <span className="font-bold text-[#0B2A5B] text-sm">{d.scenarioScore}</span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                      d.scoreDelta > 0
                        ? 'bg-[#19A974]/10 text-[#19A974]'
                        : d.scoreDelta < 0
                        ? 'bg-[#E45C67]/10 text-[#E45C67]'
                        : 'bg-[#EAF3FF] text-[#66758A]'
                    }`}
                  >
                    {d.scoreDelta > 0 ? `+${d.scoreDelta}` : d.scoreDelta}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 rounded-xl bg-[#EAF3FF]/60 border border-[#DCE7F5] text-[11px] text-[#0B2A5B] flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-[#1769E0] shrink-0 mt-0.5" />
            <span>{simulation.disclaimer}</span>
          </div>
        </section>

        {/* RIGHT: Context-Aware Field Copilot */}
        <section className="lg:col-span-6 bg-white rounded-2xl border border-[#DCE7F5] p-5 flex flex-col h-[640px]">
          <div className="flex items-start justify-between gap-2 pb-3 border-b border-[#DCE7F5]">
            <div>
              <h2 className="text-base font-bold text-[#0B2A5B] flex items-center gap-2">
                <Bot className="w-4 h-4 text-[#1769E0]" />
                <span>{isAr ? 'المساعد الحقلي الذكي (Field Copilot)' : 'Context-Aware Field Copilot'}</span>
              </h2>
              <p className="text-xs text-[#66758A] mt-0.5">
                {isAr
                  ? 'يميز بين البيانات المتصلة، الحسابات، والتوصية الاسترشادية.'
                  : 'Grounded in your active farm record, NASA metrics, and decision rules.'}
              </p>
            </div>
            {chatHistory.length > 0 && (
              <button
                type="button"
                onClick={() => clearChatHistory(activeFarm.id)}
                title={isAr ? 'مسح المحادثة' : 'Clear chat'}
                className="p-1.5 rounded-lg text-[#66758A] hover:text-[#E45C67] cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Copilot Mode Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2 py-2.5 border-b border-[#DCE7F5] text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="text-[#66758A] font-medium">{isAr ? 'المصدر:' : 'Grounding:'}</span>
              {(['none', 'search', 'maps'] as const).map((gm) => (
                <button
                  key={gm}
                  type="button"
                  onClick={() => setGroundingMode(gm)}
                  className={`px-2 py-1 rounded-md border font-medium cursor-pointer ${
                    groundingMode === gm
                      ? 'bg-[#EAF3FF] border-[#1769E0] text-[#1769E0]'
                      : 'border-[#DCE7F5] text-[#66758A]'
                  }`}
                >
                  {gm === 'none' ? 'Farm Context' : gm === 'search' ? 'Web Search' : 'Google Maps'}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setUseDeepThinking(!useDeepThinking)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md border font-medium cursor-pointer ${
                useDeepThinking
                  ? 'bg-[#0B2A5B] border-[#0B2A5B] text-white'
                  : 'border-[#DCE7F5] text-[#66758A]'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              <span>{isAr ? 'تفكير معمق' : 'Deep Thinking'}</span>
            </button>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto py-4 space-y-3 pe-1">
            {chatHistory.length === 0 && (
              <div className="space-y-3">
                <p className="text-xs text-[#66758A]">
                  {isAr
                    ? 'اختر سؤالاً سريعاً أو اكتب استفسارك حول محصولك والمياه والتربة:'
                    : 'Choose a context-aware prompt or ask your own question about this field:'}
                </p>
                <div className="space-y-2">
                  {quickPrompts.map((qp, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleSendChat(qp)}
                      className="w-full text-start p-3 rounded-xl border border-[#DCE7F5] bg-[#F7FAFE] text-xs font-medium text-[#0B2A5B] hover:border-[#1769E0] hover:bg-[#EAF3FF]/50 transition-colors cursor-pointer"
                    >
                      {qp}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {chatHistory.map((msg) => (
              <div
                key={msg.id}
                className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-[#1769E0] text-white ms-8'
                    : 'bg-[#F7FAFE] border border-[#DCE7F5] text-[#12233F] me-6'
                }`}
              >
                {msg.role === 'user' ? (
                  <div className="whitespace-pre-wrap">{msg.text}</div>
                ) : (
                  <div className="space-y-1.5">
                    <CopilotMarkdown text={msg.text} />

                    {msg.technicalDetails && (
                      <div className="pt-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedTech((prev) => ({ ...prev, [msg.id]: !prev[msg.id] }))
                          }
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1769E0] hover:underline cursor-pointer"
                        >
                          {expandedTech[msg.id] ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                          <span>
                            {expandedTech[msg.id]
                              ? isAr
                                ? 'إخفاء التفاصيل الفنية'
                                : 'Hide technical details'
                              : isAr
                              ? 'عرض التفاصيل الفنية'
                              : 'Show technical details'}
                          </span>
                        </button>
                        {expandedTech[msg.id] && (
                          <div className="mt-2 p-2.5 rounded-xl bg-white border border-[#DCE7F5] text-[11px] text-[#66758A] whitespace-pre-wrap">
                            {msg.technicalDetails}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="pt-1.5 border-t border-[#DCE7F5]/70 flex items-center justify-end">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(
                              msg.technicalDetails ? `${msg.text}\n\n${msg.technicalDetails}` : msg.text
                            );
                            setCopiedId(msg.id);
                            window.setTimeout(() => setCopiedId((p) => (p === msg.id ? null : p)), 1800);
                          } catch {
                            // Ignore clipboard restriction
                          }
                        }}
                        className="inline-flex items-center gap-1 text-[11px] text-[#66758A] hover:text-[#1769E0] cursor-pointer"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check className="w-3 h-3 text-[#19A974]" />
                            <span className="text-[#19A974]">{isAr ? 'نُسخ' : 'Copied'}</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>{isAr ? 'نسخ' : 'Copy'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
                {msg.groundingUrls && msg.groundingUrls.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-[#DCE7F5] flex flex-wrap gap-2">
                    {msg.groundingUrls.map((g, idx) => (
                      <a
                        key={idx}
                        href={g.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1769E0] hover:underline"
                      >
                        <Globe2 className="w-3 h-3" />
                        <span>{g.title}</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {chatLoading && (
              <div className="p-3.5 rounded-2xl bg-[#F7FAFE] border border-[#DCE7F5] text-xs text-[#66758A] flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1769E0]" />
                  <span>{isAr ? 'جارٍ التحليل المعتمد على بيانات المزرعة...' : 'Analyzing active farm record...'}</span>
                </div>
                <button
                  type="button"
                  onClick={cancelChat}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#E45C67] hover:underline cursor-pointer"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>{isAr ? 'إلغاء' : 'Cancel'}</span>
                </button>
              </div>
            )}

            {chatError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-[#E45C67] space-y-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{chatError}</span>
                </div>
                {lastFailedMsg && (
                  <button
                    type="button"
                    onClick={() => handleSendChat(lastFailedMsg, true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-red-200 text-[11px] font-semibold text-[#E45C67] hover:bg-red-100 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>{isAr ? 'إعادة المحاولة' : 'Retry'}</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Chat Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendChat();
            }}
            className="pt-3 border-t border-[#DCE7F5] flex gap-2"
          >
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={
                isAr
                  ? 'اسأل المساعد الحقلي عن المزرعة أو المحاصيل...'
                  : 'Ask Field Copilot about your field, rotation, or risks...'
              }
              className="flex-1 rounded-xl border border-[#DCE7F5] px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#1769E0]"
            />
            <button
              type="submit"
              disabled={!chatInput.trim() || chatLoading}
              aria-label="Send message"
              className="px-4 py-2.5 rounded-xl bg-[#1769E0] text-white hover:bg-[#0B2A5B] disabled:opacity-40 cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
