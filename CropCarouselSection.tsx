import React, { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Droplets, RotateCw, ShieldAlert, Thermometer } from 'lucide-react';
import { CROP_IDS, SUPPORTED_CROPS } from '../../data/crops';
import { useFieldShift } from '../../context/FieldShiftContext';

export function CropCarouselSection() {
  const { language, setActiveSection } = useFieldShift();
  const isAr = language === 'ar';
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const crops = CROP_IDS.map((id) => SUPPORTED_CROPS[id]);

  const scrollToCard = (nextIdx: number) => {
    const bounded = Math.max(0, Math.min(crops.length - 1, nextIdx));
    setActiveIndex(bounded);
    const track = trackRef.current;
    if (!track) return;
    const card = track.children[bounded] as HTMLElement | undefined;
    card?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
  };

  const handleTrackKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      scrollToCard(isAr ? activeIndex - 1 : activeIndex + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      scrollToCard(isAr ? activeIndex + 1 : activeIndex - 1);
    }
  };

  return (
    <section
      id="crops-section"
      aria-labelledby="crop-carousel-heading"
      className="py-16 sm:py-20 bg-[#F7FAFE] border-y border-[#DCE7F5]"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="max-w-2xl space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-[#1769E0]">
              {isAr ? 'قاعدة معرفة المحاصيل' : 'Agronomic Crop Knowledge Base'}
            </p>
            <h2
              id="crop-carousel-heading"
              className="text-2xl sm:text-3xl font-bold text-[#0B2A5B] tracking-tight"
            >
              {isAr
                ? 'استكشف المحاصيل المدعومة ببيانات علمية واضحة'
                : 'Five supported crops modeled with transparent agronomic thresholds.'}
            </h2>
            <p className="text-sm text-[#66758A]">
              {isAr
                ? 'يعتمد التقييم على الاحتياج المائي الموسمي، النطاق الحراري الفسيولوجي، وتحمل الملوحة وفق معايير منظمة الأغذية والزراعة (FAO).'
                : 'Every crop is evaluated using FAO seasonal water ranges, continuous thermal tolerance curves, and Maas-Hoffman salinity limits — never invented yield numbers.'}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => scrollToCard(activeIndex - 1)}
              disabled={activeIndex === 0}
              aria-label={isAr ? 'المحصول السابق' : 'Previous crop card'}
              className="w-10 h-10 rounded-xl border border-[#DCE7F5] bg-white flex items-center justify-center text-[#0B2A5B] hover:border-[#1769E0] hover:text-[#1769E0] disabled:opacity-40 cursor-pointer transition-colors"
            >
              {isAr ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
            </button>
            <span className="text-xs font-mono tabular-nums font-semibold text-[#66758A] px-2">
              {activeIndex + 1} / {crops.length}
            </span>
            <button
              type="button"
              onClick={() => scrollToCard(activeIndex + 1)}
              disabled={activeIndex === crops.length - 1}
              aria-label={isAr ? 'المحصول التالي' : 'Next crop card'}
              className="w-10 h-10 rounded-xl border border-[#DCE7F5] bg-white flex items-center justify-center text-[#0B2A5B] hover:border-[#1769E0] hover:text-[#1769E0] disabled:opacity-40 cursor-pointer transition-colors"
            >
              {isAr ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Interactive Horizontal Swipeable Track */}
        <div
          ref={trackRef}
          tabIndex={0}
          role="region"
          aria-label={isAr ? 'بطاقات المحاصيل الزراعية' : 'Supported agricultural crops carousel'}
          onKeyDown={handleTrackKeyDown}
          className="flex gap-5 overflow-x-auto snap-x snap-mandatory pb-3 focus-visible:outline-2 focus-visible:outline-[#1769E0] rounded-2xl"
        >
          {crops.map((crop, idx) => (
            <article
              key={crop.id}
              onClick={() => setActiveIndex(idx)}
              className={`snap-start shrink-0 w-[86%] sm:w-[360px] rounded-2xl bg-white border p-6 flex flex-col justify-between space-y-5 transition-all ${
                activeIndex === idx
                  ? 'border-[#1769E0] shadow-md'
                  : 'border-[#DCE7F5] hover:border-[#1769E0]/60'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-bold text-[#0B2A5B]">
                      {isAr ? crop.nameAr : crop.name}
                    </h3>
                    <p className="text-xs italic text-[#66758A]">{crop.scientificName}</p>
                  </div>
                  <span className="text-[11px] font-semibold uppercase tracking-wide px-2 py-1 rounded bg-[#EAF3FF] text-[#1769E0]">
                    {isAr ? crop.familyAr : crop.family}
                  </span>
                </div>

                <p className="text-xs font-medium text-[#12233F]">
                  {isAr ? crop.roleLabelAr : crop.roleLabel}
                </p>

                <dl className="grid grid-cols-2 gap-2.5 pt-2 border-t border-[#DCE7F5] text-xs">
                  <div className="bg-[#F7FAFE] rounded-xl p-2.5 border border-[#DCE7F5]/70">
                    <dt className="flex items-center gap-1 text-[11px] text-[#66758A] mb-0.5">
                      <Droplets className="w-3.5 h-3.5 text-[#1769E0]" />
                      <span>{isAr ? 'الاحتياج المائي' : 'Water Need'}</span>
                    </dt>
                    <dd className="font-bold font-mono tabular-nums text-[#0B2A5B]">
                      {crop.seasonalWaterMm[0]}–{crop.seasonalWaterMm[1]} mm
                    </dd>
                  </div>

                  <div className="bg-[#F7FAFE] rounded-xl p-2.5 border border-[#DCE7F5]/70">
                    <dt className="flex items-center gap-1 text-[11px] text-[#66758A] mb-0.5">
                      <Thermometer className="w-3.5 h-3.5 text-[#1769E0]" />
                      <span>{isAr ? 'الحرارة المثلى' : 'Optimal Temp'}</span>
                    </dt>
                    <dd className="font-bold font-mono tabular-nums text-[#0B2A5B]">
                      {crop.optimalTempC[0]}–{crop.optimalTempC[1]}°C
                    </dd>
                  </div>

                  <div className="bg-[#F7FAFE] rounded-xl p-2.5 border border-[#DCE7F5]/70">
                    <dt className="flex items-center gap-1 text-[11px] text-[#66758A] mb-0.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-[#F2A93B]" />
                      <span>{isAr ? 'حد الملوحة الآمن' : 'Safe Salinity EC'}</span>
                    </dt>
                    <dd className="font-bold font-mono tabular-nums text-[#0B2A5B]">
                      ≤ {crop.maxSafeEcDsM.toFixed(1)} dS/m
                    </dd>
                  </div>

                  <div className="bg-[#F7FAFE] rounded-xl p-2.5 border border-[#DCE7F5]/70">
                    <dt className="flex items-center gap-1 text-[11px] text-[#66758A] mb-0.5">
                      <RotateCw className="w-3.5 h-3.5 text-[#19A974]" />
                      <span>{isAr ? 'المواسم المفضلة' : 'Seasons'}</span>
                    </dt>
                    <dd className="font-semibold text-[#0B2A5B] capitalize truncate">
                      {crop.preferredSeasons.join(', ')}
                    </dd>
                  </div>
                </dl>

                <p className="text-xs text-[#66758A] leading-relaxed">
                  {isAr ? crop.rotationBenefitsAr : crop.rotationBenefits}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setActiveSection('capture')}
                className="w-full py-2.5 px-4 rounded-xl border border-[#DCE7F5] bg-[#F7FAFE] hover:bg-[#EAF3FF] hover:border-[#1769E0] text-xs font-semibold text-[#0B2A5B] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>{isAr ? 'قيّم ملاءمة هذا المحصول لأرضك' : 'Evaluate on Your Farm'}</span>
                <ArrowRight className={`w-3.5 h-3.5 ${isAr ? 'rotate-180' : ''}`} />
              </button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
