import React from 'react';
import { ArrowLeft, ArrowRight, Languages } from 'lucide-react';
import heroBg from '../../assets/images/hero_earth_sunrise_farm_1794576485346.jpg';
import { useFieldShift } from '../../context/FieldShiftContext';
import { t } from '../../i18n/translations';
import { BrandLogo } from '../BrandLogo';

interface AuthShellProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footerSlot?: React.ReactNode;
}

export function AuthShell({ title, subtitle, children, footerSlot }: AuthShellProps) {
  const { language, setLanguage, setActiveSection, clearAuthError } = useFieldShift();
  const isAr = language === 'ar';

  const handleBackLanding = () => {
    clearAuthError();
    setActiveSection('landing');
  };

  return (
    <div
      className="min-h-screen relative flex flex-col overflow-x-clip"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {/* Full-bleed space + earth + farmland background */}
      <div aria-hidden="true" className="fixed inset-0 z-0 pointer-events-none">
        <img
          src={heroBg}
          alt=""
          className="w-full h-full object-cover object-center scale-[1.04]"
          style={{ filter: 'brightness(0.78) saturate(1.1)' }}
        />
        {/* Deep space vignette overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#070c1a]/70 via-[#0a1628]/40 to-[#061a0a]/65" />
        {/* Subtle star-scatter shimmer at top */}
        <div
          className="absolute inset-x-0 top-0 h-48 opacity-60"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 70% 0%, rgba(140,180,255,0.18) 0%, transparent 70%)',
          }}
        />
      </div>

      {/* Top Brand Navigation Header */}
      <header className="relative z-20 w-full bg-white/10 backdrop-blur-md border-b border-white/15 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleBackLanding}
            className="flex items-center cursor-pointer rounded-xl focus-visible:outline-2 focus-visible:outline-white/60"
            aria-label={t(language, 'brand')}
          >
            {/* White version of logo for dark background */}
            <span className="inline-flex items-center gap-2.5">
              <BrandLogo variant="horizontal" size="sm" className="[&_span]:text-white [&_span]:opacity-95" />
            </span>
          </button>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={handleBackLanding}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium text-white/85 hover:text-white hover:bg-white/12 transition-colors duration-200 cursor-pointer"
            >
              {isAr ? <ArrowRight className="w-3.5 h-3.5" /> : <ArrowLeft className="w-3.5 h-3.5" />}
              <span>{isAr ? 'الصفحة الرئيسية' : 'Back to Home'}</span>
            </button>

            <button
              type="button"
              onClick={() => setLanguage(isAr ? 'en' : 'ar')}
              aria-label={isAr ? 'Switch to English' : 'التبديل إلى العربية'}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/25 bg-white/10 text-xs font-semibold text-white hover:bg-white/20 hover:border-white/40 transition-all duration-200 cursor-pointer"
            >
              <Languages className="w-3.5 h-3.5 text-white/80" />
              <span>{isAr ? 'EN' : 'عربي'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Centered Frosted Glass Auth Card */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-10 sm:py-14">
        <div className="w-full max-w-[420px] space-y-4 fs-scale-in">
          {/* Main glass card — matching the uploaded design */}
          <div
            className="rounded-3xl border border-white/22 shadow-[0_32px_80px_rgba(0,0,0,0.55),0_0_0_1px_rgba(255,255,255,0.08)] px-6 py-8 sm:px-8 sm:py-9"
            style={{
              background:
                'linear-gradient(145deg, rgba(15,30,65,0.72) 0%, rgba(10,22,50,0.80) 60%, rgba(5,18,40,0.88) 100%)',
              backdropFilter: 'blur(28px) saturate(1.5)',
              WebkitBackdropFilter: 'blur(28px) saturate(1.5)',
            }}
          >
            <div className={`text-center mb-6 ${isAr ? 'font-arabic' : ''}`}>
              <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-white">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-2 text-xs sm:text-sm text-white/70 leading-relaxed">
                  {subtitle}
                </p>
              )}
            </div>

            {children}
          </div>

          {/* Footer slot (links, secondary CTAs) */}
          {footerSlot && (
            <div className="fs-fade-in fs-stagger-2">
              {footerSlot}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
