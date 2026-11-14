import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Bot,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  Globe2,
  Loader2,
  MessageSquare,
  Mic,
  RotateCcw,
  Send,
  Sparkles,
  Square,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { useFieldShift } from '../context/FieldShiftContext';
import { generateFarmAlerts } from '../lib/decisionEngine';
import { t } from '../i18n/translations';
import { requestFieldCopilot, transcribeAudioNote } from '../services/aiService';
import { CopilotMarkdown } from './shared/CopilotMarkdown';
import { ChatMessage } from '../types/fieldshift';

export function AskMeWidget() {
  const {
    language,
    activeSection,
    decisionSubTab,
    askMeOpen,
    setAskMeOpen,
    askMeDraftByFarm,
    setAskMeDraft,
    aiAvailable,
    activeFarm,
    envByFarm,
    scansByFarm,
    activeDecision,
    scenario,
    chatMessagesByFarm,
    appendChatMessage,
    clearChatHistory,
    isOnline,
  } = useFieldShift();

  const isAr = language === 'ar';
  const chatKey = activeFarm?.id || 'global';
  const messages = chatMessagesByFarm[chatKey] || [];
  const draft = askMeDraftByFarm[chatKey] || '';

  const activeEnv = activeFarm ? envByFarm[activeFarm.id] ?? null : null;
  const latestScan = activeFarm ? scansByFarm[activeFarm.id]?.[0] ?? null : null;

  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);
  const [groundingMode, setGroundingMode] = useState<'none' | 'search' | 'maps'>('none');
  const [useDeepThinking, setUseDeepThinking] = useState(false);
  const [expandedTechIds, setExpandedTechIds] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Voice recording into Ask Me draft
  const [isRecording, setIsRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const triggerBtnRef = useRef<HTMLButtonElement | null>(null);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const pageContext =
    activeSection === 'decision'
      ? decisionSubTab === 'rotation'
        ? 'decision_rotation'
        : 'decision_suitability'
      : activeSection;

  const pageContextLabel = useMemo(() => {
    switch (pageContext) {
      case 'landing':
        return isAr ? 'الصفحة الرئيسية' : 'Landing Overview';
      case 'capture':
        return isAr ? 'تسجيل المزرعة' : 'Farm Capture';
      case 'earth':
        return isAr ? 'بيانات الأرض الفضائية' : 'Earth Intelligence';
      case 'scan':
        return isAr ? 'الفحص الذكي للحقل' : 'AI Field Scan';
      case 'decision_suitability':
        return isAr ? 'استوديو القرار · الملاءمة' : 'Decision Studio · Suitability';
      case 'decision_rotation':
        return isAr ? 'استوديو القرار · الدورة الزراعية' : 'Decision Studio · Rotation';
      case 'action':
        return isAr ? 'مركز الإجراءات والمحاكي' : 'Action Center · What-If';
      case 'reports':
        return isAr ? 'التقارير الموثقة' : 'Reports & Export';
      default:
        return 'Workspace';
    }
  }, [pageContext, isAr]);

  const realAlerts = useMemo(() => {
    if (!activeFarm || !activeDecision) return [];
    return generateFarmAlerts(activeFarm, activeEnv, latestScan, activeDecision);
  }, [activeFarm, activeEnv, latestScan, activeDecision]);

  const hasUrgentRealAlert = realAlerts.some((a) => a.severity === 'urgent' || a.severity === 'warning');
  const serviceUnavailable = !isOnline || aiAvailable === false;

  const contextPrompts = useMemo(() => {
    if (!activeFarm) {
      return isAr
        ? [
            'كيف أبدأ بتسجيل مزرعتي ورسم حدودها في فيلد شيفت؟',
            'ما البيانات الحقيقية التي يسحبها النظام من ناسا وما المحاصيل المدعومة؟',
            'ما الفرق بين التقديرات الفضائية وتحليل التربة المخبري؟',
          ]
        : [
            'How do I capture my parcel boundary and connect NASA data?',
            'Which 5 crops does Field Shift evaluate and why?',
            'What is the difference between satellite estimates and soil lab inputs?',
          ];
    }

    const topCropName = activeDecision?.evaluations?.[0]
      ? isAr
        ? activeDecision.evaluations[0].cropNameAr
        : activeDecision.evaluations[0].cropName
      : isAr
      ? 'المحصول الأول'
      : 'the top crop';

    switch (pageContext) {
      case 'capture':
        return isAr
          ? [
              'ما البيانات الإضافية التي ترفع دقة توصية هذه المزرعة؟',
              'كيف يؤثر رسم المضلع على حسابات المنصة مقارنة بنقطة واحدة؟',
            ]
          : [
              'What missing parcel details would raise decision confidence most?',
              'How does polygon area compare with a single pin for my farm?',
            ];
      case 'earth':
        return isAr
          ? [
              'لخّص تأثير درجات الحرارة والأمطار الحالية من ناسا على المحاصيل الخمسة.',
              'ماذا يعني مؤشر رطوبة التربة السطحية مقارنة بريّ الحقل؟',
            ]
          : [
              'Explain how these NASA temperature & rainfall readings affect my crop options.',
              'How should I interpret NASA surface soil wetness vs field irrigation?',
            ];
      case 'scan':
        return isAr
          ? [
              'اشرح نتيجة آخر فحص بصري وما الخطوات الميدانية الآمنة التالية.',
              'كيف أربط مؤشرات الصورة ببيانات الحرارة والرطوبة الحالية؟',
            ]
          : [
              'Explain my latest scan confidence and safe next field checks.',
              'How do the visual scan cues correlate with NASA climate data?',
            ];
      case 'decision_rotation':
        return isAr
          ? [
              'لماذا اختير هذا التسلسل للدورة الزراعية عبر 4 مواسم؟',
              'ما البدائل الآمنة إذا احتجت تغيير المحصول في الموسم التالي؟',
            ]
          : [
              'Why is this 4-season crop rotation sequence recommended for my soil?',
              'What safe alternatives exist if water gets tighter next season?',
            ];
      case 'action':
        return isAr
          ? [
              `ماذا يحدث لترتيب ${topCropName} في سيناريو نقص المياه الحالي (${scenario.waterAvailabilityPct}%)؟`,
              'لخّص أهم الإجراءات العاجلة بناءً على التنبيهات الحقيقية الحالية.',
            ]
          : [
              `Under this What-If scenario (${scenario.waterAvailabilityPct}% water), which crop shift is safest?`,
              'Prioritize my next field actions from the active alerts.',
            ];
      case 'reports':
        return isAr
          ? [
              'راجع نقاط عدم اليقين والبيانات الناقصة قبل تصدير هذا التقرير.',
              'لخّص أبرز نتائج التقرير بلغة مبسطة للمزارع.',
            ]
          : [
              'Summarize key uncertainties to verify before sharing this report.',
              'Turn this report into a 3-point farmer field briefing.',
            ];
      default:
        return isAr
          ? [
              `لماذا حصل ${topCropName} على أعلى ملاءمة، وما أهم مخاطره؟`,
              'ما البيانات الناقصة التي يجب جمعها لرفع مستوى الثقة؟',
            ]
          : [
              `Why did ${topCropName} rank #1, and what risks should I watch?`,
              'What missing farm inputs should I verify next to improve confidence?',
            ];
    }
  }, [activeFarm, activeDecision, pageContext, scenario.waterAvailabilityPct, isAr]);

  // Escape & Focus Trap + Focus Restoration when Ask Me drawer opens/closes
  useEffect(() => {
    if (!askMeOpen) return;
    const focusTarget = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 60);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setAskMeOpen(false);
        triggerBtnRef.current?.focus();
        return;
      }
      if (e.key === 'Tab' && drawerRef.current) {
        const focusables = drawerRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(focusTarget);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [askMeOpen, setAskMeOpen]);

  // Auto-scroll chat feed when new messages arrive
  useEffect(() => {
    if (askMeOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, sending, askMeOpen]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const closeDrawer = () => {
    setAskMeOpen(false);
    window.setTimeout(() => {
      triggerBtnRef.current?.focus();
    }, 20);
  };

  const cancelRequest = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setSending(false);
    setErrorMsg(isAr ? 'تم إلغاء الطلب.' : 'Request cancelled.');
  };

  const sendMessage = async (promptOverride?: string, isRetry = false) => {
    const text = (promptOverride ?? draft).trim();
    if (!text || sending) return;

    if (serviceUnavailable) {
      setErrorMsg(
        !isOnline
          ? isAr
            ? 'أنت غير متصل بالإنترنت حالياً.'
            : 'Offline — reconnect to ask the assistant.'
          : isAr
          ? 'خدمة المساعد غير متاحة حالياً.'
          : 'Assistant service is currently unavailable.'
      );
      return;
    }

    setErrorMsg(null);
    setLastFailedPrompt(null);

    const historyForRequest = isRetry
      ? messages
      : [
          ...messages,
          {
            id: `msg_${Date.now()}_u`,
            role: 'user' as const,
            text,
            timestamp: new Date().toISOString(),
          },
        ];

    if (!isRetry) {
      appendChatMessage(chatKey, historyForRequest[historyForRequest.length - 1]);
      if (!promptOverride) setAskMeDraft(chatKey, '');
    }

    setSending(true);
    const controller = new AbortController();
    abortRef.current = controller;
    const timeoutId = window.setTimeout(() => controller.abort(), 45000);

    try {
      const { message: botMsg } = await requestFieldCopilot({
        messages: historyForRequest.map((m) => ({ role: m.role, text: m.text })),
        farm: activeFarm,
        env: activeEnv,
        latestScan,
        decision: activeDecision,
        scenario,
        pageContext,
        groundingMode,
        useDeepThinking,
        language,
        signal: controller.signal,
      });
      appendChatMessage(chatKey, botMsg);
    } catch (err) {
      setLastFailedPrompt(text);
      if ((err as Error)?.name === 'AbortError') {
        setErrorMsg(isAr ? 'تم إلغاء الطلب أو انتهت المهلة.' : 'Request cancelled or timed out.');
      } else {
        setErrorMsg(err instanceof Error ? err.message : 'Unable to reach assistant.');
      }
    } finally {
      window.clearTimeout(timeoutId);
      abortRef.current = null;
      setSending(false);
    }
  };

  const handleCopy = async (id: string, msg: ChatMessage) => {
    try {
      const full = msg.technicalDetails ? `${msg.text}\n\n${msg.technicalDetails}` : msg.text;
      await navigator.clipboard.writeText(full);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1800);
    } catch {
      // Clipboard blocked silently
    }
  };

  const toggleVoiceInput = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((tr) => tr.stop());
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const dataUrl = String(reader.result || '');
          const base64 = dataUrl.split(',')[1] || '';
          if (!base64) return;
          setTranscribing(true);
          try {
            const data = await transcribeAudioNote(base64, blob.type || 'audio/webm');
            if (data.transcript) {
              setAskMeDraft(chatKey, draft ? `${draft} ${data.transcript}` : data.transcript);
            }
          } catch (err) {
            setErrorMsg(err instanceof Error ? err.message : 'Voice transcription failed.');
          } finally {
            setTranscribing(false);
          }
        };
        reader.readAsDataURL(blob);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch {
      setErrorMsg(
        isAr
          ? 'تعذر الوصول للميكروفون. اكتب سؤالك مباشرة.'
          : 'Microphone unavailable or permission denied. Type your question directly.'
      );
    }
  };

  return (
    <>
      {/* Fixed Floating "Ask Me" Trigger Button */}
      {!askMeOpen && (
        <button
          ref={triggerBtnRef}
          type="button"
          onClick={() => setAskMeOpen(true)}
          aria-label={t(language, 'askMeTitle')}
          title={
            serviceUnavailable
              ? t(language, 'askMeUnavailable')
              : `${t(language, 'askMeTitle')} · ${pageContextLabel}`
          }
          className={`fixed z-40 end-4 sm:end-6 bottom-20 md:bottom-6 inline-flex items-center gap-2.5 px-3.5 sm:px-4 h-12 rounded-2xl bg-white border border-[#DCE7F5] text-[#0B2A5B] shadow-md hover:shadow-lg hover:border-[#1769E0] active:scale-[0.98] transition-all duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#1769E0] no-print ${
            serviceUnavailable ? 'opacity-80' : ''
          }`}
        >
          <span
            className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
              serviceUnavailable ? 'bg-[#F7FAFE] text-[#66758A]' : 'bg-[#EAF3FF] text-[#1769E0]'
            }`}
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
          </span>
          <span className="hidden min-[380px]:inline text-sm font-semibold whitespace-nowrap">
            {t(language, 'askMeTitle')}
          </span>
          {hasUrgentRealAlert && !sending && !serviceUnavailable && (
            <span className="hidden sm:inline text-[11px] font-medium text-[#1769E0] border-s border-[#DCE7F5] ps-2">
              {realAlerts.length} {isAr ? 'تنبيه' : realAlerts.length === 1 ? 'alert' : 'alerts'}
            </span>
          )}
        </button>
      )}

      {/* Slide-Over Context-Aware Assistant Drawer (Desktop end side / Mobile full sheet) */}
      {askMeOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#0B2A5B]/25 flex justify-end fs-fade-in no-print"
          role="dialog"
          aria-modal="true"
          aria-label={t(language, 'askMeTitle')}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDrawer();
          }}
        >
          <div
            ref={drawerRef}
            className="bg-white w-full sm:max-w-[440px] h-full flex flex-col border-s border-[#DCE7F5] shadow-2xl fs-drawer-end"
          >
            {/* Header */}
            <header className="px-4 sm:px-5 py-3.5 border-b border-[#DCE7F5] flex items-center justify-between gap-3 shrink-0 bg-white">
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  type="button"
                  onClick={closeDrawer}
                  aria-label={isAr ? 'رجوع' : 'Back'}
                  className="sm:hidden p-2 -ms-1.5 rounded-xl text-[#0B2A5B] hover:bg-[#EAF3FF] cursor-pointer"
                >
                  <ArrowLeft className="w-5 h-5 rtl:rotate-180" />
                </button>
                <div className="w-9 h-9 rounded-xl bg-[#EAF3FF] text-[#1769E0] flex items-center justify-center shrink-0">
                  <Bot className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-[#0B2A5B] truncate">
                      {t(language, 'askMeTitle')}
                    </h2>
                    <span className="text-[11px] font-medium text-[#1769E0]">
                      {sending
                        ? t(language, 'askMeProcessing')
                        : serviceUnavailable
                        ? t(language, 'askMeUnavailable')
                        : t(language, 'askMeReady')}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#66758A] truncate">
                    {activeFarm ? activeFarm.name : isAr ? 'بدون مزرعة نشطة' : 'No active farm'} · {pageContextLabel}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => clearChatHistory(chatKey)}
                    title={isAr ? 'مسح المحادثة' : 'Clear conversation'}
                    aria-label={isAr ? 'مسح المحادثة' : 'Clear conversation'}
                    className="p-2 rounded-lg text-[#66758A] hover:text-[#E45C67] hover:bg-red-50 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={closeDrawer}
                  aria-label={isAr ? 'إغلاق اسألني' : 'Close Ask Me'}
                  className="p-2 rounded-lg text-[#66758A] hover:bg-[#EAF3FF] hover:text-[#1769E0] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#1769E0]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </header>

            {/* Grounding & Reasoning Controls */}
            <div className="px-4 py-2 border-b border-[#DCE7F5] bg-[#F7FAFE] flex flex-wrap items-center justify-between gap-2 text-[11px] shrink-0">
              <div className="flex items-center gap-1">
                {(['none', 'search', 'maps'] as const).map((gm) => (
                  <button
                    key={gm}
                    type="button"
                    onClick={() => setGroundingMode(gm)}
                    className={`px-2 py-1 rounded-md border font-medium transition-colors cursor-pointer ${
                      groundingMode === gm
                        ? 'bg-white border-[#1769E0] text-[#1769E0] font-semibold'
                        : 'border-transparent text-[#66758A] hover:text-[#12233F]'
                    }`}
                  >
                    {gm === 'none'
                      ? isAr
                        ? 'سياق المزرعة'
                        : 'Farm Context'
                      : gm === 'search'
                      ? isAr
                        ? 'بحث الويب'
                        : 'Web Search'
                      : isAr
                      ? 'خرائط جوجل'
                      : 'Maps'}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setUseDeepThinking(!useDeepThinking)}
                aria-pressed={useDeepThinking}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md border font-medium transition-colors cursor-pointer ${
                  useDeepThinking
                    ? 'bg-[#0B2A5B] border-[#0B2A5B] text-white'
                    : 'bg-white border-[#DCE7F5] text-[#66758A] hover:text-[#12233F]'
                }`}
              >
                <Sparkles className="w-3 h-3" />
                <span>{isAr ? 'تحليل معمق' : 'Deep Reasoning'}</span>
              </button>
            </div>

            {/* Messages & Contextual Prompts */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-xl bg-[#F7FAFE] border border-[#DCE7F5] text-xs text-[#12233F] leading-relaxed">
                    {activeFarm
                      ? isAr
                        ? `أنا متصل بسياق "${activeFarm.name}" في شاشة ${pageContextLabel}. لا أخترع أي أرقام غير متصلة.`
                        : `Connected to "${activeFarm.name}" in ${pageContextLabel}. Replies distinguish connected data, calculated scores, and missing fields.`
                      : isAr
                      ? 'لم تُحدد مزرعة بعد — يمكنك سؤالي عن خطوات البدء أو البيانات المطلوبة.'
                      : 'No parcel captured yet — ask about setup steps, NASA metrics, or supported crops.'}
                  </div>

                  <p className="text-[11px] font-semibold text-[#66758A]">
                    {isAr ? 'أسئلة مقترحة لهذه الشاشة:' : 'Contextual prompts for this view:'}
                  </p>
                  <div className="space-y-2">
                    {contextPrompts.map((qp, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => sendMessage(qp)}
                        disabled={sending || serviceUnavailable}
                        className="w-full text-start p-3 rounded-xl border border-[#DCE7F5] bg-white text-xs font-medium text-[#0B2A5B] hover:border-[#1769E0] hover:bg-[#EAF3FF]/45 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {qp}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg) => {
                const techOpen = Boolean(expandedTechIds[msg.id]);
                return (
                  <div
                    key={msg.id}
                    className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-[#1769E0] text-white ms-8'
                        : 'bg-[#F7FAFE] border border-[#DCE7F5] text-[#12233F] me-4'
                    }`}
                  >
                    {msg.role === 'user' ? (
                      <div className="whitespace-pre-wrap">{msg.text}</div>
                    ) : (
                      <div className="space-y-2">
                        <CopilotMarkdown text={msg.text} />

                        {/* Expandable Technical Details */}
                        {msg.technicalDetails && (
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedTechIds((prev) => ({ ...prev, [msg.id]: !prev[msg.id] }))
                              }
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1769E0] hover:underline cursor-pointer"
                            >
                              {techOpen ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                              <span>
                                {techOpen
                                  ? isAr
                                    ? 'إخفاء التفاصيل الفنية'
                                    : 'Hide technical details'
                                  : isAr
                                  ? 'عرض التفاصيل الفنية'
                                  : 'Show technical details'}
                              </span>
                            </button>

                            {techOpen && (
                              <div className="mt-2 p-2.5 rounded-xl bg-white border border-[#DCE7F5] text-[11px] text-[#66758A] space-y-1">
                                <CopilotMarkdown text={msg.technicalDetails} />
                              </div>
                            )}
                          </div>
                        )}

                        {/* Grounding Links */}
                        {msg.groundingUrls && msg.groundingUrls.length > 0 && (
                          <div className="pt-2 border-t border-[#DCE7F5] flex flex-wrap gap-2">
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

                        {/* Source Context & Copy Bar */}
                        <div className="pt-1.5 border-t border-[#DCE7F5]/70 flex items-center justify-between gap-2 text-[10px] text-[#66758A]">
                          <span className="truncate">
                            {msg.contextUsed?.join(' · ') || pageContextLabel}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(msg.id, msg)}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-[#66758A] hover:text-[#1769E0] cursor-pointer shrink-0"
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
                  </div>
                );
              })}

              {sending && (
                <div className="p-3 rounded-2xl bg-[#F7FAFE] border border-[#DCE7F5] text-xs text-[#0B2A5B] flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-[#1769E0] animate-spin shrink-0" />
                    <span>
                      {isAr ? 'جارٍ قراءة سياق المزرعة وصياغة الرد...' : 'Analyzing connected context...'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={cancelRequest}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#E45C67] hover:underline cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>{isAr ? 'إلغاء' : 'Cancel'}</span>
                  </button>
                </div>
              )}

              {errorMsg && (
                <div
                  role="alert"
                  className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-[#E45C67] space-y-2"
                >
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                  {lastFailedPrompt && (
                    <button
                      type="button"
                      onClick={() => sendMessage(lastFailedPrompt, true)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-red-200 text-[11px] font-semibold text-[#E45C67] hover:bg-red-100 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>{isAr ? 'إعادة المحاولة' : 'Retry'}</span>
                    </button>
                  )}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Composer Footer (Draft preserved across close/navigation, Enter sends, Shift+Enter newline, Voice Input) */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
              className="p-3.5 border-t border-[#DCE7F5] bg-white space-y-2 shrink-0"
            >
              <div className="flex items-end gap-2">
                <button
                  type="button"
                  onClick={toggleVoiceInput}
                  disabled={sending || transcribing}
                  aria-label={isRecording ? 'Stop voice input' : 'Voice input'}
                  title={isRecording ? 'Stop & transcribe' : 'Voice input'}
                  className={`p-2.5 rounded-xl border transition-colors cursor-pointer shrink-0 ${
                    isRecording
                      ? 'bg-[#E45C67] border-[#E45C67] text-white'
                      : 'bg-[#F7FAFE] border-[#DCE7F5] text-[#66758A] hover:text-[#1769E0] hover:border-[#1769E0]'
                  }`}
                >
                  {transcribing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isRecording ? (
                    <Square className="w-4 h-4" />
                  ) : (
                    <Mic className="w-4 h-4" />
                  )}
                </button>

                <textarea
                  ref={inputRef}
                  rows={2}
                  value={draft}
                  onChange={(e) => setAskMeDraft(chatKey, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder={
                    isAr
                      ? 'اكتب سؤالك هنا (Enter للإرسال، Shift+Enter لسطر جديد)...'
                      : 'Ask about this view, crop scores, or risks (Enter to send)...'
                  }
                  className="flex-1 resize-none rounded-xl border border-[#DCE7F5] bg-[#F7FAFE] focus:bg-white px-3 py-2 text-xs text-[#12233F] focus:outline-none focus:border-[#1769E0]"
                />

                <button
                  type="submit"
                  disabled={!draft.trim() || sending || serviceUnavailable}
                  aria-label={isAr ? 'إرسال' : 'Send message'}
                  className="p-2.5 rounded-xl bg-[#1769E0] text-white hover:bg-[#0B2A5B] disabled:opacity-40 transition-colors cursor-pointer shrink-0"
                >
                  <Send className="w-4 h-4 rtl:rotate-180" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
