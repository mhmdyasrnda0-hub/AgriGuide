import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileText,
  MapPin,
  Printer,
  Save,
  ShieldAlert,
} from 'lucide-react';
import { useFieldShift } from '../context/FieldShiftContext';
import { generateRotationPlan } from '../lib/decisionEngine';
import { t } from '../i18n/translations';
import { FarmReport } from '../types/fieldshift';
import { BrandLogo } from './BrandLogo';

export function ReportsView() {
  const {
    language,
    activeFarm,
    envByFarm,
    scansByFarm,
    activeDecision,
    reportsByFarm,
    saveReport,
    setActiveSection,
  } = useFieldShift();

  const [mode, setMode] = useState<'farmer' | 'technical'>('farmer');
  const [savedNotice, setSavedNotice] = useState(false);
  const isAr = language === 'ar';

  const activeEnv = activeFarm ? envByFarm[activeFarm.id] ?? null : null;
  const latestScan = activeFarm ? scansByFarm[activeFarm.id]?.[0] ?? null : null;
  const savedReports = activeFarm ? reportsByFarm[activeFarm.id] || [] : [];

  const liveReport: FarmReport | null = useMemo(() => {
    if (!activeFarm || !activeDecision) return null;
    const top = activeDecision.evaluations[0];
    const rotation = generateRotationPlan(activeFarm, activeEnv, latestScan);

    const sources: FarmReport['sourcesAndTimestamps'] = [
      {
        source: `User Farm Profile (${activeFarm.locationAccuracyMode})`,
        timestamp: activeFarm.updatedAt,
        resolutionOrScope: activeFarm.areaHectares
          ? `${activeFarm.areaHectares.toFixed(2)} ha (${activeFarm.centerLat.toFixed(4)}, ${activeFarm.centerLng.toFixed(4)})`
          : `${activeFarm.centerLat.toFixed(4)}, ${activeFarm.centerLng.toFixed(4)}`,
      },
      {
        source: `Field Shift Decision Engine (${activeDecision.ruleVersion})`,
        timestamp: activeDecision.computedAt,
        resolutionOrScope: 'Multi-criteria deterministic suitability rules across 5 core crops',
      },
    ];

    if (activeEnv) {
      sources.push({
        source: 'NASA POWER Meteorological & Solar API',
        timestamp: `${activeEnv.dataDateRange.start} to ${activeEnv.dataDateRange.end} (fetched ${activeEnv.fetchedAt})`,
        resolutionOrScope: '0.5° × 0.625° / 1.0° satellite & reanalysis grid',
      });
    }
    if (latestScan) {
      sources.push({
        source: `AI Field Scan (${latestScan.modelVersion})`,
        timestamp: latestScan.analyzedAt,
        resolutionOrScope: `${latestScan.scanType} (${latestScan.qualityStatus})`,
      });
    }

    const sections: FarmReport['sections'] =
      mode === 'farmer'
        ? [
            {
              heading: isAr ? '1. ملخص قرار الموسم القادم' : '1. Next-Season Crop Recommendation',
              body: isAr
                ? `المحصول الأعلى ملاءمة هو ${top.cropNameAr} بمؤشر ${top.suitabilityIndex}/100 (مستوى الثقة ${top.confidenceScore}%). ${(top.positiveFactorsAr[0] || '')}`
                : `Top calculated suitability is ${top.cropName} (${top.suitabilityIndex}/100 calculated suitability index, ${top.confidenceScore}% confidence). ${top.positiveFactors[0] || ''}`,
              provenance: 'calculated suitability index',
            },
            {
              heading: isAr ? '2. الظروف البيئية والتربة المتصلة' : '2. Connected Field & Earth Conditions',
              body: activeEnv
                ? `NASA POWER 14-day mean temperature: ${activeEnv.summary.avgTempC ?? 'n/a'}°C, peak ${activeEnv.summary.maxTempC ?? 'n/a'}°C, 14-day cumulative rainfall: ${activeEnv.summary.totalPrecip14dMm ?? 'n/a'} mm.`
                : 'No NASA POWER satellite snapshot connected yet for this farm.',
              provenance: activeEnv ? 'satellite-derived estimate' : 'user-provided data',
            },
            {
              heading: isAr ? '3. خطة الدورة الزراعية المقترحة' : '3. Multi-Season Rotation Path',
              body: rotation.steps
                .map((s) => `${s.slotLabel} (${s.seasonName}): ${s.chosenCropName}`)
                .join(' → '),
              provenance: 'calculated suitability index',
            },
          ]
        : [
            {
              heading: '1. Weighted Suitability Matrix (All 5 Supported Crops)',
              body: activeDecision.evaluations
                .map(
                  (e) =>
                    `#${e.rank} ${e.cropName}: ${e.suitabilityIndex}/100${e.excluded ? ' [EXCLUDED]' : ''} | Factors: ${e.factors
                      .map((f) => `${f.factor}=${f.score}`)
                      .join(', ')}`
                )
                .join('\n'),
              provenance: 'calculated suitability index',
            },
            {
              heading: '2. Geospatial & Satellite Telemetry Summary',
              body: activeEnv
                ? `Coordinates: (${activeFarm.centerLat.toFixed(5)}, ${activeFarm.centerLng.toFixed(5)}), Elevation: ${activeEnv.elevationMeters ?? 'n/a'} m (${activeEnv.elevationSource}). NASA Window: ${activeEnv.dataDateRange.start}..${activeEnv.dataDateRange.end}. SoilWetnessTop: ${activeEnv.summary.soilWetnessIndex ?? 'n/a'}.`
                : 'NASA POWER telemetry not fetched yet.',
              provenance: 'satellite-derived estimate',
            },
            {
              heading: '3. Visual & Laboratory Evidence',
              body: latestScan
                ? `Scan [${latestScan.scanType}]: ${latestScan.preliminaryAssessment}. Confidence ${latestScan.confidenceScore}%. Evidence: ${latestScan.visualEvidence.join('; ')}`
                : 'No uploaded crop image or OCR soil lab scan recorded.',
              provenance: latestScan ? 'AI-assisted visual assessment' : 'user-provided data',
            },
          ];

    return {
      id: `rep_${Date.now()}`,
      farmId: activeFarm.id,
      mode,
      generatedAt: new Date().toISOString(),
      farmName: activeFarm.name,
      locationLabel:
        activeFarm.locationLabel || `${activeFarm.centerLat.toFixed(4)}, ${activeFarm.centerLng.toFixed(4)}`,
      topCropName: isAr ? top.cropNameAr : top.cropName,
      topSuitabilityIndex: top.suitabilityIndex,
      confidence: `${activeDecision.overallConfidenceScore}% (${activeDecision.overallConfidence})`,
      summaryText:
        mode === 'farmer'
          ? 'Concise field guidance grounded in user inputs and satellite observations.'
          : 'Technical audit log documenting rule weights, environmental observations, and limitations.',
      sections,
      sourcesAndTimestamps: sources,
      limitations: [
        ...activeDecision.limitations,
        ...(activeEnv ? activeEnv.limitations : []),
      ],
    };
  }, [activeFarm, activeDecision, activeEnv, latestScan, mode, isAr]);

  if (!activeFarm || !liveReport) {
    return (
      <div className="bg-white rounded-2xl border border-[#DCE7F5] p-8 sm:p-12 text-center max-w-2xl mx-auto">
        <FileText className="w-10 h-10 text-[#1769E0] mx-auto mb-3" />
        <h1 className="text-xl font-bold text-[#0B2A5B] mb-2">
          {isAr ? 'التقارير الموثقة للمزرعة' : 'Auditable Farm Reports'}
        </h1>
        <p className="text-sm text-[#66758A] mb-6">
          {isAr
            ? 'سجّل مزرعتك أولاً لإنشاء تقارير للمزارع أو تقارير فنية موثقة بالمصادر.'
            : 'Capture your farm first to generate printable Farmer Summary and Technical Evidence reports with full source timestamps.'}
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

  const handleSaveSnapshot = async () => {
    await saveReport(liveReport);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  };

  const handleDownloadMarkdown = () => {
    const md = [
      `# Field Shift Report (${liveReport.mode.toUpperCase()}) — ${liveReport.farmName}`,
      `Generated: ${liveReport.generatedAt}`,
      `Location: ${liveReport.locationLabel}`,
      `Top Crop: ${liveReport.topCropName} (${liveReport.topSuitabilityIndex}/100) | Confidence: ${liveReport.confidence}`,
      '',
      ...liveReport.sections.flatMap((s) => [`## ${s.heading}`, `_Provenance: ${s.provenance}_`, s.body, '']),
      '## Sources & Timestamps',
      ...liveReport.sourcesAndTimestamps.map((st) => `- **${st.source}** (${st.timestamp}) — ${st.resolutionOrScope}`),
      '',
      '## Disclaimers & Limitations',
      ...liveReport.limitations.map((l) => `- ${l}`),
    ].join('\n');

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `field-shift-${liveReport.mode}-${activeFarm.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-bold text-[#0B2A5B] tracking-tight">
            {isAr ? 'التقارير الزراعية الموثقة' : 'Reports & Export'}
          </h1>
          <p className="text-sm text-[#66758A] mt-1">
            {activeFarm.name} · {isAr ? 'صيغة المزارع أو الصيغة الفنية الموثقة' : 'Farmer-friendly and Technical Evidence views'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-[#DCE7F5] bg-white p-1">
            <button
              type="button"
              onClick={() => setMode('farmer')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                mode === 'farmer' ? 'bg-[#1769E0] text-white' : 'text-[#66758A]'
              }`}
            >
              {isAr ? 'تقرير المزارع' : 'Farmer Mode'}
            </button>
            <button
              type="button"
              onClick={() => setMode('technical')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                mode === 'technical' ? 'bg-[#1769E0] text-white' : 'text-[#66758A]'
              }`}
            >
              {isAr ? 'التقرير الفني' : 'Technical Mode'}
            </button>
          </div>

          <button
            type="button"
            onClick={handleSaveSnapshot}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#DCE7F5] bg-white text-xs font-semibold text-[#0B2A5B] hover:border-[#1769E0] cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isAr ? 'حفظ نسخة' : 'Save Snapshot'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadMarkdown}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#DCE7F5] bg-white text-xs font-semibold text-[#0B2A5B] hover:border-[#1769E0] cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isAr ? 'تصدير Markdown' : 'Export .md'}</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1769E0] text-white text-xs font-semibold hover:bg-[#0B2A5B] cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{isAr ? 'طباعة / PDF' : 'Print / PDF'}</span>
          </button>
        </div>
      </div>

      {savedNotice && (
        <div className="p-3 rounded-xl bg-[#19A974]/10 border border-[#19A974]/30 text-xs text-[#19A974] font-semibold flex items-center gap-2 no-print">
          <CheckCircle2 className="w-4 h-4" />
          <span>{isAr ? 'تم حفظ نسخة التقرير بنجاح.' : 'Report snapshot saved to farm archive.'}</span>
        </div>
      )}

      {/* Printable Report Sheet */}
      <article className="bg-white rounded-2xl border border-[#DCE7F5] p-6 sm:p-8 space-y-6">
        <header className="pb-5 border-b border-[#DCE7F5] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <BrandLogo variant="horizontal" size="xs" className="mb-2" />
            <p className="text-xs font-semibold text-[#1769E0] uppercase tracking-wider">
              {liveReport.mode === 'farmer' ? 'Farmer Decision Summary' : 'Technical Agronomy Audit'}
            </p>
            <h2 className="text-2xl font-bold text-[#0B2A5B] mt-1">{liveReport.farmName}</h2>
            <p className="text-xs text-[#66758A] mt-1">
              {liveReport.locationLabel} · Generated {new Date(liveReport.generatedAt).toLocaleString()}
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-[#EAF3FF] border border-[#DCE7F5] text-end">
            <p className="text-[11px] font-semibold text-[#0B2A5B]">{liveReport.topCropName}</p>
            <p className="text-2xl font-bold text-[#1769E0] tabular-nums">
              {liveReport.topSuitabilityIndex}/100
            </p>
            <p className="text-[11px] text-[#66758A]">Confidence: {liveReport.confidence}</p>
          </div>
        </header>

        <div className="space-y-4">
          {liveReport.sections.map((sec, i) => (
            <section key={i} className="p-4 rounded-xl bg-[#F7FAFE] border border-[#DCE7F5] space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-[#0B2A5B]">{sec.heading}</h3>
                <span className="text-[11px] font-semibold text-[#1769E0]">{sec.provenance}</span>
              </div>
              <p className="text-xs text-[#12233F] leading-relaxed whitespace-pre-line">{sec.body}</p>
            </section>
          ))}
        </div>

        <section className="space-y-2">
          <h3 className="text-sm font-bold text-[#0B2A5B]">
            {isAr ? 'سجل المصادر والطوابع الزمنية' : 'Sources, Timestamps & Spatial Resolution'}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start border-collapse">
              <thead>
                <tr className="border-b border-[#DCE7F5] text-[#66758A]">
                  <th className="py-2 pe-4 font-semibold text-start">Source</th>
                  <th className="py-2 pe-4 font-semibold text-start">Timestamp / Range</th>
                  <th className="py-2 font-semibold text-start">Resolution / Scope</th>
                </tr>
              </thead>
              <tbody>
                {liveReport.sourcesAndTimestamps.map((st, idx) => (
                  <tr key={idx} className="border-b border-[#DCE7F5]/60">
                    <td className="py-2 pe-4 font-semibold text-[#12233F]">{st.source}</td>
                    <td className="py-2 pe-4 font-mono text-[11px] text-[#66758A]">{st.timestamp}</td>
                    <td className="py-2 text-[#66758A]">{st.resolutionOrScope}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="p-4 rounded-xl bg-[#EAF3FF]/60 border border-[#DCE7F5] text-[11px] text-[#0B2A5B] space-y-1">
          <p className="font-semibold flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-[#1769E0]" />
            <span>{isAr ? 'القيود وإخلاء المسؤولية' : 'Limitations & Non-Endorsement Disclosures'}</span>
          </p>
          {liveReport.limitations.map((lim, i) => (
            <p key={i}>· {lim}</p>
          ))}
        </footer>
      </article>

      {savedReports.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#DCE7F5] p-5 no-print">
          <h3 className="text-sm font-bold text-[#0B2A5B] mb-2">
            {isAr ? 'النسخ المحفوظة سابقاً' : 'Saved Report Snapshots'} ({savedReports.length})
          </h3>
          <ul className="space-y-1.5 text-xs text-[#66758A]">
            {savedReports.map((sr) => (
              <li key={sr.id} className="flex items-center justify-between py-1 border-b border-[#DCE7F5]/50">
                <span>
                  <strong className="text-[#12233F]">{sr.mode.toUpperCase()}</strong> · {sr.topCropName} ({sr.topSuitabilityIndex}/100)
                </span>
                <span className="font-mono text-[11px]">{new Date(sr.generatedAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
