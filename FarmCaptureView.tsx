import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Crosshair,
  Edit3,
  Loader2,
  MapPin,
  Mic,
  PenTool,
  RotateCcw,
  ScanLine,
  Sparkles,
  Square,
  Trash2,
  Undo2,
} from 'lucide-react';
import { useFieldShift } from '../context/FieldShiftContext';
import {
  computePolygonAreaHectares,
  computePolygonCentroid,
  computePolygonPerimeterMeters,
  formatArea,
} from '../lib/geo';
import { extractFarmFromNote, transcribeAudioNote } from '../services/aiService';
import {
  CurrentCropOption,
  FarmGoal,
  FarmProfile,
  GeoPoint,
  LocationAccuracyMode,
  PreviousCropOption,
  SeasonOption,
  SoilData,
  WaterAvailability,
} from '../types/fieldshift';
import { FarmMapCanvas } from './FarmMapCanvas';

interface ExtractedChip {
  field: string;
  label: string;
  value: string;
  confirmed: boolean;
}

export function FarmCaptureView() {
  const {
    language,
    mapsApiKey,
    activeFarm,
    saveFarm,
    deleteFarm,
    fetchEarthIntelligence,
    setActiveSection,
    user,
  } = useFieldShift();

  const isAr = language === 'ar';
  const [confirmDeleteFarm, setConfirmDeleteFarm] = useState(false);

  // Form state initialized from activeFarm if editing, or clean blank state (zero fake preloads)
  const [farmName, setFarmName] = useState(activeFarm?.name || '');
  const [locationLabel, setLocationLabel] = useState(activeFarm?.locationLabel || '');
  const [center, setCenter] = useState<GeoPoint | null>(
    activeFarm ? { lat: activeFarm.centerLat, lng: activeFarm.centerLng } : null
  );
  const [boundary, setBoundary] = useState<GeoPoint[]>(activeFarm?.boundary || []);
  const [interactionMode, setInteractionMode] = useState<'point' | 'polygon'>(
    activeFarm?.boundary?.length ? 'polygon' : 'point'
  );
  const [accuracyMode, setAccuracyMode] = useState<LocationAccuracyMode>(
    activeFarm?.locationAccuracyMode || 'point'
  );
  const [gpsAccuracyMeters, setGpsAccuracyMeters] = useState<number | undefined>(
    activeFarm?.locationAccuracyMeters
  );
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'loading' | 'error' | 'denied'>('idle');
  const [gpsErrorMsg, setGpsErrorMsg] = useState<string | null>(null);

  const [previousCrop, setPreviousCrop] = useState<PreviousCropOption>(
    activeFarm?.previousCrop || 'unknown'
  );
  const [currentCrop, setCurrentCrop] = useState<CurrentCropOption>(
    activeFarm?.currentCrop || 'none'
  );
  const [season, setSeason] = useState<SeasonOption>(activeFarm?.season || 'winter');
  const [waterAvailability, setWaterAvailability] = useState<WaterAvailability>(
    activeFarm?.waterAvailability || 'moderate'
  );
  const [goal, setGoal] = useState<FarmGoal>(activeFarm?.goal || 'yield_stability');

  // Optional Soil inputs
  const [showSoilInputs, setShowSoilInputs] = useState(Boolean(activeFarm?.soilData));
  const [soilPh, setSoilPh] = useState<string>(
    activeFarm?.soilData?.ph !== undefined ? String(activeFarm.soilData.ph) : ''
  );
  const [soilEc, setSoilEc] = useState<string>(
    activeFarm?.soilData?.ecSalinityDsM !== undefined ? String(activeFarm.soilData.ecSalinityDsM) : ''
  );
  const [soilTexture, setSoilTexture] = useState<NonNullable<SoilData['texture']>>(
    activeFarm?.soilData?.texture || 'unknown'
  );

  // Natural Language & Voice input
  const [inputTab, setInputTab] = useState<'quick' | 'text' | 'voice'>('quick');
  const [nlText, setNlText] = useState('');
  const [aiExtracting, setAiExtracting] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [clarificationQ, setClarificationQ] = useState<string | null>(null);
  const [extractedChips, setExtractedChips] = useState<ExtractedChip[]>([]);

  // Voice recording
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Capture Review state
  const [reviewStep, setReviewStep] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const calculatedAreaHa = useMemo(() => {
    if (boundary.length >= 3) {
      return computePolygonAreaHectares(boundary);
    }
    return undefined;
  }, [boundary]);

  const calculatedPerimeterM = useMemo(() => {
    if (boundary.length >= 3) {
      return computePolygonPerimeterMeters(boundary);
    }
    return undefined;
  }, [boundary]);

  const effectiveCenter = useMemo(() => {
    if (boundary.length >= 3) {
      return computePolygonCentroid(boundary) || center;
    }
    return center;
  }, [boundary, center]);

  const handleUseDeviceGps = () => {
    if (!navigator.geolocation) {
      setGpsStatus('error');
      setGpsErrorMsg('Geolocation is not supported by your browser.');
      return;
    }
    setGpsStatus('loading');
    setGpsErrorMsg(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const pt = {
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
        };
        setCenter(pt);
        setAccuracyMode('gps');
        setGpsAccuracyMeters(Math.round(pos.coords.accuracy));
        setGpsStatus('idle');
        try {
          const r = await fetch(`/api/geocode?lat=${pt.lat}&lng=${pt.lng}`);
          const d = await r.json();
          if (r.ok && d.formattedAddress) setLocationLabel(d.formattedAddress);
          else setLocationLabel(`${pt.lat.toFixed(4)}, ${pt.lng.toFixed(4)}`);
        } catch {
          setLocationLabel(`${pt.lat.toFixed(4)}, ${pt.lng.toFixed(4)}`);
        }
      },
      (err) => {
        setGpsStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'error');
        setGpsErrorMsg(
          err.code === err.PERMISSION_DENIED
            ? isAr
              ? 'تم رفض إذن الموقع. يمكنك البحث عن موقعك أو النقر على الخريطة.'
              : 'Location permission denied. Search by place name or click the map instead.'
            : err.message
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleParseNaturalLanguage = async () => {
    if (!nlText.trim()) return;
    setAiExtracting(true);
    setAiError(null);
    setClarificationQ(null);
    try {
      const extracted = await extractFarmFromNote(nlText);
      applyExtractedProposal(extracted);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Extraction failed');
    } finally {
      setAiExtracting(false);
    }
  };

  const applyExtractedProposal = async (ext: any) => {
    const chips: ExtractedChip[] = [];
    if (ext.farmName) {
      chips.push({ field: 'farmName', label: 'Farm Name', value: ext.farmName, confirmed: true });
      if (!farmName) setFarmName(ext.farmName);
    }
    if (ext.previousCrop && ext.previousCrop !== 'unknown') {
      chips.push({ field: 'previousCrop', label: 'Previous Crop', value: ext.previousCrop, confirmed: true });
      setPreviousCrop(ext.previousCrop);
    }
    if (ext.currentCrop && ext.currentCrop !== 'unknown') {
      chips.push({ field: 'currentCrop', label: 'Current Crop', value: ext.currentCrop, confirmed: true });
      setCurrentCrop(ext.currentCrop);
    }
    if (ext.season && ext.season !== 'unknown') {
      chips.push({ field: 'season', label: 'Target Season', value: ext.season, confirmed: true });
      setSeason(ext.season);
    }
    if (ext.waterAvailability && ext.waterAvailability !== 'unknown') {
      chips.push({
        field: 'waterAvailability',
        label: 'Water Availability',
        value: ext.waterAvailability,
        confirmed: true,
      });
      setWaterAvailability(ext.waterAvailability);
    }
    if (ext.goal && ext.goal !== 'unknown') {
      chips.push({ field: 'goal', label: 'Goal', value: ext.goal, confirmed: true });
      setGoal(ext.goal);
    }
    if (typeof ext.soilPh === 'number') {
      chips.push({ field: 'soilPh', label: 'Soil pH', value: String(ext.soilPh), confirmed: false });
      setShowSoilInputs(true);
      setSoilPh(String(ext.soilPh));
    }
    if (typeof ext.soilEcDsM === 'number') {
      chips.push({ field: 'soilEc', label: 'Soil EC (dS/m)', value: String(ext.soilEcDsM), confirmed: false });
      setShowSoilInputs(true);
      setSoilEc(String(ext.soilEcDsM));
    }
    if (ext.locationQuery) {
      chips.push({ field: 'locationQuery', label: 'Mentioned Location', value: ext.locationQuery, confirmed: true });
      try {
        const gRes = await fetch(`/api/geocode?q=${encodeURIComponent(ext.locationQuery)}`);
        const gData = await gRes.json();
        if (gRes.ok && typeof gData.lat === 'number') {
          setCenter({ lat: gData.lat, lng: gData.lng });
          setLocationLabel(gData.formattedAddress || ext.locationQuery);
          setAccuracyMode('approximate');
        }
      } catch {
        // Ignore geocode failure, user can locate manually
      }
    }
    setExtractedChips(chips);
    if (ext.clarificationQuestion) {
      setClarificationQ(ext.clarificationQuestion);
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }
    setAiError(null);
    setTranscript(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const dataUrl = String(reader.result || '');
          const base64 = dataUrl.split(',')[1] || '';
          setAiExtracting(true);
          try {
            const data = await transcribeAudioNote(base64, blob.type || 'audio/webm');
            setTranscript(data.transcript);
            await applyExtractedProposal(data.extracted);
          } catch (err) {
            setAiError(err instanceof Error ? err.message : 'Transcription error');
          } finally {
            setAiExtracting(false);
          }
        };
        reader.readAsDataURL(blob);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch {
      setAiError(
        isAr
          ? 'تم رفض الوصول للميكروفون أو غير متاح. يمكنك الكتابة في تبويب النص.'
          : 'Microphone permission denied or unavailable. Use the Text tab instead.'
      );
    }
  };

  const handleConfirmAndSave = async () => {
    if (!effectiveCenter) {
      setSaveError(
        isAr
          ? 'يرجى تحديد موقع المزرعة على الخريطة أو عبر البحث أولاً.'
          : 'Please locate your farm on the map or via search before saving.'
      );
      return;
    }
    setSaving(true);
    setSaveError(null);

    const parsedPh = soilPh.trim() !== '' ? Number(soilPh) : undefined;
    const parsedEc = soilEc.trim() !== '' ? Number(soilEc) : undefined;
    const hasSoil =
      (parsedPh !== undefined && !Number.isNaN(parsedPh)) ||
      (parsedEc !== undefined && !Number.isNaN(parsedEc)) ||
      soilTexture !== 'unknown';

    const farmObj: FarmProfile = {
      id: activeFarm?.id || `farm_${Date.now()}`,
      ownerId: user?.uid,
      name:
        farmName.trim() ||
        (locationLabel ? `${locationLabel.split(',')[0]} Parcel` : `Parcel ${effectiveCenter.lat.toFixed(2)}, ${effectiveCenter.lng.toFixed(2)}`),
      locationLabel: locationLabel || `${effectiveCenter.lat.toFixed(4)}, ${effectiveCenter.lng.toFixed(4)}`,
      centerLat: effectiveCenter.lat,
      centerLng: effectiveCenter.lng,
      locationAccuracyMode: boundary.length >= 3 ? 'polygon' : accuracyMode,
      locationAccuracyMeters: gpsAccuracyMeters,
      boundary: boundary.length >= 3 ? boundary : undefined,
      areaHectares: calculatedAreaHa,
      previousCrop,
      currentCrop,
      season,
      waterAvailability,
      goal,
      soilData: hasSoil
        ? {
            ph: parsedPh !== undefined && !Number.isNaN(parsedPh) ? parsedPh : undefined,
            ecSalinityDsM: parsedEc !== undefined && !Number.isNaN(parsedEc) ? parsedEc : undefined,
            texture: soilTexture,
            source: 'user-provided data',
            recordedAt: new Date().toISOString(),
          }
        : undefined,
      createdAt: activeFarm?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await saveFarm(farmObj);
      await fetchEarthIntelligence(farmObj);
      setReviewStep(false);
      setActiveSection('earth');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save farm');
    } finally {
      setSaving(false);
    }
  };

  const missingImportantFields = useMemo(() => {
    const m: string[] = [];
    if (boundary.length < 3) m.push(isAr ? 'مضلع حدود المزرعة (لحساب المساحة بدقة)' : 'Drawn farm boundary polygon (for real area calculation)');
    if (previousCrop === 'unknown') m.push(isAr ? 'المحصول السابق' : 'Previous season crop');
    if (soilPh === '' && soilEc === '' && soilTexture === 'unknown') {
      m.push(isAr ? 'تحليل التربة (pH / الملوحة / القوام)' : 'Soil lab values (pH, EC salinity, texture)');
    }
    return m;
  }, [boundary.length, previousCrop, soilPh, soilEc, soilTexture, isAr]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0B2A5B] tracking-tight">
            {isAr ? 'تسجيل المزرعة والبيانات الأولية' : 'Farm Capture'}
          </h1>
          <p className="text-sm text-[#66758A] mt-1">
            {isAr
              ? 'ابدأ بتحديد الموقع أو رسم الحدود، ثم أضف سياق الموسم والمياه.'
              : 'Locate your parcel, optionally draw its boundary for exact hectares, and confirm field context.'}
          </p>
        </div>

        {activeFarm && (
          <div className="flex flex-wrap items-center gap-2 self-start">
            <button
              type="button"
              onClick={() => {
                setFarmName('');
                setLocationLabel('');
                setCenter(null);
                setBoundary([]);
                setPreviousCrop('unknown');
                setCurrentCrop('none');
                setSoilPh('');
                setSoilEc('');
                setSoilTexture('unknown');
                setExtractedChips([]);
                setReviewStep(false);
                setConfirmDeleteFarm(false);
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[#DCE7F5] bg-white text-xs font-semibold text-[#12233F] hover:border-[#1769E0] transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{isAr ? 'مسح الحقول لمزرعة جديدة' : 'Start Fresh Parcel'}</span>
            </button>

            {!confirmDeleteFarm ? (
              <button
                type="button"
                onClick={() => setConfirmDeleteFarm(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-red-200 bg-white text-xs font-semibold text-[#E45C67] hover:bg-red-50 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isAr ? 'حذف المزرعة الحالية' : 'Delete Parcel'}</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-50 border border-red-200 text-xs">
                <span className="text-[#E45C67] font-semibold">
                  {isAr ? `حذف "${activeFarm.name}"؟` : `Delete "${activeFarm.name}"?`}
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    await deleteFarm(activeFarm.id);
                    setConfirmDeleteFarm(false);
                    setFarmName('');
                    setLocationLabel('');
                    setCenter(null);
                    setBoundary([]);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-[#E45C67] text-white font-semibold cursor-pointer"
                >
                  {isAr ? 'تأكيد' : 'Confirm'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteFarm(false)}
                  className="px-2 py-1 rounded-lg bg-white border border-[#DCE7F5] text-[#66758A] cursor-pointer"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main 2-Column Capture Grid */}
      <div className="grid lg:grid-cols-12 gap-6 items-start">
        {/* Left: Geospatial Boundary & Location */}
        <section className="lg:col-span-7 bg-white rounded-2xl border border-[#DCE7F5] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold text-[#0B2A5B]">
              {isAr ? '1. الموقع الجغرافي وحدود الحقل' : '1. Parcel Location & Boundary'}
            </h2>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleUseDeviceGps}
                disabled={gpsStatus === 'loading'}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#EAF3FF] text-[#1769E0] text-xs font-semibold hover:bg-[#1769E0] hover:text-white transition-colors cursor-pointer"
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span>
                  {gpsStatus === 'loading'
                    ? isAr
                      ? 'جارٍ التحديد...'
                      : 'Locating...'
                    : isAr
                    ? 'استخدام موقعي'
                    : 'Use Device GPS'}
                </span>
              </button>

              <div className="inline-flex p-0.5 rounded-lg bg-[#F7FAFE] border border-[#DCE7F5]">
                <button
                  type="button"
                  onClick={() => setInteractionMode('point')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer ${
                    interactionMode === 'point'
                      ? 'bg-white text-[#1769E0] shadow-xs font-semibold'
                      : 'text-[#66758A]'
                  }`}
                >
                  <MapPin className="w-3 h-3" />
                  <span>{isAr ? 'نقطة' : 'Drop Pin'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInteractionMode('polygon')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer ${
                    interactionMode === 'polygon'
                      ? 'bg-white text-[#1769E0] shadow-xs font-semibold'
                      : 'text-[#66758A]'
                  }`}
                >
                  <PenTool className="w-3 h-3" />
                  <span>{isAr ? 'رسم الحدود' : 'Draw Boundary'}</span>
                </button>
              </div>
            </div>
          </div>

          {gpsErrorMsg && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
              {gpsErrorMsg}
            </div>
          )}

          <FarmMapCanvas
            apiKey={mapsApiKey}
            center={effectiveCenter}
            boundary={boundary}
            interactionMode={interactionMode}
            onSetPoint={(pt) => {
              setCenter(pt);
              setAccuracyMode('point');
              setLocationLabel(`${pt.lat.toFixed(4)}, ${pt.lng.toFixed(4)}`);
            }}
            onUpdateBoundary={(pts) => {
              setBoundary(pts);
              if (pts.length >= 1 && !center) setCenter(pts[0]);
              setAccuracyMode('polygon');
            }}
            language={language}
            searchPlaceholder={
              isAr
                ? 'ابحث عن قرية أو مدينة أو منطقة زراعية...'
                : 'Search village, district, or coordinates...'
            }
            onSelectSearchPlace={(loc) => {
              setCenter({ lat: loc.lat, lng: loc.lng });
              setLocationLabel(loc.label);
              setAccuracyMode('approximate');
            }}
          />

          {/* Drawing Controls & Real Polygon Geometry Summary */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs">
            <div className="text-[#66758A] space-y-0.5">
              {interactionMode === 'polygon' ? (
                <p>
                  {isAr
                    ? `انقر على الخريطة لإضافة زوايا الحقل (${boundary.length} نقطة).`
                    : `Click on the map to add boundary corners (${boundary.length} points placed).`}
                </p>
              ) : (
                <p>
                  {isAr
                    ? 'انقر على الخريطة لتثبيت موقع المزرعة أو بدّل إلى "رسم الحدود" لحساب المساحة.'
                    : 'Click on the map to pin your farm, or switch to Draw Boundary to calculate exact hectares.'}
                </p>
              )}
              {effectiveCenter && (
                <p className="font-mono tabular-nums text-[#12233F]">
                  {effectiveCenter.lat.toFixed(5)}, {effectiveCenter.lng.toFixed(5)} ·{' '}
                  <span className="font-sans text-[#66758A]">
                    {boundary.length >= 3
                      ? `Polygon (${formatArea(calculatedAreaHa)}${
                          calculatedPerimeterM ? ` · ${calculatedPerimeterM} m perimeter` : ''
                        })`
                      : accuracyMode === 'gps' && gpsAccuracyMeters
                      ? `Device GPS (±${gpsAccuracyMeters}m)`
                      : accuracyMode === 'approximate'
                      ? 'Approximate location (draw boundary for exact parcel area)'
                      : 'Pinned point'}
                  </span>
                </p>
              )}
            </div>

            {boundary.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBoundary((b) => b.slice(0, -1))}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#DCE7F5] text-[#12233F] hover:bg-[#F7FAFE] cursor-pointer"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  <span>{isAr ? 'تراجع' : 'Undo'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBoundary([])}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#DCE7F5] text-[#E45C67] hover:bg-red-50 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isAr ? 'مسح' : 'Clear'}</span>
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Right: Multi-Modal Field Context Capture */}
        <section className="lg:col-span-5 bg-white rounded-2xl border border-[#DCE7F5] p-5 space-y-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold text-[#0B2A5B]">
              {isAr ? '2. سياق الحقل والمدخلات' : '2. Field Context'}
            </h2>

            {/* Input Mode Tabs */}
            <div className="inline-flex p-0.5 rounded-lg bg-[#F7FAFE] border border-[#DCE7F5]">
              {(
                [
                  { id: 'quick', label: isAr ? 'اختيارات' : 'Quick' },
                  { id: 'text', label: isAr ? 'نص طبيعي' : 'Text' },
                  { id: 'voice', label: isAr ? 'صوت' : 'Voice' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setInputTab(tab.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer ${
                    inputTab === tab.id
                      ? 'bg-white text-[#1769E0] shadow-xs font-semibold'
                      : 'text-[#66758A]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Natural Language Input Mode */}
          {inputTab === 'text' && (
            <div className="space-y-3 p-3.5 rounded-xl bg-[#F7FAFE] border border-[#DCE7F5]">
              <label htmlFor="nl-farm-input" className="block text-xs font-semibold text-[#0B2A5B]">
                {isAr
                  ? 'صف مزرعتك بالعربية أو الإنجليزية (الموقع، المساحة، المحصول السابق، المياه، الهدف)'
                  : 'Describe your field in plain English or Arabic'}
              </label>
              <textarea
                id="nl-farm-input"
                rows={3}
                value={nlText}
                onChange={(e) => setNlText(e.target.value)}
                placeholder={
                  isAr
                    ? 'مثال: أرض 5 هكتار في الدقهلية، المحصول السابق قمح، المياه محدودة وأريد زراعة محصول صيفي موفر للماء.'
                    : 'e.g., 8 hectare parcel near Konya, harvested wheat last season, limited irrigation for summer, goal is drought resilience.'
                }
                className="w-full rounded-xl border border-[#DCE7F5] bg-white p-3 text-xs text-[#12233F] focus:outline-none focus:border-[#1769E0]"
              />
              <button
                type="button"
                onClick={handleParseNaturalLanguage}
                disabled={aiExtracting || !nlText.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1769E0] text-white text-xs font-semibold hover:bg-[#0B2A5B] disabled:opacity-50 cursor-pointer"
              >
                {aiExtracting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>{isAr ? 'استخراج الحقول للمراجعة' : 'Extract Facts for Confirmation'}</span>
              </button>
            </div>
          )}

          {/* Voice Recording Input Mode */}
          {inputTab === 'voice' && (
            <div className="space-y-3 p-4 rounded-xl bg-[#F7FAFE] border border-[#DCE7F5] text-center">
              <p className="text-xs text-[#66758A]">
                {isAr
                  ? 'سجل رسالة صوتية بالعربية أو الإنجليزية تصف موقعك، المحصول السابق، وحالة المياه.'
                  : 'Record a short Arabic or English voice note describing your crop history, season, and water availability.'}
              </p>
              <button
                type="button"
                onClick={toggleRecording}
                disabled={aiExtracting}
                className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  isRecording
                    ? 'bg-[#E45C67] text-white'
                    : 'bg-[#1769E0] text-white hover:bg-[#0B2A5B]'
                }`}
              >
                {isRecording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                <span>
                  {isRecording
                    ? isAr
                      ? 'إيقاف وتحليل التسجيل'
                      : 'Stop & Transcribe'
                    : isAr
                    ? 'بدء التسجيل الصوتي'
                    : 'Start Voice Recording'}
                </span>
              </button>
              {aiExtracting && (
                <p className="text-xs text-[#1769E0] flex items-center justify-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{isAr ? 'جارٍ تفريغ الصوت...' : 'Transcribing with Gemini...'}</span>
                </p>
              )}
              {transcript && (
                <div className="text-start p-3 rounded-lg bg-white border border-[#DCE7F5] text-xs text-[#12233F]">
                  <span className="font-semibold text-[#0B2A5B]">Transcript: </span>
                  {transcript}
                </div>
              )}
            </div>
          )}

          {aiError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-[#E45C67]">
              {aiError}
            </div>
          )}

          {clarificationQ && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
              <span className="font-semibold">{isAr ? 'سؤال توضيحي: ' : 'Clarification needed: '}</span>
              {clarificationQ}
            </div>
          )}

          {extractedChips.length > 0 && (
            <div className="p-3 rounded-xl bg-[#EAF3FF]/60 border border-[#DCE7F5] space-y-2">
              <p className="text-[11px] font-semibold text-[#0B2A5B]">
                {isAr
                  ? 'قيم مستخرجة — يرجى التأكيد أو التعديل أدناه قبل الحفظ:'
                  : 'AI-extracted proposals — confirm or adjust below before saving:'}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {extractedChips.map((chip, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() =>
                      setExtractedChips((prev) =>
                        prev.map((c, idx) => (idx === i ? { ...c, confirmed: !c.confirmed } : c))
                      )
                    }
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium border cursor-pointer ${
                      chip.confirmed
                        ? 'bg-white border-[#19A974] text-[#12233F]'
                        : 'bg-amber-50 border-amber-300 text-amber-900'
                    }`}
                  >
                    <Check className={`w-3 h-3 ${chip.confirmed ? 'text-[#19A974]' : 'text-amber-600'}`} />
                    <span>
                      {chip.label}: <strong>{chip.value}</strong>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Structured Confirmable Controls */}
          <div className="space-y-3.5">
            <div>
              <label htmlFor="farm-name-input" className="block text-xs font-semibold text-[#12233F] mb-1">
                {isAr ? 'اسم المزرعة أو القطعة' : 'Parcel Name'}
              </label>
              <input
                id="farm-name-input"
                type="text"
                value={farmName}
                onChange={(e) => setFarmName(e.target.value)}
                placeholder={isAr ? 'مثال: الحقل الشمالي' : 'e.g., North Pivot Parcel'}
                className="w-full rounded-xl border border-[#DCE7F5] px-3 py-2 text-sm focus:outline-none focus:border-[#1769E0]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="season-select" className="block text-xs font-semibold text-[#12233F] mb-1">
                  {isAr ? 'الموسم المستهدف' : 'Target Season'}
                </label>
                <select
                  id="season-select"
                  value={season}
                  onChange={(e) => setSeason(e.target.value as SeasonOption)}
                  className="w-full rounded-xl border border-[#DCE7F5] bg-white px-3 py-2 text-xs font-medium"
                >
                  <option value="winter">{isAr ? 'شتوي' : 'Winter'}</option>
                  <option value="spring">{isAr ? 'ربيعي' : 'Spring'}</option>
                  <option value="summer">{isAr ? 'صيفي' : 'Summer'}</option>
                  <option value="autumn">{isAr ? 'خريفي' : 'Autumn'}</option>
                </select>
              </div>

              <div>
                <label htmlFor="water-select" className="block text-xs font-semibold text-[#12233F] mb-1">
                  {isAr ? 'توفر المياه' : 'Water Availability'}
                </label>
                <select
                  id="water-select"
                  value={waterAvailability}
                  onChange={(e) => setWaterAvailability(e.target.value as WaterAvailability)}
                  className="w-full rounded-xl border border-[#DCE7F5] bg-white px-3 py-2 text-xs font-medium"
                >
                  <option value="abundant">{isAr ? 'وفيرة' : 'Abundant'}</option>
                  <option value="moderate">{isAr ? 'متوسطة' : 'Moderate'}</option>
                  <option value="limited">{isAr ? 'محدودة' : 'Limited'}</option>
                  <option value="scarce">{isAr ? 'شحيحة' : 'Scarce'}</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="prev-crop-select" className="block text-xs font-semibold text-[#12233F] mb-1">
                  {isAr ? 'المحصول السابق' : 'Previous Crop'}
                </label>
                <select
                  id="prev-crop-select"
                  value={previousCrop}
                  onChange={(e) => setPreviousCrop(e.target.value as PreviousCropOption)}
                  className="w-full rounded-xl border border-[#DCE7F5] bg-white px-3 py-2 text-xs font-medium"
                >
                  <option value="unknown">{isAr ? 'غير معروف' : 'Unknown'}</option>
                  <option value="wheat">{isAr ? 'القمح (Wheat)' : 'Wheat'}</option>
                  <option value="rice">{isAr ? 'الأرز (Rice)' : 'Rice'}</option>
                  <option value="faba_beans">{isAr ? 'الفول البلدي (Faba Beans)' : 'Faba Beans'}</option>
                  <option value="cotton">{isAr ? 'القطن (Cotton)' : 'Cotton'}</option>
                  <option value="maize">{isAr ? 'الذرة الشامية (Maize)' : 'Maize'}</option>
                  <option value="fallow">{isAr ? 'أرض مستريحة (بور)' : 'Fallow'}</option>
                </select>
              </div>

              <div>
                <label htmlFor="curr-crop-select" className="block text-xs font-semibold text-[#12233F] mb-1">
                  {isAr ? 'المحصول الحالي' : 'Current Crop'}
                </label>
                <select
                  id="curr-crop-select"
                  value={currentCrop}
                  onChange={(e) => setCurrentCrop(e.target.value as CurrentCropOption)}
                  className="w-full rounded-xl border border-[#DCE7F5] bg-white px-3 py-2 text-xs font-medium"
                >
                  <option value="none">{isAr ? 'غير مزروع حالياً' : 'None / Preparing'}</option>
                  <option value="unknown">{isAr ? 'غير معروف' : 'Unknown'}</option>
                  <option value="wheat">{isAr ? 'القمح (Wheat)' : 'Wheat'}</option>
                  <option value="rice">{isAr ? 'الأرز (Rice)' : 'Rice'}</option>
                  <option value="faba_beans">{isAr ? 'الفول البلدي (Faba Beans)' : 'Faba Beans'}</option>
                  <option value="cotton">{isAr ? 'القطن (Cotton)' : 'Cotton'}</option>
                  <option value="maize">{isAr ? 'الذرة الشامية (Maize)' : 'Maize'}</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="goal-select" className="block text-xs font-semibold text-[#12233F] mb-1">
                {isAr ? 'الهدف الزراعي الأساسي' : 'Primary Farming Goal'}
              </label>
              <select
                id="goal-select"
                value={goal}
                onChange={(e) => setGoal(e.target.value as FarmGoal)}
                className="w-full rounded-xl border border-[#DCE7F5] bg-white px-3 py-2 text-xs font-medium"
              >
                <option value="yield_stability">{isAr ? 'استقرار الإنتاج' : 'Yield Stability'}</option>
                <option value="water_conservation">{isAr ? 'توفير المياه' : 'Water Conservation'}</option>
                <option value="drought_resilience">{isAr ? 'مقاومة الجفاف' : 'Drought Resilience'}</option>
                <option value="soil_recovery">{isAr ? 'استعادة خصوبة التربة' : 'Soil Fertility Recovery'}</option>
                <option value="forage_production">{isAr ? 'إنتاج الأعلاف' : 'Forage Production'}</option>
              </select>
            </div>

            {/* Optional Soil Toggle */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowSoilInputs(!showSoilInputs)}
                className="text-xs font-semibold text-[#1769E0] hover:underline cursor-pointer"
              >
                {showSoilInputs
                  ? isAr
                    ? 'إخفاء بيانات التربة الاختيارية'
                    : 'Hide optional soil data'
                  : isAr
                  ? '+ إضافة نتائج التربة (اختياري — أو استخدم OCR لاحقاً)'
                  : '+ Add optional soil test values (or scan lab report later)'}
              </button>

              {showSoilInputs && (
                <div className="mt-3 grid grid-cols-3 gap-2.5 p-3 rounded-xl bg-[#F7FAFE] border border-[#DCE7F5]">
                  <div>
                    <label htmlFor="soil-ph" className="block text-[11px] font-medium text-[#66758A] mb-1">
                      pH
                    </label>
                    <input
                      id="soil-ph"
                      type="number"
                      step="0.1"
                      min="3"
                      max="10"
                      value={soilPh}
                      onChange={(e) => setSoilPh(e.target.value)}
                      placeholder="6.8"
                      className="w-full rounded-lg border border-[#DCE7F5] bg-white px-2.5 py-1.5 text-xs tabular-nums"
                    />
                  </div>
                  <div>
                    <label htmlFor="soil-ec" className="block text-[11px] font-medium text-[#66758A] mb-1">
                      EC (dS/m)
                    </label>
                    <input
                      id="soil-ec"
                      type="number"
                      step="0.1"
                      min="0"
                      max="25"
                      value={soilEc}
                      onChange={(e) => setSoilEc(e.target.value)}
                      placeholder="1.5"
                      className="w-full rounded-lg border border-[#DCE7F5] bg-white px-2.5 py-1.5 text-xs tabular-nums"
                    />
                  </div>
                  <div>
                    <label htmlFor="soil-texture" className="block text-[11px] font-medium text-[#66758A] mb-1">
                      {isAr ? 'القوام' : 'Texture'}
                    </label>
                    <select
                      id="soil-texture"
                      value={soilTexture}
                      onChange={(e) => setSoilTexture(e.target.value as NonNullable<SoilData['texture']>)}
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
              )}
            </div>
          </div>

          {saveError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-[#E45C67]">
              {saveError}
            </div>
          )}

          {/* Action to open Capture Review Panel */}
          {!reviewStep ? (
            <button
              type="button"
              onClick={() => {
                if (!effectiveCenter) {
                  setSaveError(
                    isAr
                      ? 'يرجى تحديد موقع المزرعة على الخريطة أو عبر البحث أولاً.'
                      : 'Please locate your farm on the map or search first.'
                  );
                  return;
                }
                setSaveError(null);
                setReviewStep(true);
              }}
              className="w-full py-3 px-4 rounded-xl bg-[#1769E0] text-white text-sm font-semibold hover:bg-[#0B2A5B] transition-colors cursor-pointer"
            >
              {isAr ? 'مراجعة البيانات قبل الحفظ' : 'Review & Confirm Capture'}
            </button>
          ) : (
            <div className="p-4 rounded-xl bg-[#F7FAFE] border border-[#1769E0]/40 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-[#0B2A5B]">
                  {isAr ? 'مراجعة المدخلات والمصادر' : 'Capture Review Summary'}
                </h3>
                <button
                  type="button"
                  onClick={() => setReviewStep(false)}
                  className="inline-flex items-center gap-1 text-xs text-[#1769E0] hover:underline cursor-pointer"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>{isAr ? 'تعديل' : 'Edit'}</span>
                </button>
              </div>

              <div className="space-y-1.5 text-xs text-[#12233F]">
                <p>
                  <span className="text-[#66758A]">{isAr ? 'الموقع: ' : 'Location (user/map): '}</span>
                  <span className="font-mono tabular-nums">
                    {effectiveCenter?.lat.toFixed(4)}, {effectiveCenter?.lng.toFixed(4)}
                  </span>
                </p>
                {calculatedAreaHa !== undefined && (
                  <p>
                    <span className="text-[#66758A]">{isAr ? 'المساحة المحسوبة من المضلع: ' : 'Polygon Geometry Area: '}</span>
                    <strong className="tabular-nums">{formatArea(calculatedAreaHa)}</strong>
                  </p>
                )}
                <p>
                  <span className="text-[#66758A]">{isAr ? 'مدخلات مؤكدة من المستخدم: ' : 'User-Confirmed Inputs: '}</span>
                  {season} · {waterAvailability} water · prev: {previousCrop}
                </p>
              </div>

              {missingImportantFields.length > 0 && (
                <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900 space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {isAr
                        ? 'بيانات مفقودة (سيتم حساب تقييم مبدئي مع بيان مستوى الثقة):'
                        : 'Missing fields (limited recommendation will state lower confidence):'}
                    </span>
                  </div>
                  <ul className="list-disc ps-4">
                    {missingImportantFields.map((m, idx) => (
                      <li key={idx}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                type="button"
                onClick={handleConfirmAndSave}
                disabled={saving}
                className="w-full py-2.5 px-4 rounded-xl bg-[#19A974] text-white text-sm font-semibold hover:bg-[#148a5e] transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>
                  {saving
                    ? isAr
                      ? 'جارٍ الحفظ وجلب بيانات ناسا...'
                      : 'Saving & Connecting NASA POWER...'
                    : isAr
                    ? 'تأكيد وحفظ المزرعة'
                    : 'Confirm & Connect Earth Intelligence'}
                </span>
              </button>
            </div>
          )}
        </section>
      </div>

      {/* ── Field Scan Section (embedded) ──────────────────────────── */}
      <div className="mt-6">
        <EmbeddedFieldScan language={language} />
      </div>
    </div>
  );
}

/* ===== Embedded Field Scan Panel ===== */
import { AiFieldScanView } from './AiFieldScanView';
import { Language } from '../types/fieldshift';

function EmbeddedFieldScan({ language }: { language: Language }) {
  const isAr = language === 'ar';
  const [open, setOpen] = React.useState(false);

  return (
    <div className="rounded-2xl border border-[#DCE7F5] bg-[#F7FAFE] overflow-hidden">
      {/* Toggle header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-[#0B2A5B] hover:bg-[#EAF3FF] transition-colors duration-200 cursor-pointer"
      >
        <span className="flex items-center gap-2.5">
          <ScanLine className="w-4 h-4 text-[#1769E0]" />
          <span>{isAr ? 'فحص الحقل وتحليل التربة' : 'Field Scan & Soil Analysis'}</span>
        </span>
        <span
          className={`w-5 h-5 flex items-center justify-center rounded-full border border-[#DCE7F5] text-[#1769E0] transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
        >
          <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3">
            <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      {/* Content */}
      {open && (
        <div className="border-t border-[#DCE7F5] fs-view-transition">
          <AiFieldScanView embedded />
        </div>
      )}
    </div>
  );
}
