import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  auth,
  collection,
  db,
  deleteDoc,
  doc,
  getDocs,
  handleFirestoreError,
  limit,
  mapFirebaseAuthError,
  OperationType,
  orderBy,
  query,
  resendVerificationEmail,
  sendPasswordReset,
  serverTimestamp,
  setDoc,
  signInWithEmail,
  signInWithGoogle,
  signOutUser,
  signUpWithEmail,
  testFirestoreConnection,
} from '../firebase';
import {
  ChatMessage,
  DecisionRun,
  DecisionWeights,
  EnvironmentalSnapshot,
  FarmProfile,
  FarmReport,
  FieldScanResult,
  Language,
  ScenarioInput,
} from '../types/fieldshift';
import { DEFAULT_DECISION_WEIGHTS, evaluateCrops } from '../lib/decisionEngine';
import { normalizeFarmProfile } from '../lib/validators';
import { fetchEarthSnapshot } from '../services/earthService';

export type AppSection =
  | 'landing'
  | 'sign_in'
  | 'sign_up'
  | 'capture'
  | 'earth'
  | 'scan'
  | 'decision'
  | 'action'
  | 'reports';

export type DecisionSubTab = 'suitability' | 'rotation';

const SECTION_PATHS: Record<AppSection, string> = {
  landing: '/',
  sign_in: '/sign-in',
  sign_up: '/sign-up',
  capture: '/app/capture',
  earth: '/app/earth',
  scan: '/app/scan',
  decision: '/app/decision',
  action: '/app/action',
  reports: '/app/reports',
};

function resolveInitialSectionFromLocation(): AppSection {
  if (typeof window === 'undefined') return 'landing';
  const params = new URLSearchParams(window.location.search);
  if (params.get('autostart') === '1') return 'capture';

  const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
  switch (pathname) {
    case '/sign-in':
      return 'sign_in';
    case '/sign-up':
      return 'sign_up';
    case '/app':
    case '/app/capture':
      return 'capture';
    case '/app/earth':
      return 'earth';
    case '/app/scan':
      return 'scan';
    case '/app/decision':
      return 'decision';
    case '/app/action':
      return 'action';
    case '/app/reports':
      return 'reports';
    default:
      return 'landing';
  }
}

interface FieldShiftContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  activeSection: AppSection;
  setActiveSection: (s: AppSection) => void;
  sidebarPinned: boolean;
  setSidebarPinned: (v: boolean) => void;
  decisionSubTab: DecisionSubTab;
  setDecisionSubTab: (tab: DecisionSubTab) => void;
  askMeOpen: boolean;
  setAskMeOpen: (open: boolean) => void;
  askMeDraftByFarm: Record<string, string>;
  setAskMeDraft: (key: string, val: string) => void;
  aiAvailable: boolean | null;
  user: User | null;
  authReady: boolean;
  authError: string | null;
  clearAuthError: () => void;
  handleGoogleSignIn: (redirectTo?: AppSection) => Promise<boolean>;
  handleEmailSignIn: (email: string, password: string) => Promise<boolean>;
  handleEmailSignUp: (
    firstName: string,
    lastName: string,
    email: string,
    password: string
  ) => Promise<boolean>;
  handlePasswordReset: (email: string) => Promise<boolean>;
  handleResendVerification: () => Promise<boolean>;
  handleSignOut: () => Promise<void>;
  mapsApiKey: string;
  gmpQuotaExceeded: boolean;
  farms: FarmProfile[];
  activeFarmId: string | null;
  activeFarm: FarmProfile | null;
  selectFarm: (farmId: string) => void;
  saveFarm: (farm: FarmProfile) => Promise<void>;
  deleteFarm: (farmId: string) => Promise<void>;
  deleteAllUserData: () => Promise<void>;
  envByFarm: Record<string, EnvironmentalSnapshot>;
  envLoading: boolean;
  envError: string | null;
  fetchEarthIntelligence: (farm: FarmProfile) => Promise<EnvironmentalSnapshot | null>;
  scansByFarm: Record<string, FieldScanResult[]>;
  addFieldScan: (scan: FieldScanResult) => Promise<void>;
  deleteFieldScan: (farmId: string, scanId: string) => Promise<void>;
  weights: DecisionWeights;
  setWeights: (w: DecisionWeights) => void;
  activeDecision: DecisionRun | null;
  reportsByFarm: Record<string, FarmReport[]>;
  saveReport: (report: FarmReport) => Promise<void>;
  scenario: ScenarioInput;
  setScenario: (s: ScenarioInput) => void;
  chatMessagesByFarm: Record<string, ChatMessage[]>;
  appendChatMessage: (farmId: string, msg: ChatMessage) => void;
  clearChatHistory: (farmId: string) => void;
  isOnline: boolean;
}

const FieldShiftContext = createContext<FieldShiftContextValue | null>(null);

const DEFAULT_SCENARIO: ScenarioInput = {
  tempDeltaC: 0,
  waterAvailabilityPct: 100,
  rainfallDeltaPct: 0,
  soilMoistureScenario: 'baseline',
};

export function FieldShiftProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');
  const [activeSection, setActiveSectionState] = useState<AppSection>(() =>
    resolveInitialSectionFromLocation()
  );
  const [sidebarPinned, setSidebarPinnedState] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.sessionStorage.getItem('fs_sidebar_pinned') === '1';
    }
    return false;
  });
  const setSidebarPinned = useCallback((v: boolean) => {
    setSidebarPinnedState(v);
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('fs_sidebar_pinned', v ? '1' : '0');
    }
  }, []);

  const setActiveSection = useCallback((nextSection: AppSection) => {
    setActiveSectionState(nextSection);
    if (typeof window !== 'undefined') {
      const targetPath = SECTION_PATHS[nextSection] || '/';
      if (window.location.pathname !== targetPath) {
        window.history.pushState({ section: nextSection }, '', targetPath);
      }
    }
  }, []);

  useEffect(() => {
    const onPopState = () => {
      setActiveSectionState(resolveInitialSectionFromLocation());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const [decisionSubTab, setDecisionSubTab] = useState<DecisionSubTab>('suitability');
  const [askMeOpen, setAskMeOpen] = useState(false);
  const [askMeDraftByFarm, setAskMeDraftByFarm] = useState<Record<string, string>>({});
  const setAskMeDraft = useCallback((key: string, val: string) => {
    setAskMeDraftByFarm((prev) => ({ ...prev, [key]: val }));
  }, []);
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);

  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const [mapsApiKey, setMapsApiKey] = useState<string>(
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
  );
  const [gmpQuotaExceeded, setGmpQuotaExceeded] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  // Real user-captured farms ONLY — zero fake preloaded farms
  const [farms, setFarms] = useState<FarmProfile[]>([]);
  const [activeFarmId, setActiveFarmId] = useState<string | null>(null);
  const [envByFarm, setEnvByFarm] = useState<Record<string, EnvironmentalSnapshot>>({});
  const [envLoading, setEnvLoading] = useState(false);
  const [envError, setEnvError] = useState<string | null>(null);

  const [scansByFarm, setScansByFarm] = useState<Record<string, FieldScanResult[]>>({});
  const [reportsByFarm, setReportsByFarm] = useState<Record<string, FarmReport[]>>({});
  const [weights, setWeights] = useState<DecisionWeights>(DEFAULT_DECISION_WEIGHTS);
  const [scenario, setScenario] = useState<ScenarioInput>(DEFAULT_SCENARIO);
  const [chatMessagesByFarm, setChatMessagesByFarm] = useState<Record<string, ChatMessage[]>>({});

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  }, [language]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
  }, []);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    const onQuota = () => setGmpQuotaExceeded(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('gmp-quota-exceeded', onQuota);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('gmp-quota-exceeded', onQuota);
    };
  }, []);

  useEffect(() => {
    if (!mapsApiKey) {
      fetch('/api/maps-config')
        .then((r) => r.json())
        .then((d) => {
          if (d.apiKey) setMapsApiKey(d.apiKey);
        })
        .catch(() => {});
    }
    fetch('/api/health')
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.aiConfigured === 'boolean') {
          setAiAvailable(d.aiConfigured);
        }
      })
      .catch(() => setAiAvailable(false));
  }, [mapsApiKey]);

  useEffect(() => {
    testFirestoreConnection();
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setUser(fbUser);
      setAuthReady(true);

      if (fbUser && fbUser.emailVerified) {
        try {
          await setDoc(
            doc(db, 'users', fbUser.uid),
            {
              uid: fbUser.uid,
              displayName: (fbUser.displayName || 'Farmer').slice(0, 120),
              preferredLanguage: language,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          ).catch(() => {});

          const farmsPath = `users/${fbUser.uid}/farms`;
          const snap = await getDocs(
            query(collection(db, 'users', fbUser.uid, 'farms'), orderBy('updatedAt', 'desc'), limit(20))
          );
          const loadedFarms: FarmProfile[] = [];
          snap.forEach((docSnap) => {
            const d = docSnap.data();
            loadedFarms.push(
              normalizeFarmProfile({
                id: d.id,
                ownerId: d.ownerId,
                name: d.name,
                locationLabel: d.locationLabel || '',
                centerLat: d.centerLat,
                centerLng: d.centerLng,
                locationAccuracyMode: d.locationAccuracyMode,
                boundary: d.boundary,
                areaHectares: d.areaHectares,
                previousCrop: d.previousCrop || 'unknown',
                currentCrop: d.currentCrop || 'unknown',
                season: d.season,
                waterAvailability: d.waterAvailability,
                goal: d.goal,
                soilData: d.soilData,
                createdAt: d.createdAt?.toDate ? d.createdAt.toDate().toISOString() : new Date().toISOString(),
                updatedAt: d.updatedAt?.toDate ? d.updatedAt.toDate().toISOString() : new Date().toISOString(),
              })
            );
          });
          if (loadedFarms.length > 0) {
            setFarms(loadedFarms);
            setActiveFarmId((prev) => prev || loadedFarms[0].id);

            const firstId = loadedFarms[0].id;
            try {
              const envSnap = await getDocs(
                query(
                  collection(db, `${farmsPath}/${firstId}/environmentalRecords`),
                  orderBy('createdAt', 'desc'),
                  limit(1)
                )
              );
              envSnap.forEach((es) => {
                const payload = es.data().payload as EnvironmentalSnapshot;
                if (payload) {
                  setEnvByFarm((prev) => ({ ...prev, [firstId]: payload }));
                }
              });
              const scanSnap = await getDocs(
                query(collection(db, `${farmsPath}/${firstId}/scans`), orderBy('createdAt', 'desc'), limit(10))
              );
              const loadedScans: FieldScanResult[] = [];
              scanSnap.forEach((ss) => {
                const payload = ss.data().resultPayload as FieldScanResult;
                if (payload) loadedScans.push(payload);
              });
              if (loadedScans.length > 0) {
                setScansByFarm((prev) => ({ ...prev, [firstId]: loadedScans }));
              }
            } catch {
              // Optional subcollection load
            }
          }
        } catch (err) {
          console.warn('Firestore initial load notice:', err);
        }
      }
    });
    return () => unsub();
  }, []);

  const handleGoogleSignIn = useCallback(
    async (redirectTo?: AppSection): Promise<boolean> => {
      setAuthError(null);
      try {
        await signInWithGoogle();
        if (redirectTo) setActiveSection(redirectTo);
        return true;
      } catch (err) {
        setAuthError(mapFirebaseAuthError(err, language));
        return false;
      }
    },
    [language, setActiveSection]
  );

  const handleEmailSignIn = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      setAuthError(null);
      try {
        await signInWithEmail(email, password);
        setActiveSection('capture');
        return true;
      } catch (err) {
        setAuthError(mapFirebaseAuthError(err, language));
        return false;
      }
    },
    [language, setActiveSection]
  );

  const handleEmailSignUp = useCallback(
    async (
      firstName: string,
      lastName: string,
      email: string,
      password: string
    ): Promise<boolean> => {
      setAuthError(null);
      try {
        await signUpWithEmail(firstName, lastName, email, password);
        setActiveSection('capture');
        return true;
      } catch (err) {
        setAuthError(mapFirebaseAuthError(err, language));
        return false;
      }
    },
    [language, setActiveSection]
  );

  const handlePasswordReset = useCallback(
    async (email: string): Promise<boolean> => {
      setAuthError(null);
      try {
        await sendPasswordReset(email);
        return true;
      } catch (err) {
        setAuthError(mapFirebaseAuthError(err, language));
        return false;
      }
    },
    [language]
  );

  const handleResendVerification = useCallback(async (): Promise<boolean> => {
    setAuthError(null);
    try {
      await resendVerificationEmail();
      return true;
    } catch (err) {
      setAuthError(mapFirebaseAuthError(err, language));
      return false;
    }
  }, [language]);

  const handleSignOut = useCallback(async () => {
    await signOutUser();
    setAskMeOpen(false);
    setActiveSection('landing');
  }, [setActiveSection]);

  const activeFarm = useMemo(
    () => farms.find((f) => f.id === activeFarmId) || null,
    [farms, activeFarmId]
  );

  const selectFarm = useCallback((farmId: string) => {
    setActiveFarmId(farmId);
  }, []);

  const fetchEarthIntelligence = useCallback(
    async (farm: FarmProfile): Promise<EnvironmentalSnapshot | null> => {
      setEnvLoading(true);
      setEnvError(null);
      try {
        const snapshot = await fetchEarthSnapshot(farm);
        setEnvByFarm((prev) => ({ ...prev, [farm.id]: snapshot }));

        if (user && user.emailVerified) {
          const recId = snapshot.id.replace(/[^a-zA-Z0-9_-]/g, '_');
          const path = `users/${user.uid}/farms/${farm.id}/environmentalRecords/${recId}`;
          try {
            await setDoc(doc(db, 'users', user.uid, 'farms', farm.id, 'environmentalRecords', recId), {
              id: recId,
              ownerId: user.uid,
              farmId: farm.id,
              fetchedAt: snapshot.fetchedAt,
              sourceSummary: snapshot.sourceAttribution.join(' · ').slice(0, 240),
              payload: snapshot,
              createdAt: serverTimestamp(),
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, path);
          }
        }
        return snapshot;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to reach Earth-observation services.';
        setEnvError(msg);
        return null;
      } finally {
        setEnvLoading(false);
      }
    },
    [user]
  );

  const saveFarm = useCallback(
    async (farm: FarmProfile) => {
      const normalized = normalizeFarmProfile({
        ...farm,
        ownerId: user?.uid,
      });

      setFarms((prev) => {
        const exists = prev.some((f) => f.id === normalized.id);
        return exists ? prev.map((f) => (f.id === normalized.id ? normalized : f)) : [normalized, ...prev];
      });
      setActiveFarmId(normalized.id);

      if (user && user.emailVerified) {
        const path = `users/${user.uid}/farms/${normalized.id}`;
        try {
          const existsInState = farms.some((f) => f.id === normalized.id);
          const payload: Record<string, unknown> = {
            id: normalized.id,
            ownerId: user.uid,
            name: normalized.name,
            locationLabel: normalized.locationLabel,
            centerLat: normalized.centerLat,
            centerLng: normalized.centerLng,
            locationAccuracyMode: normalized.locationAccuracyMode,
            previousCrop: normalized.previousCrop,
            currentCrop: normalized.currentCrop,
            season: normalized.season,
            waterAvailability: normalized.waterAvailability,
            goal: normalized.goal,
            updatedAt: serverTimestamp(),
          };
          if (normalized.boundary && normalized.boundary.length > 0) {
            payload.boundary = normalized.boundary.slice(0, 50);
          }
          if (typeof normalized.areaHectares === 'number') {
            payload.areaHectares = normalized.areaHectares;
          }
          if (normalized.soilData) {
            payload.soilData = normalized.soilData;
          }
          if (!existsInState) {
            payload.createdAt = serverTimestamp();
          }
          await setDoc(doc(db, 'users', user.uid, 'farms', normalized.id), payload, {
            merge: existsInState,
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, path);
        }
      }

      // Automatically fetch fresh NASA climate observation for this specific parcel
      fetchEarthIntelligence(normalized).catch(() => {});
    },
    [user, farms, fetchEarthIntelligence]
  );

  const deleteFarm = useCallback(
    async (farmId: string) => {
      setFarms((prev) => {
        const next = prev.filter((f) => f.id !== farmId);
        if (activeFarmId === farmId) {
          setActiveFarmId(next[0]?.id ?? null);
        }
        return next;
      });
      if (user && user.emailVerified) {
        const path = `users/${user.uid}/farms/${farmId}`;
        try {
          await deleteDoc(doc(db, 'users', user.uid, 'farms', farmId));
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, path);
        }
      }
    },
    [user, activeFarmId]
  );

  const addFieldScan = useCallback(
    async (scan: FieldScanResult) => {
      const cleanScanId = scan.id.replace(/[^a-zA-Z0-9_-]/g, '_');
      const normalized = { ...scan, id: cleanScanId };
      setScansByFarm((prev) => ({
        ...prev,
        [scan.farmId]: [normalized, ...(prev[scan.farmId] || [])],
      }));

      if (user && user.emailVerified) {
        const path = `users/${user.uid}/farms/${scan.farmId}/scans/${cleanScanId}`;
        try {
          const { imagePreviewDataUrl: _omit, ...storablePayload } = normalized;
          await setDoc(doc(db, 'users', user.uid, 'farms', scan.farmId, 'scans', cleanScanId), {
            id: cleanScanId,
            ownerId: user.uid,
            farmId: scan.farmId,
            scanType: scan.scanType,
            qualityStatus: scan.qualityStatus,
            detectedCrop: scan.detectedCrop.slice(0, 80),
            resultPayload: storablePayload,
            createdAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, path);
        }
      }
    },
    [user]
  );

  const deleteFieldScan = useCallback(
    async (farmId: string, scanId: string) => {
      setScansByFarm((prev) => ({
        ...prev,
        [farmId]: (prev[farmId] || []).filter((s) => s.id !== scanId),
      }));
      if (user && user.emailVerified) {
        const path = `users/${user.uid}/farms/${farmId}/scans/${scanId}`;
        try {
          await deleteDoc(doc(db, 'users', user.uid, 'farms', farmId, 'scans', scanId));
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, path);
        }
      }
    },
    [user]
  );

  const saveReport = useCallback(
    async (report: FarmReport) => {
      const cleanId = report.id.replace(/[^a-zA-Z0-9_-]/g, '_');
      const normalized = { ...report, id: cleanId };
      setReportsByFarm((prev) => ({
        ...prev,
        [report.farmId]: [normalized, ...(prev[report.farmId] || [])],
      }));

      if (user && user.emailVerified) {
        const path = `users/${user.uid}/farms/${report.farmId}/reports/${cleanId}`;
        try {
          await setDoc(doc(db, 'users', user.uid, 'farms', report.farmId, 'reports', cleanId), {
            id: cleanId,
            ownerId: user.uid,
            farmId: report.farmId,
            mode: report.mode,
            reportPayload: normalized,
            createdAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, path);
        }
      }
    },
    [user]
  );

  const deleteAllUserData = useCallback(async () => {
    const farmIds = farms.map((f) => f.id);
    setFarms([]);
    setActiveFarmId(null);
    setEnvByFarm({});
    setScansByFarm({});
    setReportsByFarm({});
    setChatMessagesByFarm({});

    if (user && user.emailVerified) {
      for (const fid of farmIds) {
        const path = `users/${user.uid}/farms/${fid}`;
        try {
          await deleteDoc(doc(db, 'users', user.uid, 'farms', fid));
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, path);
        }
      }
    }
  }, [farms, user]);

  const activeEnv = activeFarm ? envByFarm[activeFarm.id] || null : null;
  const activeLatestScan = activeFarm ? (scansByFarm[activeFarm.id]?.[0] ?? null) : null;

  const activeDecision = useMemo(() => {
    if (!activeFarm) return null;
    return evaluateCrops(activeFarm, activeEnv, activeLatestScan, weights);
  }, [activeFarm, activeEnv, activeLatestScan, weights]);

  const appendChatMessage = useCallback((farmId: string, msg: ChatMessage) => {
    setChatMessagesByFarm((prev) => ({
      ...prev,
      [farmId]: [...(prev[farmId] || []), msg],
    }));
  }, []);

  const clearChatHistory = useCallback((farmId: string) => {
    setChatMessagesByFarm((prev) => ({ ...prev, [farmId]: [] }));
  }, []);

  return (
    <FieldShiftContext.Provider
      value={{
        language,
        setLanguage,
        activeSection,
        setActiveSection,
        sidebarPinned,
        setSidebarPinned,
        decisionSubTab,
        setDecisionSubTab,
        askMeOpen,
        setAskMeOpen,
        askMeDraftByFarm,
        setAskMeDraft,
        aiAvailable,
        user,
        authReady,
        authError,
        clearAuthError,
        handleGoogleSignIn,
        handleEmailSignIn,
        handleEmailSignUp,
        handlePasswordReset,
        handleResendVerification,
        handleSignOut,
        mapsApiKey,
        gmpQuotaExceeded,
        farms,
        activeFarmId,
        activeFarm,
        selectFarm,
        saveFarm,
        deleteFarm,
        deleteAllUserData,
        envByFarm,
        envLoading,
        envError,
        fetchEarthIntelligence,
        scansByFarm,
        addFieldScan,
        deleteFieldScan,
        weights,
        setWeights,
        activeDecision,
        reportsByFarm,
        saveReport,
        scenario,
        setScenario,
        chatMessagesByFarm,
        appendChatMessage,
        clearChatHistory,
        isOnline,
      }}
    >
      {children}
    </FieldShiftContext.Provider>
  );
}

export function useFieldShift() {
  const ctx = useContext(FieldShiftContext);
  if (!ctx) throw new Error('useFieldShift must be used inside FieldShiftProvider');
  return ctx;
}
