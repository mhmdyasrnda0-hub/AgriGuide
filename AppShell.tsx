import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  Compass,
  FileText,
  Globe2,
  Languages,
  LogIn,
  LogOut,
  MailCheck,
  MapPin,
  Menu,
  Pin,
  PinOff,
  Plus,
  ScanLine,
  Trash2,
  WifiOff,
  X,
} from 'lucide-react';
import { AppSection, useFieldShift } from '../context/FieldShiftContext';
import { t } from '../i18n/translations';
import { BrandLogo } from './BrandLogo';
import { AskMeWidget } from './AskMeWidget';

export function AppShell({ children }: { children: React.ReactNode }) {
  const {
    language,
    setLanguage,
    activeSection,
    setActiveSection,
    sidebarPinned,
    setSidebarPinned,
    user,
    authError,
    handleResendVerification,
    handleSignOut,
    farms,
    activeFarm,
    selectFarm,
    deleteAllUserData,
    envByFarm,
    gmpQuotaExceeded,
    isOnline,
  } = useFieldShift();

  const isAr = language === 'ar';
  const activeEnv = activeFarm ? envByFarm[activeFarm.id] : undefined;

  // Desktop hover / focus / select interaction state (collapsed by default unless pinned)
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const [sidebarFocused, setSidebarFocused] = useState(false);
  const [selectActive, setSelectActive] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [confirmPurge, setConfirmPurge] = useState(false);
  const [verificationSentNote, setVerificationSentNote] = useState(false);

  const enterTimerRef = useRef<number | null>(null);
  const leaveTimerRef = useRef<number | null>(null);
  const asideRef = useRef<HTMLElement | null>(null);
  const mobileMenuBtnRef = useRef<HTMLButtonElement | null>(null);

  const isDesktopExpanded = sidebarPinned || sidebarHovered || sidebarFocused || selectActive;

  useEffect(() => {
    return () => {
      if (enterTimerRef.current) window.clearTimeout(enterTimerRef.current);
      if (leaveTimerRef.current) window.clearTimeout(leaveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
        mobileMenuBtnRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileMenuOpen]);

  const handlePointerEnter = () => {
    if (leaveTimerRef.current) {
      window.clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
    if (isDesktopExpanded) return;
    enterTimerRef.current = window.setTimeout(() => {
      setSidebarHovered(true);
    }, 110);
  };

  const handlePointerLeave = () => {
    if (enterTimerRef.current) {
      window.clearTimeout(enterTimerRef.current);
      enterTimerRef.current = null;
    }
    leaveTimerRef.current = window.setTimeout(() => {
      setSidebarHovered(false);
    }, 180);
  };

  const handleAsideBlur = (e: React.FocusEvent<HTMLElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setSidebarFocused(false);
      setSelectActive(false);
    }
  };

  const primaryNav: Array<{
    id: AppSection;
    label: string;
    shortLabel: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'capture', label: t(language, 'navCapture'), shortLabel: isAr ? 'المزرعة' : 'Capture', icon: MapPin },
    { id: 'earth', label: t(language, 'navEarth'), shortLabel: isAr ? 'الأرض' : 'Earth', icon: Globe2 },
    { id: 'decision', label: t(language, 'navDecision'), shortLabel: isAr ? 'القرار' : 'Decide', icon: Compass },
    { id: 'action', label: t(language, 'navAction'), shortLabel: isAr ? 'الإجراء' : 'Action', icon: Activity },
  ];

  const secondaryNav: Array<{ id: AppSection; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'reports', label: t(language, 'navReports'), icon: FileText },
  ];

  const freshnessLabel = !activeFarm
    ? t(language, 'noFarmSelected')
    : !activeEnv
    ? t(language, 'noEnvData')
    : activeEnv.isStale
    ? t(language, 'staleData')
    : t(language, 'freshData');

  const navigateFromMobile = (sec: AppSection) => {
    setActiveSection(sec);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#F7FAFE] text-[#12233F] flex flex-col">
      {/* Required Google Maps Platform Demo Key Quota Banner */}
      {gmpQuotaExceeded && (
        <div
          role="alert"
          className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm"
        >
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {!isOnline && (
        <div
          role="status"
          className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2 text-xs flex items-center justify-center gap-2"
        >
          <WifiOff className="w-3.5 h-3.5" />
          <span>
            {isAr
              ? 'أنت غير متصل بالإنترنت حالياً — قد تكون بيانات ناسا وخدمات التحليل غير متاحة مؤقتاً.'
              : 'Offline mode detected — live NASA POWER and analysis requests require an internet connection.'}
          </span>
        </div>
      )}

      {user && !user.emailVerified && (
        <div
          role="status"
          className="bg-[#EAF3FF] border-b border-[#DCE7F5] text-[#0B2A5B] px-4 py-2 text-xs flex flex-wrap items-center justify-center gap-2.5"
        >
          <MailCheck className="w-4 h-4 text-[#1769E0] shrink-0" />
          <span>
            {isAr
              ? 'يرجى تأكيد بريدك الإلكتروني لتفعيل المزامنة السحابية لبيانات مزرعتك. يمكنك الاستمرار بالعمل محلياً الآن.'
              : 'Verify your email address to activate cloud Firestore sync across devices. Local workspace tools remain available now.'}
          </span>
          <button
            type="button"
            onClick={async () => {
              const ok = await handleResendVerification();
              if (ok) setVerificationSentNote(true);
            }}
            className="px-2.5 py-1 rounded-lg bg-[#1769E0] text-white font-semibold hover:bg-[#0B2A5B] transition-colors cursor-pointer"
          >
            {verificationSentNote
              ? isAr
                ? 'تم إرسال الرابط'
                : 'Verification Sent'
              : isAr
              ? 'إعادة إرسال رابط التأكيد'
              : 'Resend Verification Email'}
          </button>
        </div>
      )}

      <div className="flex-1 flex min-h-0 relative">
        {/* Desktop layout spacer: collapses to 68px when unpinned so content stays completely stable; expands to 244px on wide screens when pinned */}
        <div
          aria-hidden="true"
          className={`hidden md:block shrink-0 transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            sidebarPinned ? 'md:w-[68px] lg:w-[244px]' : 'w-[68px]'
          }`}
        />

        {/* Controlled backdrop for medium screens (or unpinned overlay click-outside) when sidebar is expanded */}
        {isDesktopExpanded && (
          <div
            aria-hidden="true"
            onClick={() => {
              setSidebarHovered(false);
              setSidebarFocused(false);
              setSelectActive(false);
              if (sidebarPinned) setSidebarPinned(false);
            }}
            className={`hidden md:block fixed inset-0 z-30 bg-[#0B2A5B]/15 fs-fade-in ${
              sidebarPinned ? 'lg:hidden' : 'lg:bg-transparent lg:pointer-events-none'
            }`}
          />
        )}

        {/* Desktop Sidebar: starts collapsed by default, smooth hover/focus expansion, pin control, full RTL/LTR support */}
        <aside
          ref={asideRef}
          aria-label="Workspace navigation"
          onPointerEnter={handlePointerEnter}
          onPointerLeave={handlePointerLeave}
          onFocus={() => setSidebarFocused(true)}
          onBlur={handleAsideBlur}
          className={`hidden md:flex flex-col fixed inset-y-0 start-0 z-40 bg-white border-e border-[#DCE7F5] transition-[width,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isDesktopExpanded ? 'w-[244px] shadow-xl lg:shadow-sm' : 'w-[68px]'
          }`}
        >
          {/* Brand Header & Pin Toggle */}
          <div
            className={`h-16 border-b border-[#DCE7F5] flex items-center shrink-0 ${
              isDesktopExpanded ? 'px-4 justify-between gap-2' : 'px-0 justify-center'
            }`}
          >
            <button
              type="button"
              onClick={() => setActiveSection('landing')}
              className={`flex items-center cursor-pointer rounded-xl focus-visible:outline-2 focus-visible:outline-[#1769E0] ${
                isDesktopExpanded ? 'gap-2 text-start p-1' : 'justify-center p-0 w-10 h-10'
              }`}
              aria-label={t(language, 'brand')}
              title={t(language, 'brand')}
            >
              <BrandLogo
                variant={isDesktopExpanded ? 'horizontal' : 'mark'}
                size="sm"
              />
            </button>

            {isDesktopExpanded && (
              <button
                type="button"
                onClick={() => setSidebarPinned(!sidebarPinned)}
                aria-pressed={sidebarPinned}
                aria-label={sidebarPinned ? t(language, 'unpinSidebar') : t(language, 'pinSidebar')}
                title={sidebarPinned ? t(language, 'unpinSidebar') : t(language, 'pinSidebar')}
                className={`p-1.5 rounded-lg transition-all duration-200 cursor-pointer shrink-0 focus-visible:outline-2 focus-visible:outline-[#1769E0] ${
                  sidebarPinned
                    ? 'bg-[#EAF3FF] text-[#1769E0]'
                    : 'text-[#66758A] hover:bg-[#F7FAFE] hover:text-[#1769E0]'
                }`}
              >
                {sidebarPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
              </button>
            )}
          </div>

          {/* Farm Selector (visible when expanded) */}
          <div
            className={`overflow-hidden transition-[max-height,opacity] duration-250 ease-[cubic-bezier(0.16,1,0.3,1)] border-b border-[#DCE7F5] ${
              isDesktopExpanded ? 'max-h-44 opacity-100' : 'max-h-0 opacity-0 border-b-0'
            }`}
          >
            <div className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="farm-selector" className="text-xs font-semibold text-[#66758A]">
                  {t(language, 'selectFarm')}
                </label>
                <button
                  type="button"
                  onClick={() => setActiveSection('capture')}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#1769E0] hover:underline cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isAr ? 'جديد' : 'New'}</span>
                </button>
              </div>
              {farms.length > 0 ? (
                <select
                  id="farm-selector"
                  value={activeFarm?.id || ''}
                  onFocus={() => setSelectActive(true)}
                  onBlur={() => setSelectActive(false)}
                  onChange={(e) => {
                    selectFarm(e.target.value);
                    setSelectActive(false);
                  }}
                  className="w-full rounded-lg border border-[#DCE7F5] bg-[#F7FAFE] px-2.5 py-2 text-xs font-semibold text-[#12233F] focus:outline-none focus:border-[#1769E0]"
                >
                  {farms.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              ) : (
                <button
                  type="button"
                  onClick={() => setActiveSection('capture')}
                  className="w-full rounded-lg border border-dashed border-[#1769E0]/50 bg-[#EAF3FF]/50 px-3 py-2 text-xs font-semibold text-[#1769E0] text-start hover:bg-[#EAF3FF] cursor-pointer"
                >
                  + {t(language, 'scanYourFarm')}
                </button>
              )}

              <div className="flex items-center justify-between text-[11px] text-[#66758A] pt-1">
                <span>{freshnessLabel}</span>
                {activeEnv && (
                  <span className="font-mono tabular-nums">{activeEnv.dataDateRange.end}</span>
                )}
              </div>
            </div>
          </div>

          {/* Primary Modules + Reports (NO Settings link) */}
          <nav className="flex-1 p-2.5 space-y-1 overflow-y-auto overflow-x-hidden" aria-label="Main modules">
            {[...primaryNav, ...secondaryNav].map((item, idx) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              const isSecondaryStart = idx === primaryNav.length;
              return (
                <React.Fragment key={item.id}>
                  {isSecondaryStart && <div className="my-2.5 border-t border-[#DCE7F5]" />}
                  <div className="relative group">
                    <button
                      type="button"
                      onClick={() => setActiveSection(item.id)}
                      aria-label={item.label}
                      aria-current={isActive ? 'page' : undefined}
                      className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#1769E0] ${
                        isDesktopExpanded ? 'justify-start' : 'justify-center'
                      } ${
                        isActive
                          ? 'bg-[#EAF3FF] text-[#1769E0] font-semibold'
                          : 'text-[#12233F] hover:bg-[#F7FAFE] hover:text-[#1769E0]'
                      }`}
                    >
                      {isActive && (
                        <span
                          aria-hidden="true"
                          className="absolute inset-y-2 start-0 w-1 rounded-e-full bg-[#1769E0] transition-all duration-200"
                        />
                      )}
                      <Icon className="w-[18px] h-[18px] shrink-0" />
                      <span
                        className={`truncate transition-opacity duration-200 ${
                          isDesktopExpanded ? 'opacity-100' : 'opacity-0 hidden'
                        }`}
                      >
                        {item.label}
                      </span>
                    </button>

                    {/* Accessible Tooltip when Sidebar is Collapsed */}
                    {!isDesktopExpanded && (
                      <div
                        role="tooltip"
                        className="pointer-events-none opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150 absolute top-1/2 -translate-y-1/2 start-full ms-2.5 z-50 px-2.5 py-1.5 rounded-lg bg-[#0B2A5B] text-white text-xs font-medium whitespace-nowrap shadow-md"
                      >
                        {item.label}
                      </div>
                    )}
                  </div>
                </React.Fragment>
              );
            })}
          </nav>

          {/* Footer Utilities: Language Switcher & Account Area (replaces Settings account/delete controls) */}
          <div className="p-2.5 border-t border-[#DCE7F5] space-y-2 shrink-0">
            <div className="relative group">
              <button
                type="button"
                onClick={() => setLanguage(isAr ? 'en' : 'ar')}
                aria-label={isAr ? 'Switch to English' : 'التبديل إلى العربية'}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-[#12233F] hover:bg-[#F7FAFE] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#1769E0] ${
                  isDesktopExpanded ? 'justify-start' : 'justify-center'
                }`}
              >
                <Languages className="w-4 h-4 text-[#1769E0] shrink-0" />
                {isDesktopExpanded && <span className="truncate">{t(language, 'languageLabel')}</span>}
              </button>
              {!isDesktopExpanded && (
                <div
                  role="tooltip"
                  className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute top-1/2 -translate-y-1/2 start-full ms-2.5 z-50 px-2.5 py-1.5 rounded-lg bg-[#0B2A5B] text-white text-xs font-medium whitespace-nowrap shadow-md"
                >
                  {t(language, 'languageLabel')}
                </div>
              )}
            </div>

            {user ? (
              <div className="rounded-xl bg-[#F7FAFE] border border-[#DCE7F5] p-2 space-y-2">
                <div className={`flex items-center gap-2 ${isDesktopExpanded ? 'justify-between' : 'justify-center'}`}>
                  {isDesktopExpanded && (
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#12233F] truncate">
                        {user.displayName || user.email}
                      </p>
                      <p className="text-[11px] text-[#66758A] truncate">
                        {isAr ? 'متصل بسحابة المزرعة' : 'Synced to Firestore'}
                      </p>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleSignOut}
                    aria-label={t(language, 'signOut')}
                    title={t(language, 'signOut')}
                    className="p-1.5 rounded-lg text-[#66758A] hover:text-[#E45C67] hover:bg-white cursor-pointer shrink-0 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>

                {isDesktopExpanded && farms.length > 0 && (
                  <div className="pt-1.5 border-t border-[#DCE7F5]">
                    {!confirmPurge ? (
                      <button
                        type="button"
                        onClick={() => setConfirmPurge(true)}
                        className="w-full flex items-center gap-1.5 text-[11px] font-medium text-[#66758A] hover:text-[#E45C67] cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>{isAr ? 'حذف كل مزارعي المحفوظة' : 'Clear Saved Farm Data'}</span>
                      </button>
                    ) : (
                      <div className="space-y-1.5 text-[11px]">
                        <p className="font-semibold text-[#E45C67]">
                          {isAr ? 'تأكيد حذف جميع المزارع؟' : 'Delete all farms permanently?'}
                        </p>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={async () => {
                              await deleteAllUserData();
                              setConfirmPurge(false);
                            }}
                            className="px-2 py-1 rounded-md bg-[#E45C67] text-white font-semibold cursor-pointer"
                          >
                            {isAr ? 'نعم' : 'Confirm'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmPurge(false)}
                            className="px-2 py-1 rounded-md bg-white border border-[#DCE7F5] text-[#66758A] cursor-pointer"
                          >
                            {isAr ? 'إلغاء' : 'Cancel'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setActiveSection('sign_in')}
                title={isAr ? 'تسجيل الدخول / المزامنة' : 'Sign In / Sync'}
                className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-[#0B2A5B] text-white text-xs font-semibold hover:bg-[#1769E0] transition-colors cursor-pointer ${
                  isDesktopExpanded ? '' : 'px-0'
                }`}
              >
                <LogIn className="w-3.5 h-3.5 shrink-0" />
                {isDesktopExpanded && <span>{isAr ? 'تسجيل الدخول' : 'Sign In'}</span>}
              </button>
            )}

            {authError && isDesktopExpanded && (
              <p className="text-[11px] text-[#E45C67] px-1">{authError}</p>
            )}
          </div>
        </aside>

        {/* Main Column + Mobile Header + Mobile Slide-Out Drawer */}
        <div className="flex-1 flex flex-col min-w-0">
          <header className="md:hidden sticky top-0 z-30 bg-white border-b border-[#DCE7F5] px-3.5 h-14 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                ref={mobileMenuBtnRef}
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label={isAr ? 'فتح القائمة' : 'Open navigation menu'}
                className="min-w-[44px] min-h-[44px] -ms-1.5 flex items-center justify-center rounded-xl text-[#0B2A5B] hover:bg-[#EAF3FF] cursor-pointer"
              >
                <Menu className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => setActiveSection('landing')}
                aria-label={t(language, 'brand')}
                className="flex items-center cursor-pointer"
              >
                <BrandLogo variant="horizontal" size="xs" />
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setLanguage(isAr ? 'en' : 'ar')}
                className="min-h-[38px] px-2.5 py-1.5 rounded-lg border border-[#DCE7F5] text-xs font-medium text-[#12233F] cursor-pointer"
              >
                {isAr ? 'EN' : 'عربي'}
              </button>
              <button
                type="button"
                onClick={() => setActiveSection('capture')}
                className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#1769E0] text-white text-xs font-semibold whitespace-nowrap cursor-pointer"
              >
                {t(language, 'scanYourFarm')}
              </button>
            </div>
          </header>

          {/* Mobile Slide-Out Navigation Drawer (Touch-friendly, closes after route pick) */}
          {mobileMenuOpen && (
            <div
              className="md:hidden fixed inset-0 z-50 bg-[#0B2A5B]/35 flex justify-start fs-fade-in"
              role="dialog"
              aria-modal="true"
              aria-label="Mobile navigation drawer"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setMobileMenuOpen(false);
                  mobileMenuBtnRef.current?.focus();
                }
              }}
            >
              <div className="bg-white w-[82%] max-w-[310px] h-full flex flex-col border-e border-[#DCE7F5] shadow-2xl fs-drawer-start">
                <div className="h-14 px-4 border-b border-[#DCE7F5] flex items-center justify-between">
                  <BrandLogo variant="horizontal" size="sm" />
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      mobileMenuBtnRef.current?.focus();
                    }}
                    aria-label={isAr ? 'إغلاق القائمة' : 'Close menu'}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-[#66758A] hover:bg-[#EAF3FF] cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Farm selector */}
                <div className="p-4 border-b border-[#DCE7F5] space-y-2">
                  <label htmlFor="mobile-farm-select" className="block text-xs font-semibold text-[#66758A]">
                    {t(language, 'selectFarm')}
                  </label>
                  {farms.length > 0 ? (
                    <select
                      id="mobile-farm-select"
                      value={activeFarm?.id || ''}
                      onChange={(e) => selectFarm(e.target.value)}
                      className="w-full rounded-xl border border-[#DCE7F5] bg-[#F7FAFE] px-3 py-2.5 text-xs font-semibold text-[#12233F]"
                    >
                      {farms.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-xs text-[#66758A]">{t(language, 'noFarmSelected')}</p>
                  )}
                  <p className="text-[11px] text-[#66758A]">{freshnessLabel}</p>
                </div>

                {/* All Workspace Routes */}
                <nav className="flex-1 p-3 space-y-1 overflow-y-auto" aria-label="Mobile drawer modules">
                  {[...primaryNav, ...secondaryNav].map((item) => {
                    const Icon = item.icon;
                    const isActive = activeSection === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => navigateFromMobile(item.id)}
                        aria-current={isActive ? 'page' : undefined}
                        className={`w-full min-h-[44px] flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium cursor-pointer ${
                          isActive
                            ? 'bg-[#EAF3FF] text-[#1769E0] font-semibold'
                            : 'text-[#12233F] hover:bg-[#F7FAFE]'
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </nav>

                {/* Mobile Drawer Account Footer */}
                <div className="p-4 border-t border-[#DCE7F5] space-y-2.5">
                  {user ? (
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#12233F] truncate">
                          {user.displayName || user.email}
                        </p>
                        <p className="text-[11px] text-[#66758A]">
                          {isAr ? 'متصل بسحابة المزرعة' : 'Synced to Firestore'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="px-3 py-2 rounded-lg border border-[#DCE7F5] text-xs font-semibold text-[#E45C67] cursor-pointer"
                      >
                        {t(language, 'signOut')}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => navigateFromMobile('sign_in')}
                      className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-[#0B2A5B] text-white text-xs font-semibold cursor-pointer"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>{isAr ? 'تسجيل الدخول / إنشاء حساب' : 'Sign In / Create Account'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Main Workspace Viewport */}
          <main className="flex-1 p-4 sm:p-6 md:px-10 lg:px-12 pb-32 md:pb-24 max-w-5xl w-full mx-auto">
            {children}
          </main>

          {/* Compact Touch-Friendly Mobile Bottom Navigation */}
          <nav
            aria-label="Mobile navigation"
            className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-[#DCE7F5] flex items-center justify-around h-16 px-1"
          >
            {primaryNav.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveSection(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex flex-col items-center justify-center gap-1 px-2 py-1 rounded-xl min-w-[56px] min-h-[44px] text-[11px] font-medium transition-colors cursor-pointer ${
                    isActive ? 'text-[#1769E0] bg-[#EAF3FF]/60 font-semibold' : 'text-[#66758A]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.shortLabel}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Workspace-only AI Copilot Drawer */}
      <AskMeWidget />
    </div>
  );
}
