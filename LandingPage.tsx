import React, { useState } from 'react';
import {
  Activity,
  ArrowDown,
  ArrowRight,
  CheckCircle2,
  Compass,
  Droplets,
  FileCheck2,
  Globe2,
  Layers,
  MapPin,
  RotateCw,
  ScanLine,
  ShieldCheck,
  Sprout,
} from 'lucide-react';
import heroEarthBg from '../assets/images/hero_earth_sunrise_farm_1794576485346.jpg';
import fieldScanImg from '../assets/images/field_scan_showcase_1794576485303.jpg';
import { useFieldShift } from '../context/FieldShiftContext';
import { t } from '../i18n/translations';
import { BrandLogo } from './BrandLogo';
import { PublicNavbar } from './public/PublicNavbar';
import { SectionReveal } from './public/SectionReveal';
import { CropCarouselSection } from './public/CropCarouselSection';
import { ScenarioPreviewSection } from './public/ScenarioPreviewSection';

export function LandingPage() {
  const { language, setActiveSection, user, activeFarm, envByFarm, activeDecision } = useFieldShift();
  const activeEnv = activeFarm ? envByFarm[activeFarm.id] : undefined;
  const isAr = language === 'ar';
  const [rotationPreset, setRotationPreset] = useState<'nitrogen_cycle' | 'water_recovery'>('nitrogen_cycle');

  const jumpTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const problems = isAr
    ? [
        {
          title: 'تشتت البيانات المناخية والتربة',
          desc: 'تبقى تقارير المختبر ودرجات الحرارة التاريخية وملاحظات الري متفرقة دون ربطها بقرار موسمي واحد.',
        },
        {
          title: 'ضغط المياه وملوحة التربة',
          desc: 'اختيار محصول عالي الاحتياج المائي أو حساس للملوحة يضاعف الخسائر قبل منتصف الموسم.',
        },
        {
          title: 'تكرار نفس العائلة النباتية',
          desc: 'زراعة الحبوب بشكل متواصل يستنزف النيتروجين التربي ويرفع تراكم الآفات والأمراض الجذرية.',
        },
        {
          title: 'توصيات ذكاء اصطناعي غير مفسّرة',
          desc: 'النماذج المغلقة تعطي إجابات عامة دون كشف المعادلات أو مصادر الرصد أو الفجوات المعرفية.',
        },
      ]
    : [
        {
          title: 'Fragmented Field & Weather Signals',
          desc: 'Soil lab sheets, regional temperature shifts, and parcel boundaries stay disconnected from planting decisions.',
        },
        {
          title: 'Hidden Water & Salinity Thresholds',
          desc: 'Planting a salt-sensitive or high-ET crop into a tight water budget triggers avoidable mid-season stress.',
        },
        {
          title: 'Monoculture Pest & Nitrogen Drain',
          desc: 'Repeating the same botanical family season after season exhausts soil nitrogen and carries host diseases forward.',
        },
        {
          title: 'Opaque Black-Box Advice',
          desc: 'Generic chatbots rarely expose factor weights, agronomic limits, or missing evidence gaps.',
        },
      ];

  const workflowSteps = isAr
    ? [
        { num: '01', icon: MapPin, title: 'تحديد المزرعة', desc: 'ارسم حدود الحقل بدقة جغرافية أو اختر نقطة الرصد.', sec: 'capture' as const },
        { num: '02', icon: Globe2, title: 'بيانات الأرض الفضائية', desc: 'جلب سلاسل الحرارة، الأمطار، الإشعاع، ورطوبة التربة من NASA POWER.', sec: 'earth' as const },
        { num: '03', icon: ScanLine, title: 'الفحص الذكي للحقل', desc: 'فحص صور الأوراق أو استخراج قيم NPK والحموضة والملوحة من تقارير التربة.', sec: 'scan' as const },
        { num: '04', icon: Compass, title: 'استوديو القرار', desc: 'تقييم عددي مفسّر لكل محصول، وخطة دورة زراعية لـ 4 مواسم.', sec: 'decision' as const },
        { num: '05', icon: Activity, title: 'تنفيذ وتقارير', desc: 'إجراءات موثقة، محاكاة تغير المناخ، وتقارير جاهزة للطباعة.', sec: 'action' as const },
      ]
    : [
        { num: '01', icon: MapPin, title: 'Field Location', desc: 'Draw exact parcel boundaries or pick coordinates with geodesic area math.', sec: 'capture' as const },
        { num: '02', icon: Globe2, title: 'Earth Data', desc: 'Fetch real NASA POWER meteorology, solar radiation, and root moisture.', sec: 'earth' as const },
        { num: '03', icon: ScanLine, title: 'AI Field Scan', desc: 'Inspect foliage photos with quality gates or extract NPK & EC via lab OCR.', sec: 'scan' as const },
        { num: '04', icon: Compass, title: 'Crop Intelligence', desc: 'Transparent suitability scoring & 4-season botanical family rotation.', sec: 'decision' as const },
        { num: '05', icon: Activity, title: 'Action & Reports', desc: 'Climate stress testing, prioritized checklists, and printable briefs.', sec: 'action' as const },
      ];

  const rotationExample =
    rotationPreset === 'nitrogen_cycle'
      ? [
          {
            slot: isAr ? 'الموسم السابق' : 'Previous Season',
            crop: isAr ? 'القمح الشتوي' : 'Winter Wheat',
            family: 'Poaceae',
            note: isAr ? 'يستنزف النيتروجين المتاح ويترك مخلفات سطحية.' : 'Draws down available soil N while building surface residue.',
          },
          {
            slot: isAr ? 'الموسم القادم الموصى به' : 'Next Recommended',
            crop: isAr ? 'فول الصويا / البرسيم' : 'Soybean / Clover Forage',
            family: 'Fabaceae',
            note: isAr ? 'يثبت النيتروجين الجوي ويكسر دورة أمراض الحبوب.' : 'Symbiotic N-fixation restores fertility and breaks cereal pest cycle.',
          },
          {
            slot: isAr ? 'الموسم اللاحق' : 'Following Season',
            crop: isAr ? 'الذرة الشامية أو القمح' : 'Maize or Wheat',
            family: 'Poaceae',
            note: isAr ? 'يستفيد من النيتروجين التربي المثبت لتحسين استقرار النمو.' : 'Captures mineralized legume nitrogen for stronger vegetative vigor.',
          },
        ]
      : [
          {
            slot: isAr ? 'الموسم السابق' : 'Previous Season',
            crop: isAr ? 'الذرة الشامية' : 'Maize',
            family: 'Poaceae',
            note: isAr ? 'استهلاك مائي مرتفع وتكثيف جذري في الطبقة العليا.' : 'High seasonal ET demand focused in the upper root zone.',
          },
          {
            slot: isAr ? 'الموسم القادم الموصى به' : 'Next Recommended',
            crop: isAr ? 'البرسيم المصري' : 'Berseem Clover',
            family: 'Fabaceae',
            note: isAr ? 'يحسّن بناء التربة ويغطي السطح في الشتاء.' : 'Cool-season soil cover reduces evaporation and restores organic matter.',
          },
          {
            slot: isAr ? 'الموسم اللاحق' : 'Following Season',
            crop: isAr ? 'دوار الشمس' : 'Sunflower',
            family: 'Asteraceae',
            note: isAr ? 'جذر وتدي عميق يتحمل شح المياه ويستخلص الرطوبة العميقة.' : 'Deep taproot extracts subsoil water under tight irrigation budgets.',
          },
        ];

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="min-h-screen bg-white text-[#12233F] flex flex-col">
      {/* 1. Sticky Top Navigation */}
      <PublicNavbar onJumpToSection={jumpTo} />

      <main className="flex-1">
        {/* 2. Hero Editorial Section + Orbital Earth-to-Land Art */}
        <section className="relative overflow-hidden bg-[#062B61] text-white">
          <div className="absolute inset-0 pointer-events-none">
            <img
              src={heroEarthBg}
              alt={isAr ? 'كوكب الأرض والمراقبة الفضائية فوق حقول زراعية عند شروق الشمس' : 'Orbital Earth observation transitioning to sunlit irrigated farmland'}
              className="w-full h-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#062B61]/85 via-[#0B2A5B]/55 to-[#062B61]/30" />
            <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-white via-white/70 to-transparent" />
          </div>

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16 pb-20 sm:pb-24">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {/* Left Editorial White/Soft Card inspired by Reference Layout */}
              <div className="lg:col-span-6 rounded-3xl bg-[#F7FAFE]/95 backdrop-blur-md border border-white/80 text-[#0B2A5B] p-7 sm:p-10 shadow-2xl space-y-5">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1769E0]">
                  {isAr ? 'دعم القرار الزراعي الذكي مناخياً' : 'Climate-Smart Agricultural Intelligence'}
                </p>

                <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-extrabold leading-[1.14] tracking-tight text-[#062B61]">
                  {isAr
                    ? 'اجعل كل قرار زراعي محسوباً ومستنداً للأرض.'
                    : 'Make every farming decision count.'}
                </h1>

                <p className="text-sm sm:text-base text-[#12233F]/85 leading-relaxed">
                  {isAr
                    ? 'تجمع منصة فيلد شيفت رصد NASA POWER الفضائي، تحليل التربة، والفحص الذكي للمحاصيل في معادلات شفافة تساعدك على اختيار المحصول الأنسب وبناء دورة زراعية مستدامة.'
                    : 'Field Shift unifies NASA POWER Earth observation, verified soil lab chemistry, and AI field inspection into transparent agronomic math — helping you select the right crop and rotate with confidence.'}
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setActiveSection('capture')}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#062B61] hover:bg-[#1769E0] text-white text-sm font-semibold shadow-md transition-colors cursor-pointer"
                  >
                    <span>{t(language, 'scanYourFarm')}</span>
                    <ArrowRight className={`w-4 h-4 ${isAr ? 'rotate-180' : ''}`} />
                  </button>

                  <button
                    type="button"
                    onClick={() => jumpTo('workflow-section')}
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white border border-[#DCE7F5] hover:border-[#1769E0] text-[#0B2A5B] text-sm font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    <ArrowDown className="w-4 h-4 text-[#1769E0]" />
                    <span>{isAr ? 'استكشف المنصة' : 'Explore Platform'}</span>
                  </button>
                </div>

                {!user && (
                  <p className="text-xs text-[#66758A] pt-1">
                    {isAr ? 'لديك مزرعة محفوظة؟ ' : 'Returning grower? '}
                    <button
                      type="button"
                      onClick={() => setActiveSection('sign_in')}
                      className="font-semibold text-[#1769E0] hover:underline cursor-pointer"
                    >
                      {isAr ? 'سجّل الدخول لمزامنة بياناتك' : 'Sign in to sync your parcels'}
                    </button>
                  </p>
                )}
              </div>

              {/* Right Translucent Telemetry Architecture Frame (Honest state, never fake numbers) */}
              <div className="lg:col-span-6 flex lg:justify-end">
                <div className="w-full max-w-md rounded-2xl bg-[#0B2A5B]/60 backdrop-blur-lg border border-white/25 p-5 sm:p-6 text-white shadow-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-white/15 pb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-white/85">
                      {activeFarm
                        ? isAr
                          ? `الحقل النشط: ${activeFarm.name}`
                          : `Active Parcel: ${activeFarm.name}`
                        : isAr
                        ? 'بنية الرصد المترابطة'
                        : 'Connected Observation Pipeline'}
                    </span>
                    <Globe2 className="w-4 h-4 text-[#93C5FD]" />
                  </div>

                  {activeFarm && activeEnv ? (
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="rounded-xl bg-white/10 p-3">
                        <p className="text-[11px] text-white/75">{isAr ? 'متوسط الحرارة' : 'Mean Temp'}</p>
                        <p className="text-base font-bold font-mono tabular-nums mt-0.5">
                          {activeEnv.summary.avgTempC?.toFixed(1) ?? '—'}°C
                        </p>
                      </div>
                      <div className="rounded-xl bg-white/10 p-3">
                        <p className="text-[11px] text-white/75">{isAr ? 'أمطار 14 يوم' : '14d Rain'}</p>
                        <p className="text-base font-bold font-mono tabular-nums mt-0.5">
                          {activeEnv.summary.totalPrecip14dMm?.toFixed(1) ?? '—'} mm
                        </p>
                      </div>
                      <div className="rounded-xl bg-white/10 p-3">
                        <p className="text-[11px] text-white/75">{isAr ? 'أفضل محصول' : 'Top Match'}</p>
                        <p className="text-sm font-bold mt-1 truncate">
                          {activeDecision?.evaluations[0]
                            ? isAr
                              ? activeDecision.evaluations[0].cropNameAr
                              : activeDecision.evaluations[0].cropName
                            : '—'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2.5 text-xs text-white/90">
                      <div className="flex items-center justify-between rounded-xl bg-white/10 px-3.5 py-2.5">
                        <span className="flex items-center gap-2 font-medium">
                          <Droplets className="w-4 h-4 text-[#93C5FD]" />
                          {isAr ? 'توازن المياه والتربة (FAO-56)' : 'FAO Water Budget & Soil EC'}
                        </span>
                        <span className="font-mono text-[11px] text-white/75">30% + 20%</span>
                      </div>
                      <div className="flex items-center justify-between rounded-xl bg-white/10 px-3.5 py-2.5">
                        <span className="flex items-center gap-2 font-medium">
                          <Globe2 className="w-4 h-4 text-[#93C5FD]" />
                          {isAr ? 'سلاسل NASA POWER اليومية' : 'NASA POWER 14d Climate Series'}
                        </span>
                        <span className="font-mono text-[11px] text-white/75">25%</span>
                      </div>
                      <div className="flex items-center justify-between rounded-xl bg-white/10 px-3.5 py-2.5">
                        <span className="flex items-center gap-2 font-medium">
                          <RotateCw className="w-4 h-4 text-[#93C5FD]" />
                          {isAr ? 'توافق الموسم والدورة الزراعية' : 'Season & Family Rotation'}
                        </span>
                        <span className="font-mono text-[11px] text-white/75">15% + 10%</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Floating Capability Bar echoing Visual Reference */}
            <div className="mt-10 max-w-4xl mx-auto rounded-2xl bg-white border border-[#DCE7F5] shadow-lg px-5 py-4 grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x rtl:sm:divide-x-reverse divide-[#DCE7F5] text-center text-[#0B2A5B]">
              <div className="py-2 sm:py-0 px-3 flex items-center justify-center gap-2.5 text-xs sm:text-sm font-semibold">
                <Sprout className="w-4 h-4 text-[#1769E0] shrink-0" />
                <span>{isAr ? 'تحليلات التربة والمحاصيل' : 'Soil & Crop Insights'}</span>
              </div>
              <div className="py-2 sm:py-0 px-3 flex items-center justify-center gap-2.5 text-xs sm:text-sm font-semibold">
                <Globe2 className="w-4 h-4 text-[#1769E0] shrink-0" />
                <span>{isAr ? 'رصد فضائي مناخي مباشر' : 'Earth Observation Telemetry'}</span>
              </div>
              <div className="py-2 sm:py-0 px-3 flex items-center justify-center gap-2.5 text-xs sm:text-sm font-semibold">
                <RotateCw className="w-4 h-4 text-[#19A974] shrink-0" />
                <span>{isAr ? 'تخطيط الدورات الزراعية' : 'Sustainable Crop Rotation'}</span>
              </div>
            </div>
          </div>
        </section>

        {/* 3. The Problem Section */}
        <SectionReveal id="problem-section" className="py-16 sm:py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
            <div className="max-w-2xl space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-[#1769E0]">
                {isAr ? 'لماذا تفشل التوصيات السطحية؟' : 'Why Decisions Break Down'}
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-[#0B2A5B] tracking-tight">
                {isAr
                  ? 'أربع فجوات تحوّل البيانات الزراعية إلى قرارات غير مكتملة.'
                  : 'Four practical blind spots in seasonal farm planning.'}
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {problems.map((item, idx) => (
                <div
                  key={item.title}
                  className="rounded-2xl bg-[#F7FAFE] border border-[#DCE7F5] p-6 space-y-3 hover:border-[#1769E0]/60 transition-colors"
                >
                  <span className="text-xs font-mono font-bold text-[#1769E0]">0{idx + 1}</span>
                  <h3 className="text-base font-bold text-[#0B2A5B]">{item.title}</h3>
                  <p className="text-xs sm:text-sm text-[#66758A] leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </SectionReveal>

        {/* 4. How Field Shift Works (5-Step Connected Flow) */}
        <SectionReveal id="workflow-section" className="py-16 sm:py-20 bg-[#F7FAFE] border-y border-[#DCE7F5]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="max-w-2xl space-y-2">
                <p className="text-xs font-bold uppercase tracking-widest text-[#1769E0]">
                  {isAr ? 'تدفق العمل المتكامل' : 'How Field Shift Works'}
                </p>
                <h2 className="text-2xl sm:text-3xl font-bold text-[#0B2A5B] tracking-tight">
                  {isAr
                    ? 'من إحداثيات الأرض إلى خطة الموسم في خمس خطوات واضحة.'
                    : 'From parcel coordinates to a defendable season plan in five linked stages.'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveSection('capture')}
                className="inline-flex items-center gap-2 text-sm font-semibold text-[#1769E0] hover:underline cursor-pointer shrink-0"
              >
                <span>{isAr ? 'ابدأ من الخطوة الأولى' : 'Start with Farm Capture'}</span>
                <ArrowRight className={`w-4 h-4 ${isAr ? 'rotate-180' : ''}`} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {workflowSteps.map((step) => {
                const Icon = step.icon;
                return (
                  <button
                    key={step.num}
                    type="button"
                    onClick={() => setActiveSection(step.sec)}
                    className="text-start rounded-2xl bg-white border border-[#DCE7F5] hover:border-[#1769E0] hover:shadow-md p-5 flex flex-col justify-between space-y-4 transition-all cursor-pointer group"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="w-9 h-9 rounded-xl bg-[#EAF3FF] text-[#1769E0] flex items-center justify-center group-hover:bg-[#1769E0] group-hover:text-white transition-colors">
                          <Icon className="w-4 h-4" />
                        </span>
                        <span className="text-xs font-mono font-bold text-[#66758A]">{step.num}</span>
                      </div>
                      <h3 className="text-sm font-bold text-[#0B2A5B]">{step.title}</h3>
                      <p className="text-xs text-[#66758A] leading-relaxed">{step.desc}</p>
                    </div>
                    <span className="text-[11px] font-semibold text-[#1769E0] inline-flex items-center gap-1">
                      <span>{isAr ? 'فتح' : 'Open stage'}</span>
                      <ArrowRight className={`w-3 h-3 ${isAr ? 'rotate-180' : ''}`} />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </SectionReveal>

        {/* 5. AI Field Scan Showcase */}
        <SectionReveal id="ai-scan-section" className="py-16 sm:py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
              <div className="lg:col-span-6">
                <div className="rounded-3xl overflow-hidden border border-[#DCE7F5] shadow-lg bg-[#F7FAFE]">
                  <img
                    src={fieldScanImg}
                    alt={isAr ? 'فحص بصري دقيق لأوراق المحصول والتربة السطحية في ضوء النهار' : 'Daylight agronomic inspection of green crop leaves and loam topsoil'}
                    className="w-full h-[300px] sm:h-[380px] object-cover"
                  />
                </div>
              </div>

              <div className="lg:col-span-6 space-y-5">
                <p className="text-xs font-bold uppercase tracking-widest text-[#1769E0]">
                  {isAr ? 'الفحص الميداني وتحليل التربة' : 'Field & Soil Report Inspection'}
                </p>
                <h2 className="text-2xl sm:text-3xl font-bold text-[#0B2A5B] tracking-tight">
                  {isAr ? 'شاهد ما يخبرك به حقلك بوضوح وأمانة.' : 'See what your field is telling you.'}
                </h2>
                <p className="text-sm sm:text-base text-[#66758A] leading-relaxed">
                  {isAr
                    ? 'ارفع صورة ورقة محصول أو ورقة تحليل تربة مخبرية. يتحقق بواب الجودة البصرية من وضوح الإضاءة والموضوع أولاً، ويستخرج قيم الحموضة والملوحة و NPK لمراجعتك قبل اعتمادها.'
                    : 'Upload a field canopy photo or soil laboratory document. Field Shift checks image quality first, flags unsupported crops transparently, and lets you review OCR soil metrics (pH, EC, NPK) before applying them to scoring.'}
                </p>

                <ul className="space-y-2.5 text-xs sm:text-sm text-[#12233F]">
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#19A974] shrink-0 mt-0.5" />
                    <span>
                      {isAr
                        ? 'بوابة تحقق صارمة: يرفض الصور المظلمة أو غير الزراعية بدلاً من اختراع تشخيص.'
                        : 'Strict Quality Gate: declines blurry, dark, or non-agricultural images instead of guessing.'}
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#19A974] shrink-0 mt-0.5" />
                    <span>
                      {isAr
                        ? 'ربط الإشارات البصرية مع رطوبة وحرارة NASA POWER الفعلية للمزرعة.'
                        : 'Cross-checks foliar stress indicators against active parcel NASA POWER moisture & heat.'}
                    </span>
                  </li>
                </ul>

                <button
                  type="button"
                  onClick={() => setActiveSection('scan')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1769E0] hover:bg-[#0B2A5B] text-white text-sm font-semibold transition-colors cursor-pointer"
                >
                  <ScanLine className="w-4 h-4" />
                  <span>{isAr ? 'جرِّب فحص الحقل' : 'Open Field Scan'}</span>
                </button>
              </div>
            </div>
          </div>
        </SectionReveal>

        {/* 6. Interactive 5-Crop Intelligence Carousel */}
        <CropCarouselSection />

        {/* 7. Explainable Decision Recommendations Preview */}
        <SectionReveal className="py-16 sm:py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-5 space-y-4">
              <p className="text-xs font-bold uppercase tracking-widest text-[#1769E0]">
                {isAr ? 'لماذا صُمم الترتيب هكذا؟' : 'Explainable Suitability Scoring'}
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-[#0B2A5B] tracking-tight">
                {isAr
                  ? 'كل درجة لها معادلة، وقيود استبعاد صريحة.'
                  : 'Every suitability score breaks down into measurable weights and hard limits.'}
              </h2>
              <p className="text-sm text-[#66758A] leading-relaxed">
                {isAr
                  ? 'يعرض استوديو القرار مساهمة كل عامل بشكل منفصل، مع إشارة صريحة للبيانات الناقصة التي تخفض مستوى الثقة.'
                  : 'Decision Studio shows the exact weight contributed by water, climate, soil chemistry, season, and rotation — alongside explicit missing-data disclosures that reduce confidence honestly.'}
              </p>
              <button
                type="button"
                onClick={() => setActiveSection('decision')}
                className="inline-flex items-center gap-2 text-sm font-semibold text-[#1769E0] hover:underline cursor-pointer"
              >
                <span>{isAr ? 'افتح استوديو القرار' : 'Open Decision Studio'}</span>
                <ArrowRight className={`w-4 h-4 ${isAr ? 'rotate-180' : ''}`} />
              </button>
            </div>

            <div className="lg:col-span-7 rounded-2xl border border-[#DCE7F5] bg-[#F7FAFE] p-6 space-y-4">
              {activeFarm && activeDecision ? (
                <>
                  <div className="flex items-center justify-between border-b border-[#DCE7F5] pb-3">
                    <span className="text-xs font-bold text-[#0B2A5B]">
                      {isAr ? `النتائج الفعلية لحقل ${activeFarm.name}` : `Live Evaluations for ${activeFarm.name}`}
                    </span>
                    <span className="text-xs font-mono text-[#66758A]">
                      {activeDecision.overallConfidenceScore}% conf
                    </span>
                  </div>
                  <div className="space-y-2.5">
                    {activeDecision.evaluations.slice(0, 3).map((ev) => (
                      <div
                        key={ev.cropId}
                        className="rounded-xl bg-white border border-[#DCE7F5] px-4 py-3 flex items-center justify-between"
                      >
                        <div>
                          <p className="text-sm font-bold text-[#0B2A5B]">
                            #{ev.rank} {isAr ? ev.cropNameAr : ev.cropName}
                          </p>
                          <p className="text-xs text-[#66758A]">
                            {isAr ? ev.positiveFactorsAr[0] || ev.mainRisksAr[0] : ev.positiveFactors[0] || ev.mainRisks[0]}
                          </p>
                        </div>
                        <span className="text-base font-extrabold font-mono text-[#1769E0] tabular-nums">
                          {ev.suitabilityIndex}/100
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between border-b border-[#DCE7F5] pb-3">
                    <span className="text-xs font-bold text-[#0B2A5B]">
                      {isAr ? 'هيكل أوزان التقييم القياسي (تُحسب الدرجات بعد تسجيل مزرعتك)' : 'Standard Scoring Rubric (Live Scores Compute Once a Farm Is Captured)'}
                    </span>
                    <Layers className="w-4 h-4 text-[#1769E0]" />
                  </div>
                  <div className="space-y-3">
                    {[
                      { label: isAr ? 'توافق الميزانية المائية (FAO-56)' : 'FAO-56 Water Budget Match', pct: 30 },
                      { label: isAr ? 'النطاق الحراري و GDD (NASA POWER)' : 'Thermal Curve & GDD Fit (NASA POWER)', pct: 25 },
                      { label: isAr ? 'كيمياء التربة والملوحة (Maas-Hoffman)' : 'Soil Chemistry & Maas-Hoffman EC', pct: 20 },
                      { label: isAr ? 'التقويم الموسمي للمنطقة' : 'Seasonal Planting Calendar', pct: 15 },
                      { label: isAr ? 'تعاقب العائلات النباتية' : 'Botanical Family Rotation', pct: 10 },
                    ].map((row) => (
                      <div key={row.label} className="space-y-1">
                        <div className="flex justify-between text-xs font-semibold text-[#12233F]">
                          <span>{row.label}</span>
                          <span className="font-mono tabular-nums text-[#1769E0]">{row.pct}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-white border border-[#DCE7F5] overflow-hidden">
                          <div
                            className="h-full bg-[#1769E0]"
                            style={{ width: `${row.pct * 2.6}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </SectionReveal>

        {/* 8. Interactive Crop Rotation Planning Sequence */}
        <SectionReveal className="py-16 sm:py-20 bg-[#F7FAFE] border-y border-[#DCE7F5]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="max-w-2xl space-y-2">
                <p className="text-xs font-bold uppercase tracking-widest text-[#1769E0]">
                  {isAr ? 'تخطيط الدورة الزراعية' : 'Multi-Season Crop Rotation'}
                </p>
                <h2 className="text-2xl sm:text-3xl font-bold text-[#0B2A5B] tracking-tight">
                  {isAr
                    ? 'اكسر دورات الآفات وحافظ على خصوبة التربة عبر المواسم.'
                    : 'Break host-pest cycles and replenish soil nitrogen across seasons.'}
                </h2>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setRotationPreset('nitrogen_cycle')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                    rotationPreset === 'nitrogen_cycle'
                      ? 'bg-[#0B2A5B] text-white border-[#0B2A5B]'
                      : 'bg-white text-[#12233F] border-[#DCE7F5] hover:border-[#1769E0]'
                  }`}
                >
                  {isAr ? 'مسار استعادة النيتروجين' : 'Nitrogen Recovery'}
                </button>
                <button
                  type="button"
                  onClick={() => setRotationPreset('water_recovery')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                    rotationPreset === 'water_recovery'
                      ? 'bg-[#0B2A5B] text-white border-[#0B2A5B]'
                      : 'bg-white text-[#12233F] border-[#DCE7F5] hover:border-[#1769E0]'
                  }`}
                >
                  {isAr ? 'مسار التكيّف مع شح المياه' : 'Water-Saving Sequence'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {rotationExample.map((step, i) => (
                <div
                  key={step.slot}
                  className="rounded-2xl bg-white border border-[#DCE7F5] p-6 space-y-3 relative"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#1769E0]">{step.slot}</span>
                    <span className="font-mono text-[#66758A] bg-[#F7FAFE] px-2 py-0.5 rounded border border-[#DCE7F5]">
                      {step.family}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-[#0B2A5B]">
                    {i + 1}. {step.crop}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#66758A] leading-relaxed">{step.note}</p>
                </div>
              ))}
            </div>
          </div>
        </SectionReveal>

        {/* 9. Interactive What-If Climate Scenarios */}
        <ScenarioPreviewSection />

        {/* 10. Trust & Responsible Data Honesty */}
        <SectionReveal id="trust-section" className="py-16 sm:py-20 bg-[#F7FAFE] border-y border-[#DCE7F5]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
            <div className="max-w-2xl space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-[#1769E0]">
                {isAr ? 'نزاهة البيانات والشفافية' : 'Trust & Responsible Data Integrity'}
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-[#0B2A5B] tracking-tight">
                {isAr
                  ? 'نفصل بوضوح بين مصدر كل معلومة وحدودها العلمية.'
                  : 'We separate provenance clearly so you know where every number comes from.'}
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  title: isAr ? 'بيانات يُدخلها المزارع' : 'User-Provided',
                  desc: isAr ? 'حدود المزرعة، المحصول السابق، مستوى الري، وتحليلات المختبر اليدوية.' : 'Parcel coordinates, boundary vertices, irrigation tier, and manual soil lab readings.',
                },
                {
                  title: isAr ? 'بيانات فضائية (NASA POWER)' : 'Satellite-Derived',
                  desc: isAr ? 'متوسطات يومية لدرجات الحرارة، الإشعاع، الأمطار، ورطوبة التربة مع توثيق فترة الرصد.' : 'NASA POWER meteorological grid series and SoilGrids baseline with explicit timestamps.',
                },
                {
                  title: isAr ? 'تقييم بصري بالذكاء الاصطناعي' : 'AI Visual Assessment',
                  desc: isAr ? 'ملاحظات أولية عن إشارات الإجهاد في صور الحقل واستخراج القيم الرقمية من أوراق التحليل.' : 'Preliminary canopy stress observations & lab OCR subject to your confirmation.',
                },
                {
                  title: isAr ? 'مؤشر الملاءمة المحسوب' : 'Calculated Suitability Index',
                  desc: isAr ? 'معادلات رياضية حتمية (FAO-56 و Maas-Hoffman) — ليست تنبؤاً أو ضماناً للإنتاجية.' : 'Deterministic agronomic math — advisory decision support, never a yield or profit guarantee.',
                },
              ].map((card) => (
                <div
                  key={card.title}
                  className="rounded-2xl bg-white border border-[#DCE7F5] p-5 space-y-2"
                >
                  <div className="flex items-center gap-2 text-[#0B2A5B]">
                    <ShieldCheck className="w-4 h-4 text-[#1769E0] shrink-0" />
                    <h3 className="text-sm font-bold">{card.title}</h3>
                  </div>
                  <p className="text-xs text-[#66758A] leading-relaxed">{card.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </SectionReveal>

        {/* 11. Final Conversion Band */}
        <section className="py-16 sm:py-20 bg-[#062B61] text-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-6">
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
              {isAr
                ? 'افهم أرضك بوضوح. واختر موسمك القادم بثقة.'
                : 'Understand your land. Choose what comes next.'}
            </h2>
            <p className="text-sm sm:text-base text-white/80 max-w-2xl mx-auto">
              {isAr
                ? 'ابدأ الآن برسم حدود حقلك مجاناً، أو أنشئ حساباً لحفظ تاريخ المزرعة ودوراتها عبر المواسم.'
                : 'Map your first field immediately, or create an account to save parcel records, scans, and multi-season rotations across devices.'}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setActiveSection('capture')}
                className="px-6 py-3 rounded-xl bg-[#1769E0] hover:bg-white hover:text-[#062B61] text-white text-sm font-bold shadow-md transition-colors cursor-pointer"
              >
                {t(language, 'scanYourFarm')}
              </button>
              <button
                type="button"
                onClick={() => setActiveSection('sign_up')}
                className="px-6 py-3 rounded-xl bg-white text-[#062B61] hover:bg-[#EAF3FF] text-sm font-bold transition-colors cursor-pointer"
              >
                {isAr ? 'إنشاء حساب' : 'Create an Account'}
              </button>
              <button
                type="button"
                onClick={() => setActiveSection('sign_in')}
                className="px-5 py-3 rounded-xl border border-white/35 text-white hover:bg-white/10 text-sm font-semibold transition-colors cursor-pointer"
              >
                {isAr ? 'تسجيل الدخول' : 'Sign In'}
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Clean Public Footer */}
      <footer className="bg-white border-t border-[#DCE7F5] py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <BrandLogo variant="horizontal" size="xs" />
          <p className="text-xs text-[#66758A] text-center">
            {isAr
              ? 'فيلد شيفت — منصة دعم القرار الزراعي الذكي مناخياً. أداة استرشادية قائمة على الرصد الأرضي.'
              : 'Field Shift — Climate-smart agriculture decision support. Independent Earth-observation guidance.'}
          </p>
          <div className="flex items-center gap-4 text-xs font-medium text-[#0B2A5B]">
            <button
              type="button"
              onClick={() => setActiveSection('capture')}
              className="hover:text-[#1769E0] cursor-pointer"
            >
              {isAr ? 'تسجيل المزرعة' : 'Workspace'}
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('sign_in')}
              className="hover:text-[#1769E0] cursor-pointer"
            >
              {isAr ? 'دخول' : 'Sign In'}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
