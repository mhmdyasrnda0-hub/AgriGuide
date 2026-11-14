import React, { useEffect, useState } from 'react';
import { ArrowRight, Languages, Menu, X } from 'lucide-react';
import { useFieldShift } from '../../context/FieldShiftContext';
import { t } from '../../i18n/translations';
import { BrandLogo } from '../BrandLogo';

interface PublicNavbarProps {
  onJumpToSection: (sectionId: string) => void;
}

export function PublicNavbar({ onJumpToSection }: PublicNavbarProps) {
  const { language, setLanguage, setActiveSection, user } = useFieldShift();
  const isAr = language === 'ar';
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileMenuOpen]);

  const navLinks = isAr
    ? [
        { id: 'problem-section', label: 'التحديات' },
        { id: 'workflow-section', label: 'كيف يعمل' },
        { id: 'ai-scan-section', label: 'فحص الحقل' },
        { id: 'crops-section', label: 'المحاصيل' },
        { id: 'trust-section', label: 'البيانات والشفافية' },
      ]
    : [
        { id: 'problem-section', label: 'Challenges' },
        { id: 'workflow-section', label: 'How It Works' },
        { id: 'ai-scan-section', label: 'Field Scan' },
        { id: 'crops-section', label: 'Crops' },
        { id: 'trust-section', label: 'Earth Data' },
      ];

  const handleLinkClick = (id: string) => {
    setMobileMenuOpen(false);
    onJumpToSection(id);
  };

  return (
    <header
      dir={isAr ? 'rtl' : 'ltr'}
      className={`sticky top-0 z-40 w-full transition-all duration-300 border-b ${
        scrolled
          ? 'bg-white/96 backdrop-blur-md border-[#DCE7F5] shadow-xs'
          : 'bg-white/92 backdrop-blur-md border-[#DCE7F5]/60'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Official Field Shift Logo */}
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="flex items-center cursor-pointer rounded-xl focus-visible:outline-2 focus-visible:outline-[#1769E0]"
          aria-label={t(language, 'brand')}
        >
          <BrandLogo variant="horizontal" size="sm" />
        </button>

        {/* Center: Public Section Anchors */}
        <nav aria-label="Public landing navigation" className="hidden lg:flex items-center gap-6">
          {navLinks.map((link) => (
            <button
              key={link.id}
              type="button"
              onClick={() => handleLinkClick(link.id)}
              className="text-sm font-medium text-[#12233F] hover:text-[#1769E0] transition-colors cursor-pointer"
            >
              {link.label}
            </button>
          ))}
        </nav>

        {/* Right: Language + Auth + Primary CTA */}
        <div className="hidden md:flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setLanguage(isAr ? 'en' : 'ar')}
            aria-label={isAr ? 'Switch to English' : 'التبديل إلى العربية'}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#DCE7F5] bg-[#F7FAFE] text-xs font-semibold text-[#0B2A5B] hover:border-[#1769E0] transition-colors cursor-pointer"
          >
            <Languages className="w-3.5 h-3.5 text-[#1769E0]" />
            <span>{isAr ? 'EN' : 'عربي'}</span>
          </button>

          {user ? (
            <button
              type="button"
              onClick={() => setActiveSection('capture')}
              className="px-3.5 py-2 rounded-lg border border-[#DCE7F5] text-xs font-semibold text-[#0B2A5B] hover:bg-[#EAF3FF] transition-colors cursor-pointer"
            >
              {isAr ? 'لوحة المزرعة' : 'Workspace'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setActiveSection('sign_in')}
              className="px-3.5 py-2 rounded-lg text-xs font-semibold text-[#0B2A5B] hover:bg-[#EAF3FF] hover:text-[#1769E0] transition-colors cursor-pointer"
            >
              {isAr ? 'تسجيل الدخول' : 'Sign In'}
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveSection('capture')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#1769E0] hover:bg-[#0B2A5B] text-white text-xs sm:text-sm font-semibold shadow-sm transition-colors cursor-pointer"
          >
            <span>{isAr ? 'ابدأ الآن' : 'Get Started'}</span>
            <ArrowRight className={`w-3.5 h-3.5 ${isAr ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Mobile Controls */}
        <div className="flex md:hidden items-center gap-2">
          <button
            type="button"
            onClick={() => setLanguage(isAr ? 'en' : 'ar')}
            className="px-2.5 py-1.5 rounded-lg border border-[#DCE7F5] bg-[#F7FAFE] text-xs font-semibold text-[#0B2A5B] cursor-pointer"
          >
            {isAr ? 'EN' : 'عربي'}
          </button>
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? (isAr ? 'إغلاق القائمة' : 'Close menu') : isAr ? 'فتح القائمة' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
            className="p-2 rounded-xl border border-[#DCE7F5] text-[#0B2A5B] hover:bg-[#EAF3FF] cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[#DCE7F5] bg-white px-4 py-4 space-y-3 shadow-lg">
          <div className="space-y-1">
            {navLinks.map((link) => (
              <button
                key={link.id}
                type="button"
                onClick={() => handleLinkClick(link.id)}
                className="w-full text-start px-3 py-2.5 rounded-xl text-sm font-medium text-[#12233F] hover:bg-[#EAF3FF] hover:text-[#1769E0] cursor-pointer"
              >
                {link.label}
              </button>
            ))}
          </div>

          <div className="pt-3 border-t border-[#DCE7F5] grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                setActiveSection(user ? 'capture' : 'sign_in');
              }}
              className="py-2.5 px-3 rounded-xl border border-[#DCE7F5] text-xs font-semibold text-[#0B2A5B] hover:bg-[#EAF3FF] cursor-pointer"
            >
              {user ? (isAr ? 'لوحة المزرعة' : 'Workspace') : isAr ? 'تسجيل الدخول' : 'Sign In'}
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                setActiveSection('capture');
              }}
              className="py-2.5 px-3 rounded-xl bg-[#1769E0] text-white text-xs font-semibold cursor-pointer"
            >
              {t(language, 'scanYourFarm')}
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
