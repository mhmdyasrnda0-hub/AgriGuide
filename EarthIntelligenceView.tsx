import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Database,
  Globe2,
  Loader2,
  MapPin,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { useFieldShift } from '../context/FieldShiftContext';
import { t } from '../i18n/translations';
import { DailyClimatePoint, EnvironmentalMetric } from '../types/fieldshift';

function ClimateTrendChart({
  series,
  baselineTemp,
  isAr,
}: {
  series: DailyClimatePoint[];
  baselineTemp: number | null;
  isAr: boolean;
}) {
  if (series.length < 2) return null;

  const temps = series.map((d) => d.t2m ?? 0);
  const precips = series.map((d) => d.precipMm ?? 0);
  const minT = Math.min(...temps, baselineTemp ?? temps[0]) - 2;
  const maxT = Math.max(...temps, baselineTemp ?? temps[0]) + 2;
  const maxP = Math.max(...precips, 10);

  const w = 680;
  const h = 210;
  const padL = 42;
  const padR = 42;
  const padT = 18;
  const padB = 34;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const xAt = (i: number) => padL + (i / (series.length - 1)) * plotW;
  const yTemp = (val: number) => padT + plotH - ((val - minT) / (maxT - minT || 1)) * plotH;
  const yPrecip = (val: number) => (val / maxP) * (plotH * 0.45);

  const tempPath = series
    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yTemp(pt.t2m ?? minT).toFixed(1)}`)
    .join(' ');

  return (
    <div className="bg-white rounded-2xl border border-[#DCE7F5] p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="text-sm font-bold text-[#0B2A5B]">
            {isAr
              ? 'السلسلة الزمنية اليومية (14 يوماً) مقابل المتوسط المناخي'
              : '14-Day NASA POWER Temperature & Precipitation Trend'}
          </h3>
          <p className="text-xs text-[#66758A]">
            {isAr
              ? 'خط أزرق: متوسط الحرارة اليومي (°م) · أعمدة زرقاء فاتحة: الهطول اليومي (ملم)'
              : 'Blue line: daily 2m air temperature (°C) · Bars: daily precipitation (mm)'}
          </p>
        </div>
        <span className="text-[11px] text-[#66758A] font-mono tabular-nums">
          {series[0].date} → {series[series.length - 1].date}
        </span>
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className="w-full min-w-[480px] h-52"
          role="img"
          aria-label="14-day NASA POWER temperature and precipitation chart"
        >
          {/* Baseline horizontal line */}
          {baselineTemp !== null && (
            <>
              <line
                x1={padL}
                x2={w - padR}
                y1={yTemp(baselineTemp)}
                y2={yTemp(baselineTemp)}
                stroke="#66758A"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              <text
                x={w - padR + 4}
                y={yTemp(baselineTemp) + 4}
                fill="#66758A"
                fontSize="10"
              >
                {baselineTemp}°C avg
              </text>
            </>
          )}

          {/* Precipitation bars */}
          {series.map((pt, i) => {
            const p = pt.precipMm ?? 0;
            const barH = yPrecip(p);
            const barW = Math.max(8, plotW / series.length - 6);
            return (
              <rect
                key={`p-${pt.date}`}
                x={xAt(i) - barW / 2}
                y={padT + plotH - barH}
                width={barW}
                height={barH}
                rx={2}
                fill="#1769E0"
                fillOpacity={0.18}
              />
            );
          })}

          {/* Temperature path */}
          <path d={tempPath} fill="none" stroke="#1769E0" strokeWidth="2.5" strokeLinecap="round" />

          {series.map((pt, i) => (
            <circle
              key={`c-${pt.date}`}
              cx={xAt(i)}
              cy={yTemp(pt.t2m ?? minT)}
              r="3"
              fill="#FFFFFF"
              stroke="#1769E0"
              strokeWidth="2"
            />
          ))}

          {/* Y axis temperature labels */}
          <text x={4} y={padT + 8} fill="#66758A" fontSize="10">
            {maxT.toFixed(0)}°C
          </text>
          <text x={4} y={padT + plotH} fill="#66758A" fontSize="10">
            {minT.toFixed(0)}°C
          </text>

          {/* X axis date ticks */}
          {[0, Math.floor(series.length / 2), series.length - 1].map((idx) => (
            <text
              key={`x-${idx}`}
              x={xAt(idx)}
              y={h - 8}
              textAnchor="middle"
              fill="#66758A"
              fontSize="10"
            >
              {series[idx].date.slice(5)}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}

function statusColors(status: EnvironmentalMetric['status']): string {
  if (status === 'suitable') return 'bg-[#19A974]/10 text-[#19A974] border-[#19A974]/30';
  if (status === 'elevated' || status === 'below typical range' || status === 'stale data') {
    return 'bg-[#F2A93B]/15 text-[#9a650c] border-[#F2A93B]/40';
  }
  return 'bg-[#EAF3FF] text-[#0B2A5B] border-[#DCE7F5]';
}

export function EarthIntelligenceView() {
  const {
    language,
    activeFarm,
    envByFarm,
    envLoading,
    envError,
    fetchEarthIntelligence,
    setActiveSection,
  } = useFieldShift();

  const [techDrawerOpen, setTechDrawerOpen] = useState(false);
  const isAr = language === 'ar';

  if (!activeFarm) {
    return (
      <div className="bg-white rounded-2xl border border-[#DCE7F5] p-8 sm:p-12 text-center max-w-2xl mx-auto">
        <Globe2 className="w-10 h-10 text-[#1769E0] mx-auto mb-3" />
        <h1 className="text-xl font-bold text-[#0B2A5B] mb-2">
          {isAr ? 'لا توجد مزرعة محددة بعد' : 'Connect a farm location for Earth Intelligence'}
        </h1>
        <p className="text-sm text-[#66758A] mb-6">
          {isAr
            ? 'لا نعرض أي بيانات قمر صناعي وهمية. حدد موقع مزرعتك أولاً لجلب بيانات NASA POWER الحقيقية.'
            : 'Field Shift never displays synthetic satellite data. Capture your parcel location first to retrieve real NASA POWER meteorology and elevation.'}
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

  const env = envByFarm[activeFarm.id];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0B2A5B] tracking-tight">
            {isAr ? 'بيانات الأرض الفضائية' : 'Earth Intelligence'}
          </h1>
          <p className="text-sm text-[#66758A] mt-1">
            {activeFarm.name} ·{' '}
            <span className="font-mono tabular-nums">
              {activeFarm.centerLat.toFixed(4)}, {activeFarm.centerLng.toFixed(4)}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => fetchEarthIntelligence(activeFarm)}
            disabled={envLoading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[#DCE7F5] bg-white text-xs font-semibold text-[#12233F] hover:border-[#1769E0] hover:text-[#1769E0] disabled:opacity-50 cursor-pointer"
          >
            {envLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            <span>{isAr ? 'تحديث بيانات ناسا' : 'Refresh NASA Data'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('decision')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1769E0] text-white text-xs font-semibold hover:bg-[#0B2A5B] cursor-pointer"
          >
            <span>{isAr ? 'فتح استوديو القرار' : 'Open Decision Studio'}</span>
            <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
          </button>
        </div>
      </div>



      {/* Layout-Matching Skeleton Loading State */}
      {envLoading && !env && (
        <div className="space-y-4" aria-busy="true" aria-label={isAr ? 'جارٍ تحميل بيانات الأرض' : 'Loading NASA POWER data'}>
          <div className="bg-white rounded-2xl border border-[#DCE7F5] px-5 py-3.5 flex items-center gap-3 text-xs font-semibold text-[#0B2A5B]">
            <Loader2 className="w-4 h-4 text-[#1769E0] animate-spin shrink-0" />
            <span>
              {isAr
                ? 'جارٍ الاتصال بخدمة NASA POWER وبيانات الارتفاع والتربة...'
                : 'Querying live NASA POWER meteorology, elevation, and SoilGrids baseline...'}
            </span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-[#DCE7F5] p-5 space-y-4 animate-pulse"
              >
                <div className="flex justify-between gap-2">
                  <div className="h-4 w-32 rounded bg-[#EAF3FF]" />
                  <div className="h-4 w-16 rounded bg-[#EAF3FF]" />
                </div>
                <div className="h-8 w-24 rounded bg-[#EAF3FF]" />
                <div className="space-y-1.5">
                  <div className="h-3 w-full rounded bg-[#F7FAFE]" />
                  <div className="h-3 w-3/4 rounded bg-[#F7FAFE]" />
                </div>
                <div className="pt-3 border-t border-[#DCE7F5]">
                  <div className="h-3 w-40 rounded bg-[#F7FAFE]" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Honest Error State */}
      {envError && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-red-50 border border-red-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-start gap-2.5 text-xs text-[#12233F]">
            <AlertCircle className="w-4 h-4 text-[#E45C67] shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-[#E45C67]">
                {isAr ? 'تعذر الاتصال بخدمة ناسا المباشرة' : 'Live NASA Service Error'}
              </p>
              <p className="mt-0.5 text-[#66758A]">
                {envError}
                {env
                  ? isAr
                    ? ' يتم عرض آخر سجل حقيقي مخزن مؤقتاً مع تاريخه الأصلي.'
                    : ' Displaying previously cached real data with its original timestamp.'
                  : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => fetchEarthIntelligence(activeFarm)}
            className="px-3.5 py-2 rounded-lg bg-white border border-red-200 text-xs font-semibold text-[#E45C67] hover:bg-red-100 self-start cursor-pointer"
          >
            {isAr ? 'إعادة المحاولة' : 'Retry Connection'}
          </button>
        </div>
      )}

      {/* Empty Fetch State */}
      {!env && !envLoading && !envError && (
        <div className="bg-white rounded-2xl border border-[#DCE7F5] p-8 text-center space-y-4">
          <p className="text-sm font-semibold text-[#0B2A5B]">
            {isAr
              ? 'لم يتم جلب بيانات رصد الأرض لهذه المزرعة بعد.'
              : 'Earth-observation data has not been fetched for this parcel yet.'}
          </p>
          <button
            type="button"
            onClick={() => fetchEarthIntelligence(activeFarm)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1769E0] text-white text-sm font-semibold hover:bg-[#0B2A5B] cursor-pointer"
          >
            <Globe2 className="w-4 h-4" />
            <span>{isAr ? 'جلب بيانات NASA POWER الآن' : 'Fetch Real NASA POWER Data'}</span>
          </button>
        </div>
      )}

      {/* Real Environmental Data View */}
      {env && (
        <>
          {/* Stale Notice */}
          {env.isStale && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
              {isAr
                ? `تنبيه حداثة البيانات: أحدث رصد متاح من الأرشيف يعود إلى ${env.dataDateRange.end}.`
                : `Stale-data notice: latest archive observation is dated ${env.dataDateRange.end}.`}
            </div>
          )}

          {/* Metric Cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {env.metrics.map((m) => (
              <article
                key={m.id}
                className="bg-white rounded-2xl border border-[#DCE7F5] p-5 flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h2 className="text-sm font-bold text-[#0B2A5B]">
                      {isAr ? m.nameAr : m.name}
                    </h2>
                    <span
                      className={`px-2 py-0.5 rounded-md border text-[11px] font-semibold whitespace-nowrap ${statusColors(
                        m.status
                      )}`}
                    >
                      {m.status}
                    </span>
                  </div>

                  <div className="flex items-baseline gap-1.5 my-2">
                    <span className="text-3xl font-bold text-[#12233F] tabular-nums">
                      {m.value !== null ? m.value : '—'}
                    </span>
                    <span className="text-sm font-medium text-[#66758A]">{m.unit}</span>
                  </div>

                  <p className="text-xs text-[#12233F] leading-relaxed">
                    {isAr ? m.interpretationAr : m.interpretation}
                  </p>
                </div>

                <div className="pt-3 border-t border-[#DCE7F5] text-[11px] text-[#66758A] space-y-1">
                  <p>
                    <span className="font-semibold text-[#12233F]">{m.provenance}</span> · {m.source}
                  </p>
                  <p className="font-mono tabular-nums">
                    {m.timestamp} · {m.spatialResolution}
                  </p>
                </div>
              </article>
            ))}

            {/* Terrain Elevation & SoilGrids Reference Card */}
            <article className="bg-white rounded-2xl border border-[#DCE7F5] p-5 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h2 className="text-sm font-bold text-[#0B2A5B]">
                    {isAr ? 'الارتفاع المرجعي للتربة والتضاريس' : 'Elevation & Global Soil Grid'}
                  </h2>
                  <span className="px-2 py-0.5 rounded-md border border-[#DCE7F5] bg-[#F7FAFE] text-[11px] font-semibold text-[#66758A]">
                    {env.elevationMeters !== null ? 'modeled / DEM' : 'partial'}
                  </span>
                </div>

                <div className="flex items-baseline gap-1.5 my-2">
                  <span className="text-3xl font-bold text-[#12233F] tabular-nums">
                    {env.elevationMeters !== null ? env.elevationMeters : '—'}
                  </span>
                  <span className="text-sm font-medium text-[#66758A]">m ASL</span>
                </div>

                {env.soilGridsReference ? (
                  <p className="text-xs text-[#12233F] leading-relaxed">
                    ISRIC SoilGrids (0–5 cm, 250m): pH{' '}
                    <strong className="tabular-nums">{env.soilGridsReference.phH2o ?? '—'}</strong> ·
                    Clay{' '}
                    <strong className="tabular-nums">{env.soilGridsReference.clayPct ?? '—'}%</strong> ·
                    Sand{' '}
                    <strong className="tabular-nums">{env.soilGridsReference.sandPct ?? '—'}%</strong>
                  </p>
                ) : (
                  <p className="text-xs text-[#66758A]">
                    {isAr
                      ? 'بيانات SoilGrids المرجعية غير متاحة لهذه النقطة؛ اعتمد على تحليل التربة المخبري.'
                      : 'Global 250m SoilGrids reference unavailable for this coordinate; local soil test recommended.'}
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-[#DCE7F5] text-[11px] text-[#66758A]">
                <p>{env.elevationSource || 'DEM unavailable'} · {env.soilGridsReference ? 'ISRIC SoilGrids v2.0' : 'Verify locally'}</p>
              </div>
            </article>
          </div>

          {/* 14-Day Trend Chart */}
          <ClimateTrendChart
            series={env.dailySeries}
            baselineTemp={env.summary.baselineAnnualMonthlyAvgTempC}
            isAr={isAr}
          />


        </>
      )}
    </div>
  );
}
