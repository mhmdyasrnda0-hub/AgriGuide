import React, { useEffect, useRef } from 'react';
import { AppSection, FieldShiftProvider, useFieldShift } from './context/FieldShiftContext';
import { LandingPage } from './components/LandingPage';
import { AppShell } from './components/AppShell';
import { FarmCaptureView } from './components/FarmCaptureView';
import { EarthIntelligenceView } from './components/EarthIntelligenceView';
import { AiFieldScanView } from './components/AiFieldScanView';
import { DecisionStudioView } from './components/DecisionStudioView';
import { ActionCenterView } from './components/ActionCenterView';
import { ReportsView } from './components/ReportsView';
import { SignInView } from './components/auth/SignInView';
import { SignUpView } from './components/auth/SignUpView';
import { ErrorBoundary } from './components/shared/ErrorBoundary';

function FieldShiftRouter() {
  const { activeSection, language } = useFieldShift();
  const scrollPositionsRef = useRef<Partial<Record<AppSection, number>>>({});
  const prevSectionRef = useRef<AppSection>(activeSection);

  useEffect(() => {
    const prev = prevSectionRef.current;
    if (prev !== activeSection) {
      scrollPositionsRef.current[prev] = window.scrollY;
      prevSectionRef.current = activeSection;
      const savedY = scrollPositionsRef.current[activeSection] ?? 0;
      window.scrollTo({ top: savedY, behavior: 'instant' as ScrollBehavior });
    }
  }, [activeSection]);

  if (activeSection === 'landing') {
    return (
      <ErrorBoundary resetKey="landing" language={language}>
        <div key="landing" className="fs-view-transition">
          <LandingPage />
        </div>
      </ErrorBoundary>
    );
  }

  if (activeSection === 'sign_in') {
    return (
      <ErrorBoundary resetKey="sign_in" language={language}>
        <div key="sign_in" className="fs-view-transition">
          <SignInView />
        </div>
      </ErrorBoundary>
    );
  }

  if (activeSection === 'sign_up') {
    return (
      <ErrorBoundary resetKey="sign_up" language={language}>
        <div key="sign_up" className="fs-view-transition">
          <SignUpView />
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <AppShell>
      <ErrorBoundary resetKey={activeSection} language={language}>
        <div key={activeSection} className="fs-view-transition">
          {activeSection === 'capture' && <FarmCaptureView />}
          {activeSection === 'scan' && <FarmCaptureView />}
          {activeSection === 'earth' && <EarthIntelligenceView />}
          {activeSection === 'decision' && <DecisionStudioView />}
          {activeSection === 'action' && <ActionCenterView />}
          {activeSection === 'reports' && <ReportsView />}
        </div>
      </ErrorBoundary>
    </AppShell>
  );
}

export default function App() {
  return (
    <FieldShiftProvider>
      <FieldShiftRouter />
    </FieldShiftProvider>
  );
}
