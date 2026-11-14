import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Camera,
  CheckCircle2,
  FileText,
  Loader2,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import { useFieldShift } from '../context/FieldShiftContext';
import { requestAiFieldScan } from '../services/aiService';
import { FieldScanResult, ScanCategory, SoilData } from '../types/fieldshift';

interface PreparedImage {
  dataUrl: string;
  base64: string;
  mimeType: string;
  width: number;
  height: number;
}

async function prepareImageForScan(file: File): Promise<PreparedImage> {
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read the selected image file.'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Invalid or corrupted image file.'));
    el.src = rawDataUrl;
  });

  const maxDim = 1280;
  let targetW = img.naturalWidth || img.width;
  let targetH = img.naturalHeight || img.height;

  if (targetW > maxDim || targetH > maxDim) {
    if (targetW >= targetH) {
      targetH = Math.round((targetH * maxDim) / targetW);
      targetW = maxDim;
    } else {
      targetW = Math.round((targetW * maxDim) / targetH);
      targetH = maxDim;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, targetW);
  canvas.height = Math.max(1, targetH);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    const base64Fallback = rawDataUrl.split(',')[1] || '';
    return {
      dataUrl: rawDataUrl,
      base64: base64Fallback,
      mimeType: file.type || 'image/jpeg',
      width: targetW,
      height: targetH,
    };
  }

  ctx.drawImage(img, 0, 0, targetW, targetH);
  const outMime = 'image/jpeg';
  const compressedUrl = canvas.toDataURL(outMime, 0.85);
  return {
    dataUrl: compressedUrl,
    base64: compressedUrl.split(',')[1] || '',
    mimeType: outMime,
    width: targetW,
    height: targetH,
  };
}

type ScanStage = 'idle' | 'preparing' | 'inspecting' | 'correlating';

export function AiFieldScanView({ embedded = false }: { embedded?: boolean }) {
  const {
    language,
    activeFarm,
    saveFarm,
    envByFarm,
    scansByFarm,
    addFieldScan,
    deleteFieldScan,
    setActiveSection,
    isOnline,
  } = useFieldShift();

  const isAr = language === 'ar';
  const [scanType, setScanType] = useState<ScanCategory>('crop_photo');
  const [selectedPreview, setSelectedPreview] = useState<string | null>(null);
  const [selectedBase64, setSelectedBase64] = useState<string>('');
  const [selectedMime, setSelectedMime] = useState<string>('image/jpeg');
  const [selectedName, setSelectedName] = useState<string>('');
  const [selectedDims, setSelectedDims] = useState<string>('');

  const [analyzing, setAnalyzing] = useState(false);
  const [stage, setStage] = useState<ScanStage>('idle');
  const [scanError, setScanError] = useState<string | null>(null);
  const [viewTab, setViewTab] = useState<'evidence' | 'original'>('evidence');
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);

  // Editable OCR confirmation fields
  const [ocrPh, setOcrPh] = useState<string>('');
  const [ocrEc, setOcrEc] = useState<string>('');
  const [ocrTexture, setOcrTexture] = useState<NonNullable<SoilData['texture']>>('unknown');
  const [ocrAppliedMsg, setOcrAppliedMsg] = useState<string | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(isAr ? 'الكاميرا غير مدعومة في هذا المتصفح' : 'Camera not supported in this browser');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      setCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 100);
    } catch (err) {
      setCameraError(err instanceof Error ? err.message : 'Could not access camera');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const captureLivePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const base64 = dataUrl.split(',')[1] || '';

    setSelectedPreview(dataUrl);
    setSelectedBase64(base64);
    setSelectedMime('image/jpeg');
    setSelectedName(`live-camera-${Date.now()}.jpg`);
    setSelectedDims(`${canvas.width}×${canvas.height}px`);
    stopCamera();
  };

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  if (!activeFarm) {
    if (embedded) {
      return (
        <div className="p-6 text-center text-sm text-[#66758A]">
          {isAr
            ? 'سجِّل مزرعتك أولاً لتفعيل فحص الحقل.'
            : 'Save your farm first to enable Field Scan.'}
        </div>
      );
    }
    return (
      <div className="bg-white rounded-2xl border border-[#DCE7F5] p-8 sm:p-12 text-center max-w-2xl mx-auto">
        <ScanLine className="w-10 h-10 text-[#1769E0] mx-auto mb-3" />
        <h1 className="text-xl font-bold text-[#0B2A5B] mb-2">
          {isAr ? 'سجِّل مزرعة أولاً لبدء فحص الحقل' : 'Capture a farm before running Field Scan'}
        </h1>
        <p className="text-sm text-[#66758A] mb-6">
          {isAr
            ? 'يربط فحص الحقل ملاحظات الصورة بظروف المناخ والتربة الخاصة بمزرعتك مباشرةً.'
            : 'Field Scan correlates your photo against real local meteorology and attaches findings directly to your farm record.'}
        </p>
        <button
          type="button"
          onClick={() => setActiveSection('capture')}
          className="px-5 py-3 rounded-xl bg-[#1769E0] text-white text-sm font-semibold hover:bg-[#0B2A5B] transition-colors cursor-pointer"
        >
          {isAr ? 'الذهاب إلى تسجيل المزرعة' : 'Go to Farm Capture'}
        </button>
      </div>
    );
  }


  const env = envByFarm[activeFarm.id] || null;
  const farmScans = scansByFarm[activeFarm.id] || [];
  const displayedScan: FieldScanResult | null =
    (selectedHistoryId ? farmScans.find((s) => s.id === selectedHistoryId) : null) || farmScans[0] || null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setScanError(null);
    setOcrAppliedMsg(null);
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setScanError(
        isAr
          ? 'صيغة غير مدعومة. يرجى رفع صورة بصيغة JPEG أو PNG أو WebP.'
          : 'Unsupported file type. Please upload a JPEG, PNG, or WebP image.'
      );
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setScanError(
        isAr
          ? 'حجم الصورة يتجاوز الحد الأقصى (8 ميجابايت).'
          : 'Image exceeds the 8 MB limit. Please upload a smaller image.'
      );
      return;
    }

    setStage('preparing');
    try {
      const prepared = await prepareImageForScan(file);
      setSelectedPreview(prepared.dataUrl);
      setSelectedBase64(prepared.base64);
      setSelectedMime(prepared.mimeType);
      setSelectedName(file.name);
      setSelectedDims(`${prepared.width}×${prepared.height}px`);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Unable to process image.');
    } finally {
      setStage('idle');
    }
  };

  const cancelAnalysis = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setAnalyzing(false);
    setStage('idle');
    setScanError(isAr ? 'تم إلغاء الفحص بناءً على طلبك.' : 'Field scan cancelled.');
  };

  const runScanAnalysis = async () => {
    if (!selectedBase64 || analyzing) return;
    if (!isOnline) {
      setScanError(
        isAr
          ? 'لا يوجد اتصال بالإنترنت حالياً. تحقق من الاتصال ثم أعد المحاولة.'
          : 'You appear to be offline. Reconnect to run AI Field Scan.'
      );
      return;
    }

    setAnalyzing(true);
    setScanError(null);
    setOcrAppliedMsg(null);
    setStage('inspecting');

    const controller = new AbortController();
    abortRef.current = controller;
    const timeoutId = window.setTimeout(() => controller.abort(), 45000);

    try {
      const result = await requestAiFieldScan({
        farm: activeFarm,
        env,
        imageBase64: selectedBase64,
        mimeType: selectedMime,
        scanType,
        imageName: selectedName || 'field-image.jpg',
        imagePreviewDataUrl: selectedPreview || undefined,
        language,
        signal: controller.signal,
      });

      if (result.ocrSoilValues) {
        setOcrPh(
          result.ocrSoilValues.ph !== null && result.ocrSoilValues.ph !== undefined
            ? String(result.ocrSoilValues.ph)
            : ''
        );
        setOcrEc(
          result.ocrSoilValues.ecSalinityDsM !== null &&
            result.ocrSoilValues.ecSalinityDsM !== undefined
            ? String(result.ocrSoilValues.ecSalinityDsM)
            : ''
        );
        setOcrTexture(result.ocrSoilValues.texture || 'unknown');
      }

      await addFieldScan(result);
      setSelectedHistoryId(result.id);
      setViewTab('evidence');
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        setScanError(
          isAr
            ? 'تم إلغاء الطلب أو استغرق وقتاً أطول من المعتاد. يرجى إعادة المحاولة.'
            : 'Scan was cancelled or timed out. Please retry.'
        );
      } else {
        setScanError(err instanceof Error ? err.message : 'Field scan failed.');
      }
    } finally {
      window.clearTimeout(timeoutId);
      abortRef.current = null;
      setAnalyzing(false);
      setStage('idle');
    }
  };

  const applyOcrToFarm = async () => {
    const parsedPh = ocrPh.trim() !== '' ? Number(ocrPh) : activeFarm.soilData?.ph;
    const parsedEc = ocrEc.trim() !== '' ? Number(ocrEc) : activeFarm.soilData?.ecSalinityDsM;
    const ocrExtra = displayedScan?.ocrSoilValues;

    await saveFarm({
      ...activeFarm,
      soilData: {
        ...activeFarm.soilData,
        ph: parsedPh !== undefined && !Number.isNaN(parsedPh) ? parsedPh : undefined,
        ecSalinityDsM: parsedEc !== undefined && !Number.isNaN(parsedEc) ? parsedEc : undefined,
        nitrogenPpm:
          typeof ocrExtra?.nitrogenPpm === 'number'
            ? ocrExtra.nitrogenPpm
            : activeFarm.soilData?.nitrogenPpm,
        phosphorusPpm:
          typeof ocrExtra?.phosphorusPpm === 'number'
            ? ocrExtra.phosphorusPpm
            : activeFarm.soilData?.phosphorusPpm,
        potassiumPpm:
          typeof ocrExtra?.potassiumPpm === 'number'
            ? ocrExtra.potassiumPpm
            : activeFarm.soilData?.potassiumPpm,
        organicMatterPct:
          typeof ocrExtra?.organicMatterPct === 'number'
            ? ocrExtra.organicMatterPct
            : activeFarm.soilData?.organicMatterPct,
        texture: ocrTexture !== 'unknown' ? ocrTexture : activeFarm.soilData?.texture,
        source: 'user-provided data',
        sourceLabel: 'Confirmed from Soil Report OCR',
        recordedAt: new Date().toISOString(),
      },
    });
    setOcrAppliedMsg(
      isAr
        ? 'تم حفظ قيم تحليل التربة المؤكدة في ملف المزرعة وإعادة حساب القرار.'
        : 'Confirmed soil report values saved to your farm profile and applied to Decision Studio.'
    );
  };

  const stageText =
    stage === 'preparing'
      ? isAr
        ? '1/3 جارٍ تجهيز وضغط الصورة للفحص...'
        : '1/3 Preparing & resizing image for upload...'
      : stage === 'inspecting'
      ? isAr
        ? '2/3 فحص جودة الصورة وتحديد المحصول أو بيانات التقرير...'
        : '2/3 Inspecting clarity, crop visibility & visual indicators...'
      : stage === 'correlating'
      ? isAr
        ? '3/3 ربط الملاحظات البصرية ببيانات مناخ ناسا...'
        : '3/3 Correlating findings with connected NASA meteorology...'
      : '';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0B2A5B] tracking-tight">
            {isAr ? 'الفحص الذكي للحقل والتربة' : 'AI Field Scan'}
          </h1>
          <p className="text-sm text-[#66758A] mt-1">
            {activeFarm.name} ·{' '}
            {isAr
              ? 'مؤشرات بصرية أولية للقمح والذرة ودوار الشمس وفول الصويا والبرسيم أو قراءة تقارير التربة.'
              : 'Evidence-based preliminary visual assessment for the 5 supported crops, soil surface, and soil lab OCR.'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setActiveSection('decision')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1769E0] text-white text-xs font-semibold hover:bg-[#0B2A5B] transition-colors self-start cursor-pointer"
        >
          <span>{isAr ? 'الانتقال إلى استوديو القرار' : 'Evaluate Crops in Decision Studio'}</span>
          <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
        </button>
      </div>

      <div className="grid lg:grid-cols-12 gap-6 items-start">
        {/* Upload & Scan Category Panel */}
        <section className="lg:col-span-5 bg-white rounded-2xl border border-[#DCE7F5] p-5 space-y-4">
          <h2 className="text-sm font-bold text-[#0B2A5B]">
            {isAr ? '1. اختر نوع الفحص وارفع الصورة' : '1. Select Scan Type & Upload Image'}
          </h2>

          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#F7FAFE] border border-[#DCE7F5]">
            {(
              [
                { id: 'crop_photo', label: isAr ? 'صورة محصول' : 'Crop Photo' },
                { id: 'soil_surface', label: isAr ? 'سطح التربة' : 'Soil Surface' },
                { id: 'soil_report_ocr', label: isAr ? 'تقرير تربة' : 'Soil Report' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                disabled={analyzing}
                onClick={() => setScanType(tab.id)}
                className={`py-2 px-2 rounded-lg text-xs font-medium transition-colors cursor-pointer disabled:opacity-60 ${
                  scanType === tab.id
                    ? 'bg-white text-[#1769E0] shadow-xs font-semibold'
                    : 'text-[#66758A] hover:text-[#12233F]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Camera live preview mode */}
          {cameraActive ? (
            <div className="rounded-2xl border border-[#DCE7F5] bg-black p-3 space-y-3">
              <div className="relative rounded-xl overflow-hidden aspect-video bg-neutral-900 flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                {/* Viewfinder crosshair overlay */}
                <div className="absolute inset-8 border-2 border-white/40 border-dashed rounded-lg pointer-events-none flex items-center justify-center">
                  <span className="text-[11px] text-white/80 bg-black/50 px-2 py-0.5 rounded backdrop-blur-sm">
                    {isAr ? 'وجِّه الكاميرا نحو النبات أو الورقة' : 'Align plant or soil in frame'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={captureLivePhoto}
                  className="px-5 py-2.5 rounded-xl bg-[#19A974] hover:bg-[#148a5e] text-white text-xs font-bold shadow-md flex items-center gap-2 cursor-pointer transition-all"
                >
                  <Camera className="w-4 h-4" />
                  <span>{isAr ? 'التقاط وفحص الآن' : 'Capture & Inspect'}</span>
                </button>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="px-4 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-semibold cursor-pointer transition-colors"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Dual Action: Live Camera vs File Upload */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={startCamera}
                  disabled={analyzing}
                  className="py-3 px-3 rounded-xl border border-[#1769E0]/40 bg-[#EAF3FF] hover:bg-[#1769E0] text-[#1769E0] hover:text-white text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
                >
                  <Camera className="w-4 h-4" />
                  <span>{isAr ? 'فتح الكاميرا المباشرة' : 'Open Live Camera'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={analyzing}
                  className="py-3 px-3 rounded-xl border border-[#DCE7F5] bg-white hover:bg-[#F7FAFE] text-[#0B2A5B] text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
                >
                  <Upload className="w-4 h-4 text-[#66758A]" />
                  <span>{isAr ? 'اختيار من الملفات' : 'Choose File'}</span>
                </button>
              </div>

              {cameraError && (
                <p className="text-xs text-red-500 font-medium px-1">{cameraError}</p>
              )}

              <label
                htmlFor="field-scan-upload"
                className="block rounded-2xl border-2 border-dashed border-[#DCE7F5] hover:border-[#1769E0] bg-[#F7FAFE] p-5 text-center cursor-pointer transition-colors"
              >
                <input
                  ref={fileInputRef}
                  id="field-scan-upload"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  disabled={analyzing}
                  className="sr-only"
                />
                {selectedPreview ? (
                  <div className="space-y-2">
                    <img
                      src={selectedPreview}
                      alt={selectedName || 'Selected field upload'}
                      className="max-h-52 mx-auto rounded-xl object-contain border border-[#DCE7F5]"
                    />
                    <p className="text-xs font-medium text-[#12233F] truncate">{selectedName}</p>
                    <p className="text-[11px] text-[#66758A] tabular-nums">
                      {selectedDims} ·{' '}
                      <span className="text-[#1769E0] font-medium">
                        {isAr ? 'انقر لتغيير الصورة أو أعد فتح الكاميرا' : 'Click to replace or open camera'}
                      </span>
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5 py-2">
                    <div className="w-9 h-9 rounded-xl bg-[#EAF3FF] text-[#1769E0] flex items-center justify-center mx-auto">
                      {scanType === 'soil_report_ocr' ? (
                        <FileText className="w-4 h-4" />
                      ) : (
                        <Camera className="w-4 h-4" />
                      )}
                    </div>
                    <p className="text-xs font-semibold text-[#0B2A5B]">
                      {isAr ? 'يمكنك سحب وإفلات الصورة هنا أيضاً' : 'You can also drag & drop photo here'}
                    </p>
                    <p className="text-[10px] text-[#66758A]">
                      JPEG, PNG, WebP · Max 8 MB
                    </p>
                  </div>
                )}
              </label>
            </div>
          )}

          {analyzing && stageText && (
            <div
              role="status"
              className="p-3 rounded-xl bg-[#EAF3FF]/70 border border-[#DCE7F5] text-xs text-[#0B2A5B] flex items-center gap-2.5"
            >
              <Loader2 className="w-4 h-4 text-[#1769E0] animate-spin shrink-0" />
              <span className="font-medium">{stageText}</span>
            </div>
          )}

          {scanError && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-[#E45C67] space-y-2"
            >
              <p className="font-medium">{scanError}</p>
              {selectedBase64 && !analyzing && (
                <button
                  type="button"
                  onClick={runScanAnalysis}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-red-200 text-[#E45C67] font-semibold hover:bg-red-100 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{isAr ? 'إعادة المحاولة' : 'Retry Scan'}</span>
                </button>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={runScanAnalysis}
              disabled={!selectedBase64 || analyzing}
              className="flex-1 py-3 px-4 rounded-xl bg-[#1769E0] text-white text-sm font-semibold hover:bg-[#0B2A5B] disabled:opacity-50 transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              <span>
                {analyzing
                  ? isAr
                    ? 'جارٍ التحليل الميداني...'
                    : 'Analyzing Image...'
                  : isAr
                  ? 'بدء الفحص الذكي'
                  : 'Analyze Field Image'}
              </span>
            </button>

            {analyzing && (
              <button
                type="button"
                onClick={cancelAnalysis}
                className="px-4 py-3 rounded-xl border border-[#DCE7F5] bg-white text-xs font-semibold text-[#12233F] hover:bg-red-50 hover:text-[#E45C67] hover:border-red-200 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <XCircle className="w-4 h-4" />
                <span>{isAr ? 'إلغاء' : 'Cancel'}</span>
              </button>
            )}
          </div>

          <p className="text-[11px] text-[#66758A] leading-relaxed">
            {isAr
              ? 'ملاحظة: الصورة وحدها لا تعطي تشخيصاً نهائياً للأمراض ولا نصدر أي جرعات مبيدات.'
              : 'Safety standard: Visual assessment never provides definitive disease diagnosis or chemical pesticide dosages.'}
          </p>
        </section>

        {/* Results & Evidence Panel */}
        <section className="lg:col-span-7 space-y-4">
          {analyzing && !displayedScan ? (
            <div className="bg-white rounded-2xl border border-[#DCE7F5] p-6 space-y-4 animate-pulse" aria-busy="true">
              <div className="h-4 w-44 rounded bg-[#EAF3FF]" />
              <div className="h-6 w-3/4 rounded bg-[#EAF3FF]" />
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="h-16 rounded-xl bg-[#F7FAFE]" />
                <div className="h-16 rounded-xl bg-[#F7FAFE]" />
                <div className="h-16 rounded-xl bg-[#F7FAFE]" />
              </div>
              <div className="h-24 rounded-xl bg-[#F7FAFE]" />
            </div>
          ) : !displayedScan ? (
            <div className="bg-white rounded-2xl border border-[#DCE7F5] p-8 text-center space-y-2">
              <ScanLine className="w-8 h-8 text-[#66758A] mx-auto" />
              <h2 className="text-base font-bold text-[#0B2A5B]">
                {isAr ? 'لا توجد نتائج فحص بعد' : 'No field scan recorded yet'}
              </h2>
              <p className="text-xs text-[#66758A] max-w-md mx-auto">
                {isAr
                  ? 'ارفع صورة حقيقية للمحصول أو سطح التربة أو تقرير التحليل المخبري لعرض الأدلة البصرية وربطها ببيانات ناسا.'
                  : 'Upload a real crop photo, soil-surface photo, or soil lab report to inspect visual evidence alongside NASA meteorology.'}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#DCE7F5] p-6 space-y-5 fs-view-transition">
              {/* Header + Toggle Original vs Evidence */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DCE7F5] pb-4">
                <div>
                  <p className="text-[11px] font-semibold text-[#1769E0]">
                    {displayedScan.provenance} · {displayedScan.modelVersion}
                  </p>
                  <h2 className="text-lg font-bold text-[#0B2A5B] mt-0.5">
                    {displayedScan.preliminaryAssessment}
                  </h2>
                </div>

                <div className="inline-flex p-0.5 rounded-lg bg-[#F7FAFE] border border-[#DCE7F5]">
                  <button
                    type="button"
                    onClick={() => setViewTab('evidence')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer ${
                      viewTab === 'evidence' ? 'bg-white text-[#1769E0] shadow-xs font-semibold' : 'text-[#66758A]'
                    }`}
                  >
                    {isAr ? 'الأدلة والتقييم' : 'Evidence'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewTab('original')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer ${
                      viewTab === 'original' ? 'bg-white text-[#1769E0] shadow-xs font-semibold' : 'text-[#66758A]'
                    }`}
                  >
                    {isAr ? 'الصورة الأصلية' : 'Original Photo'}
                  </button>
                </div>
              </div>

              {/* Quality / Unsupported Crop Banner */}
              {displayedScan.qualityStatus !== 'usable' && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                  <div className="flex items-center gap-2 font-bold">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>
                      {isAr ? 'حالة جودة الصورة:' : 'Quality status:'} {displayedScan.qualityStatus.replace('_', ' ')}
                    </span>
                  </div>
                  <p>{displayedScan.qualityReason}</p>
                </div>
              )}

              {viewTab === 'original' ? (
                displayedScan.imagePreviewDataUrl ? (
                  <div className="rounded-xl overflow-hidden border border-[#DCE7F5] bg-[#F7FAFE] p-2">
                    <img
                      src={displayedScan.imagePreviewDataUrl}
                      alt={displayedScan.imageName}
                      className="max-h-96 mx-auto rounded-lg object-contain"
                    />
                  </div>
                ) : (
                  <div className="p-6 rounded-xl bg-[#F7FAFE] border border-[#DCE7F5] text-xs text-[#66758A] text-center">
                    {isAr
                      ? 'المعاينة الأصلية للصورة متوفرة فقط في الجلسة الحالية للحفاظ على حجم التخزين.'
                      : 'Image preview is held locally for the active session; structured evidence remains saved.'}
                  </div>
                )
              ) : (
                <div className="space-y-4">
                  <div className="grid sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-[#F7FAFE] border border-[#DCE7F5]">
                      <p className="text-[#66758A] mb-0.5">{isAr ? 'المحصول المكتشف' : 'Detected Subject'}</p>
                      <p className="font-bold text-[#0B2A5B]">{displayedScan.detectedCropLabel}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-[#F7FAFE] border border-[#DCE7F5]">
                      <p className="text-[#66758A] mb-0.5">{isAr ? 'ثقة التقييم البصري' : 'Visual Confidence'}</p>
                      <p className="font-bold text-[#0B2A5B] tabular-nums">
                        {displayedScan.confidenceScore}% ({displayedScan.confidenceLevel})
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-[#F7FAFE] border border-[#DCE7F5]">
                      <p className="text-[#66758A] mb-0.5">{isAr ? 'جودة الصورة' : 'Image Quality'}</p>
                      <p className="font-bold text-[#0B2A5B]">{displayedScan.qualityStatus}</p>
                    </div>
                  </div>

                  {/* Visual Evidence */}
                  <div>
                    <h3 className="text-xs font-bold text-[#0B2A5B] mb-1.5">
                      {isAr ? 'الأدلة البصرية المرصودة' : 'Detected Visual Evidence'}
                    </h3>
                    <ul className="list-disc ps-5 text-xs text-[#12233F] space-y-1">
                      {displayedScan.visualEvidence.map((v, i) => (
                        <li key={i}>{v}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Environmental Context Correlation */}
                  <div className="p-3.5 rounded-xl bg-[#EAF3FF]/60 border border-[#DCE7F5] text-xs space-y-1">
                    <p className="font-bold text-[#0B2A5B]">
                      {isAr ? 'الربط بالبيانات المناخية' : 'Environmental Context Correlation'}
                    </p>
                    <p className="text-[#12233F] leading-relaxed">{displayedScan.environmentalCorrelation}</p>
                  </div>

                  {/* Soil Report OCR Side-by-Side Confirmation */}
                  {displayedScan.scanType === 'soil_report_ocr' && displayedScan.ocrSoilValues && (
                    <div className="p-4 rounded-xl bg-[#F7FAFE] border border-[#1769E0]/40 space-y-3">
                      <p className="text-xs font-bold text-[#0B2A5B]">
                        {isAr
                          ? 'قيم تقرير التربة المستخرجة — راجعها ثم اعتمدها في المزرعة'
                          : 'Extracted Soil Report Values — Verify & Apply to Farm'}
                      </p>
                      <div className="grid grid-cols-3 gap-2.5">
                        <div>
                          <label className="block text-[11px] text-[#66758A] mb-1">pH</label>
                          <input
                            type="number"
                            step="0.1"
                            value={ocrPh}
                            onChange={(e) => setOcrPh(e.target.value)}
                            className="w-full rounded-lg border border-[#DCE7F5] bg-white px-2.5 py-1.5 text-xs tabular-nums"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-[#66758A] mb-1">EC (dS/m)</label>
                          <input
                            type="number"
                            step="0.1"
                            value={ocrEc}
                            onChange={(e) => setOcrEc(e.target.value)}
                            className="w-full rounded-lg border border-[#DCE7F5] bg-white px-2.5 py-1.5 text-xs tabular-nums"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-[#66758A] mb-1">{isAr ? 'القوام' : 'Texture'}</label>
                          <select
                            value={ocrTexture}
                            onChange={(e) => setOcrTexture(e.target.value as NonNullable<SoilData['texture']>)}
                            className="w-full rounded-lg border border-[#DCE7F5] bg-white px-2 py-1.5 text-xs"
                          >
                            <option value="unknown">{isAr ? 'غير معروف' : 'Unknown'}</option>
                            <option value="loam">{isAr ? 'طميي' : 'Loam'}</option>
                            <option value="clay_loam">{isAr ? 'طيني طميي' : 'Clay loam'}</option>
                            <option value="silty_loam">{isAr ? 'غريني طميي' : 'Silty loam'}</option>
                            <option value="sandy">{isAr ? 'رملي' : 'Sandy'}</option>
                            <option value="clay">{isAr ? 'طيني' : 'Clay'}</option>
                          </select>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={applyOcrToFarm}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#19A974] text-white text-xs font-semibold hover:bg-[#148a5e] cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{isAr ? 'تأكيد وحفظ في ملف المزرعة' : 'Confirm & Apply Soil Values'}</span>
                      </button>
                      {ocrAppliedMsg && <p className="text-xs text-[#19A974] font-medium">{ocrAppliedMsg}</p>}
                    </div>
                  )}

                  {/* Suggested Next Steps & Limitations */}
                  <div className="grid sm:grid-cols-2 gap-4 pt-1">
                    <div>
                      <h3 className="text-xs font-bold text-[#0B2A5B] mb-1.5">
                        {isAr ? 'الخطوات الميدانية المقترحة' : 'Suggested Verification Steps'}
                      </h3>
                      <ul className="list-disc ps-5 text-xs text-[#12233F] space-y-1">
                        {displayedScan.suggestedNextSteps.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-[#66758A] mb-1.5">
                        {isAr ? 'القيود وعدم اليقين' : 'Limitations'}
                      </h3>
                      <ul className="list-disc ps-5 text-xs text-[#66758A] space-y-1">
                        {displayedScan.limitations.map((l, i) => (
                          <li key={i}>{l}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-[#DCE7F5] flex items-center justify-between text-[11px] text-[#66758A]">
                <span className="inline-flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#1769E0]" />
                  <span>
                    {isAr
                      ? 'يتطلب تحققاً حقلياً · ليس تشخيصاً مخبرياً نهائياً'
                      : 'Requires field verification · Not a definitive lab diagnosis'}
                  </span>
                </span>
                <span className="font-mono tabular-nums">{displayedScan.analyzedAt.slice(0, 16)}</span>
              </div>
            </div>
          )}

          {/* Scan History with Inspect & Delete Controls */}
          {farmScans.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#DCE7F5] p-4 space-y-2.5">
              <h3 className="text-xs font-bold text-[#0B2A5B]">
                {isAr ? `سجل الفحوصات (${farmScans.length})` : `Recorded Scans (${farmScans.length})`}
              </h3>
              <div className="divide-y divide-[#DCE7F5]">
                {farmScans.map((s) => (
                  <div
                    key={s.id}
                    className={`py-2.5 px-2 -mx-2 rounded-lg flex items-center justify-between gap-3 text-xs transition-colors ${
                      displayedScan?.id === s.id ? 'bg-[#EAF3FF]/45' : ''
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedHistoryId(s.id)}
                      className="min-w-0 flex-1 text-start cursor-pointer"
                    >
                      <p className="font-semibold text-[#12233F] truncate">{s.preliminaryAssessment}</p>
                      <p className="text-[11px] text-[#66758A]">
                        {s.scanType} · {s.detectedCropLabel} · {s.confidenceScore}%
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedHistoryId === s.id) setSelectedHistoryId(null);
                        deleteFieldScan(activeFarm.id, s.id);
                      }}
                      aria-label={`Delete scan ${s.imageName}`}
                      className="p-1.5 rounded-lg text-[#66758A] hover:text-[#E45C67] hover:bg-red-50 cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
