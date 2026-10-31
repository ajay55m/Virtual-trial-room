import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  CheckCircle2, 
  RotateCcw, 
  Send, 
  QrCode, 
  ShieldCheck, 
  Layers, 
  Sliders, 
  Download, 
  RefreshCw, 
  Bot, 
  Sun, 
  Moon, 
  Activity,
  SlidersHorizontal,
  Upload,
  ChevronLeft,
  ChevronRight,
  Scissors,
  Ruler,
  Plus
} from 'lucide-react';

import type { Garment, SizeRecommendation, BodyMeasurements } from '../types/kiosk';
import { MOCK_GARMENTS } from '../data/mockGarments';
import { kioskAudio } from '../utils/audio';
import { apiService, type GarmentTuningOptions } from '../services/api';
import { StyleAssistant } from './StyleAssistant';
import { isValidUploadFile, processFileToDataUrl } from '../utils/fileUploadHelper';
import { useBodyTryOn } from '../features/body-fit/useBodyTryOn';

interface ResultViewProps {
  sessionId?: string;
  originalPhotoUri: string;
  tryonResultUri?: string;
  sizeRecommendation?: SizeRecommendation;
  garment: Garment;
  selectedGarments?: Garment[];
  tryonResultsMap?: Record<string, string>;
  userMeasurements?: BodyMeasurements;
  userHeightCm?: number;
  selectedSize: string;
  onTryAnother: () => void;
  onFinishSession: () => void;
  onAddGarmentToFeed?: (garment: Garment) => void;
}

export const ResultView: React.FC<ResultViewProps> = ({
  sessionId = 'sess_demo',
  originalPhotoUri,
  tryonResultUri,
  sizeRecommendation: _sizeRecommendation,
  garment,
  selectedGarments,
  tryonResultsMap = {},
  userMeasurements,
  userHeightCm = 175,
  selectedSize,
  onTryAnother,
  onFinishSession,
  onAddGarmentToFeed
}) => {
  // Multi-garment carousel state (Step 4 & Saree Carousel)
  const [garmentsList, setGarmentsList] = useState<Garment[]>(() => {
    if (selectedGarments && selectedGarments.length > 0) {
      return selectedGarments;
    }
    return [garment];
  });
  const [activeGarmentIndex, setActiveGarmentIndex] = useState<number>(0);
  const activeGarment = garmentsList[activeGarmentIndex] || garment;

  // Body-Fit AI Try-On Hook (Flexible for any girl)
  const { 
    handleUpload: handleBodyUpload, 
    wearOnMyBody, 
    bodyFitResult, 
    personPreview, 
    isGenerating: bodyFitLoading,
    bodyProfile
  } = useBodyTryOn();

  // View presentation mode: 'outfit' (fitted on her), 'fabric' (macro closeup), 'split' (interactive curtain), 'heatmap'
  const [viewMode, setViewMode] = useState<'outfit' | 'fabric' | 'split' | 'heatmap'>('outfit');
  const [currentSize, setCurrentSize] = useState<string>(selectedSize);
  const [emailInput, setEmailInput] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [showFitTuner, setShowFitTuner] = useState(false);
  const [showStyleAssistant, setShowStyleAssistant] = useState(false);
  
  // Interactive Split Slider State (0 to 100%)
  const [splitPos, setSplitPos] = useState<number>(50);

  // Luxury Ambience / Boutique Lighting Mode
  const [ambience, setAmbience] = useState<'studio' | 'warm' | 'evening'>('studio');

  // Photo swapping & file input ref
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [currentPersonPhoto, setCurrentPersonPhoto] = useState<string>(originalPhotoUri);

  // Live fitting adjustment state
  const [tuningOptions, setTuningOptions] = useState<GarmentTuningOptions>({
    offsetX: 0,
    offsetY: 0,
    scale: 1.0,
    opacity: 0.96
  });

  const isSaree = activeGarment?.category === 'Saree' || activeGarment?.fabricType === 'Saree' || !!activeGarment?.isSaree;

  // The editorial studio model image for active garment
  const defaultModelUri = activeGarment?.virtualModelImage || activeGarment?.tryonResultImage || '/assets/virtualfit_model_tshirt.jpg';
  const fabricCloseupUri = activeGarment?.fabricCloseupImage || activeGarment?.flatlayImage || defaultModelUri;
  
  // Active tryon display URI for the current active garment
  const initialUri = tryonResultsMap[activeGarment.id] || (tryonResultUri && tryonResultUri !== defaultModelUri ? tryonResultUri : defaultModelUri);
  const [activeDisplayUri, setActiveDisplayUri] = useState<string>(initialUri);
  const [isGeneratingAI, setIsGeneratingAI] = useState<boolean>(false);
  const [aiProgressMessage, setAiProgressMessage] = useState<string>('');
  const [calibrationSaved, setCalibrationSaved] = useState<boolean>(false);

  // Task 7: Precision Drape Tuner calibration state (-20 to +20, 0.90 to 1.10, etc.)
  const [drapeTuning, setDrapeTuning] = useState<{
    offsetX: number;        // -20 to +20px
    offsetY: number;        // -20 to +20px
    widthScale: number;     // 0.90 to 1.10
    lengthScale: number;    // 0.90 to 1.15
    shoulderExpand: number; // 1.30 to 1.70
  }>({
    offsetX: 0,
    offsetY: 0,
    widthScale: 1.00,
    lengthScale: 1.00,
    shoulderExpand: 1.45,
  });

  // Step 5: Curated For You filter states
  const [curatedOccasion, setCuratedOccasion] = useState<string>('Wedding / Reception');
  const [curatedCategory, setCuratedCategory] = useState<string>('All');

  // When active garment changes, update display URI and drape calibration
  useEffect(() => {
    const uri = tryonResultsMap[activeGarment.id] || activeGarment.virtualModelImage || activeGarment.tryonResultImage || currentPersonPhoto;
    setActiveDisplayUri(uri);

    const saved = localStorage.getItem(`drape_calibration_${activeGarment.id}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setDrapeTuning(parsed);
      } catch (e) {
        console.warn('Failed to parse saved calibration:', e);
      }
    }
  }, [activeGarmentIndex, garmentsList]);

  /**
   * Mode B: Photoreal Virtual Try-On Pipeline (Task 6)
   */
  const generatePhotorealTryon = async (
    photoUri: string,
    size: string,
    opts: GarmentTuningOptions = tuningOptions
  ) => {
    if (!activeGarment) return;
    setIsGeneratingAI(true);
    setAiProgressMessage(`Synthesizing Photoreal Look for ${activeGarment.name}...`);
    try {
      let personBlob: Blob;
      if (photoUri.startsWith('data:')) {
        const parts = photoUri.split(',');
        const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
        const byteStr = atob(parts[1]);
        const n = byteStr.length;
        const u8arr = new Uint8Array(n);
        for (let i = 0; i < n; i++) {
          u8arr[i] = byteStr.charCodeAt(i);
        }
        personBlob = new Blob([u8arr], { type: mime });
      } else {
        const res = await fetch(photoUri);
        personBlob = await res.blob();
      }

      let jobCompleted = false;
      try {
        const cat = isSaree ? 'dresses' : 'upper_body';
        const submitRes = await apiService.submitPhotorealTryon(
          personBlob,
          activeGarment.id,
          undefined,
          cat,
          activeGarment.description || activeGarment.name
        );

        if (submitRes && submitRes.job_id) {
          setAiProgressMessage('Rendering realistic fabric drape with IDM-VTON...');
          const startPoll = Date.now();
          while (Date.now() - startPoll < 35000) {
            await new Promise((r) => setTimeout(r, 1500));
            const statusRes = await apiService.pollTryonJob(submitRes.job_id);
            if (statusRes.status === 'COMPLETED' && statusRes.result_url) {
              setActiveDisplayUri(statusRes.result_url);
              jobCompleted = true;
              break;
            } else if (statusRes.status === 'FAILED') {
              break;
            }
          }
        }
      } catch (apiErr) {
        console.warn('[Mode B] API offline, using fallback fusion:', apiErr);
      }

      if (!jobCompleted) {
        const fused = await apiService.blendUserFaceOntoModel(
          photoUri,
          defaultModelUri,
          activeGarment.category,
          size,
          opts
        );
        setActiveDisplayUri(fused);
      }
    } catch (err) {
      console.error('[Mode B] Photoreal execution error:', err);
      setActiveDisplayUri(defaultModelUri);
    } finally {
      setIsGeneratingAI(false);
      setAiProgressMessage('');
    }
  };

  const [isDragging, setIsDragging] = useState(false);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);

  const processPersonPhoto = async (file: File) => {
    if (!isValidUploadFile(file)) {
      alert('Please select a valid photo or document (JPEG, PNG, WEBP, Apple HEIC/HEIF, or PDF).');
      return;
    }
    setIsProcessingPhoto(true);
    try {
      const dataUrl = await processFileToDataUrl(file);
      if (dataUrl) {
        kioskAudio.playShutterSound();
        setCurrentPersonPhoto(dataUrl);
        await generatePhotorealTryon(dataUrl, currentSize, tuningOptions);
      }
    } catch (err: any) {
      console.error('Photo processing error:', err);
      alert(err.message || 'Unable to process the selected photo/document.');
    } finally {
      setIsProcessingPhoto(false);
    }
  };

  const handlePersonPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processPersonPhoto(file);
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processPersonPhoto(file);
  };

  const handleSaveCalibration = () => {
    if (activeGarment?.id) {
      localStorage.setItem(`drape_calibration_${activeGarment.id}`, JSON.stringify(drapeTuning));
      setCalibrationSaved(true);
      kioskAudio.playBeep(900, 0.08);
      setTimeout(() => setCalibrationSaved(false), 2200);
    }
  };

  const handleSizeChange = async (newSize: string) => {
    kioskAudio.playBeep(800, 0.05);
    setCurrentSize(newSize);
    if (!tryonResultsMap[activeGarment.id]) {
      await generatePhotorealTryon(currentPersonPhoto, newSize, tuningOptions);
    }
  };

  const handleTuningChange = async (updated: Partial<GarmentTuningOptions>) => {
    const newOptions = { ...tuningOptions, ...updated };
    setTuningOptions(newOptions);
  };

  const handleResetTuning = () => {
    kioskAudio.playBeep(600, 0.05);
    const defaults = {
      offsetX: 0,
      offsetY: 0,
      widthScale: 1.00,
      lengthScale: 1.00,
      shoulderExpand: 1.45,
    };
    setDrapeTuning(defaults);
    setTuningOptions({ offsetX: 0, offsetY: 0, scale: 1.0, opacity: 0.96, ambience });
  };

  const handleAmbienceChange = (newAmbience: 'studio' | 'warm' | 'evening') => {
    kioskAudio.playBeep(700, 0.05);
    setAmbience(newAmbience);
    setTuningOptions(prev => ({ ...prev, ambience: newAmbience }));
  };

  // Carousel navigation (< Previous | Next >)
  const handlePrevGarment = () => {
    kioskAudio.playBeep(700, 0.06);
    setActiveGarmentIndex((prev) => (prev > 0 ? prev - 1 : garmentsList.length - 1));
  };

  const handleNextGarment = () => {
    kioskAudio.playBeep(750, 0.06);
    setActiveGarmentIndex((prev) => (prev < garmentsList.length - 1 ? prev + 1 : 0));
  };

  // Split Slider Touch / Mouse handlers
  const handleSplitMouseMove = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;

    const posX = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const percentX = Math.round((posX / rect.width) * 100);

    if (viewMode === 'split') {
      setSplitPos(percentX);
    }
  };

  // Priority: 1. AI Body-fit Result on HER > 2. Her new preview > 3. Her uploaded photo > 4. Garment fallback
  const displayResultUri = bodyFitResult || personPreview || currentPersonPhoto || activeDisplayUri;

  // Measurements computation (Prioritizes real scan from flexible body-fit engine)
  const measurements: BodyMeasurements = userMeasurements ? { ...userMeasurements } : {
    heightCm: userHeightCm,
    shoulderCm: Math.round(44.0 * (userHeightCm / 175.0) * 10) / 10,
    chestCm: Math.round(94.0 * (userHeightCm / 175.0) * 10) / 10,
    waistCm: Math.round(78.0 * (userHeightCm / 175.0) * 10) / 10,
    hipCm: Math.round(96.0 * (userHeightCm / 175.0) * 10) / 10,
    lengthCm: Math.round(71.0 * (userHeightCm / 175.0) * 10) / 10,
    sleeveCm: Math.round(62.0 * (userHeightCm / 175.0) * 10) / 10,
  };

  // Adapt to her flexible skeletal ratios (works for Hourglass, Pear, Apple, Rectangle, etc.)
  if (bodyProfile) {
    measurements.waistCm = Math.round(measurements.hipCm * bodyProfile.waistHipRatio);
    measurements.shoulderCm = Math.round(measurements.hipCm * bodyProfile.shoulderHipRatio);
  }

  const handleSendEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput) return;
    kioskAudio.playBeep(900, 0.1);
    setEmailSent(true);
  };

  const handleFinish = () => {
    kioskAudio.playBeep(400, 0.1);
    onFinishSession();
  };

  const handleDownload = () => {
    kioskAudio.playBeep(950, 0.08);
    const link = document.createElement('a');
    link.download = `AURA_MasterSlip_${activeGarment.sku}_Size_${currentSize}.jpg`;
    link.href = activeDisplayUri;
    link.click();
  };

  // Step 5: Curated recommendations filter
  const curatedRecommendations = MOCK_GARMENTS.filter((g) => {
    // Avoid re-showing what's already in active carousel
    if (garmentsList.some((item) => item.id === g.id)) return false;
    if (curatedCategory === 'All') return true;
    return g.fabricType === curatedCategory;
  }).slice(0, 4);

  const handleAddCuratedGarment = (g: Garment) => {
    kioskAudio.playBeep(950, 0.08);
    setGarmentsList((prev) => [...prev, g]);
    setActiveGarmentIndex(garmentsList.length); // Switch right to the newly added garment
    if (onAddGarmentToFeed) {
      onAddGarmentToFeed(g);
    }
  };

  const availableSizes = activeGarment?.availableSizes && activeGarment.availableSizes.length > 0
    ? activeGarment.availableSizes
    : ['XS', 'S', 'M', 'L', 'XL'];

  // Ambience CSS filters
  const ambienceFilterClass =
    ambience === 'warm'
      ? 'sepia-[0.12] contrast-[1.04] brightness-[1.02]'
      : ambience === 'evening'
      ? 'brightness-[0.94] contrast-[1.12] saturate-[1.1]'
      : 'brightness-[1.0] contrast-[1.0]';

  return (
    <div className="relative w-full h-full min-h-[calc(100vh-5rem)] flex flex-col p-6 select-none overflow-y-auto">
      {/* Main 2-Column Presentation Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-7xl mx-auto w-full py-2">
        
        {/* ============================================================== */}
        {/* LEFT: Full Photo Wearing Dress & Fabric Toggle (Step 4)        */}
        {/* ============================================================== */}
        <div className="lg:col-span-7 xl:col-span-8 spatial-glass rounded-[2.5rem] p-6 border border-white/80 flex flex-col items-center justify-between shadow-2xl relative">
          
          {/* Main Viewport Container */}
          <div 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative w-full h-[62vh] min-h-[480px] rounded-3xl overflow-hidden border flex items-center justify-center bg-white/20 shadow-inner cursor-crosshair transition-all ${
              isDragging ? 'border-indigo-600 bg-indigo-500/20 scale-[1.01]' : 'border-white/70'
            }`}
            onMouseMove={handleSplitMouseMove}
            onTouchMove={handleSplitMouseMove}
          >
            {/* Hidden file input for uploading/swapping person photo */}
            <input 
              ref={photoInputRef} 
              type="file" 
              accept="image/*,.heic,.heif,.HEIC,.HEIF,.pdf,.PDF,application/pdf" 
              onChange={handlePersonPhotoUpload} 
              className="hidden" 
            />

            {/* Drag hint overlay */}
            {isDragging && (
              <div className="absolute inset-0 bg-indigo-900/60 backdrop-blur-xs flex flex-col items-center justify-center text-white z-30 pointer-events-none">
                <Upload className="w-12 h-12 mb-2 animate-bounce" />
                <span className="text-base font-bold">Drop your photo here to wear this outfit!</span>
              </div>
            )}

            {/* AI Try-on Generating Overlay */}
            {isGeneratingAI && (
              <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-md z-30 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
                <div className="relative mb-4">
                  <div className="w-16 h-16 rounded-full border-4 border-indigo-400/30 border-t-indigo-500 animate-spin" />
                  <Sparkles className="w-6 h-6 text-indigo-400 absolute inset-0 m-auto animate-pulse" />
                </div>
                <div className="text-white font-extrabold text-base tracking-wide mb-1">
                  Generating Photoreal AI Try-On
                </div>
                <div className="text-xs text-indigo-200 font-mono max-w-sm">
                  {aiProgressMessage || 'Harmonizing fabric drape, lighting & body contours...'}
                </div>
              </div>
            )}

            {/* Photo conversion overlay for iPhone HEIC / PDF */}
            {isProcessingPhoto && (
              <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-xs flex flex-col items-center justify-center text-white z-30">
                <RefreshCw className="w-10 h-10 mb-3 animate-spin text-indigo-400" />
                <span className="text-sm font-bold">Processing Photo / Document...</span>
                <span className="text-xs text-slate-300 mt-1">Converting iPhone HEIC or PDF</span>
              </div>
            )}

            {/* ============================================================== */}
            {/* TOGGLE 1 & 2: Fabric View vs. Final Outfit View                */}
            {/* ============================================================== */}
            
            {/* Mode: Final Outfit View (Person wearing dress perfectly) */}
            {viewMode === 'outfit' && (
              <img
                src={displayResultUri}
                alt="Worn Look"
                className={`w-full h-full object-contain transition-all duration-300 filter drop-shadow-xl ${ambienceFilterClass}`}
              />
            )}

            {/* Mode: Fabric View (Macro weave closeup) */}
            {viewMode === 'fabric' && (
              <div className="relative w-full h-full flex flex-col items-center justify-center bg-slate-950">
                <img
                  src={fabricCloseupUri}
                  alt="Fabric Macro Texture"
                  className="w-full h-full object-contain filter drop-shadow-2xl"
                />
                <div className="absolute bottom-4 left-4 px-3.5 py-1.5 rounded-full bg-black/80 backdrop-blur-md text-amber-300 text-xs font-mono font-bold border border-amber-400/30">
                  MACRO WEAVE: {activeGarment.weaveDetail || activeGarment.fabricComposition}
                </div>
              </div>
            )}

            {/* Mode 3: Interactive Split Slider [Fabric View] <-> [Final Outfit View] */}
            {viewMode === 'split' && (
              <>
                {/* Underneath: Final Outfit View */}
                <img
                  src={displayResultUri}
                  alt="Final Outfit View"
                  className={`w-full h-full object-contain filter drop-shadow-xl ${ambienceFilterClass}`}
                />

                {/* Overlaid: Fabric View with Drag Curtain */}
                <div 
                  className="absolute inset-0 overflow-hidden pointer-events-none"
                  style={{ clipPath: `inset(0 ${100 - splitPos}% 0 0)` }}
                >
                  <img
                    src={fabricCloseupUri}
                    alt="Fabric Close-up"
                    className="w-full h-full object-contain filter contrast-105"
                  />
                  <div className="absolute top-16 left-6 px-3 py-1 rounded-full bg-black/80 backdrop-blur-md text-amber-300 text-[10px] font-bold tracking-wider uppercase border border-amber-400/40">
                    Fabric Macro Closeup
                  </div>
                </div>

                {/* Draggable Divider Line */}
                <div 
                  className="absolute top-0 bottom-0 w-1 bg-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.8)] pointer-events-none z-20 flex items-center justify-center"
                  style={{ left: `${splitPos}%` }}
                >
                  <div className="w-8 h-8 rounded-full bg-amber-400 shadow-xl flex items-center justify-center text-slate-950 text-xs font-black border border-white">
                    &#8596;
                  </div>
                  <div className="absolute top-16 right-4 px-3 py-1 rounded-full bg-indigo-600/90 backdrop-blur-md text-white text-[10px] font-bold tracking-wider uppercase border border-white/20">
                    Final Outfit View
                  </div>
                </div>
              </>
            )}

            {/* Mode 4: Anatomical Fit Tension Heatmap Overlay */}
            {viewMode === 'heatmap' && (
              <>
                <img
                  src={displayResultUri}
                  alt="Fit Heatmap Base"
                  className="w-full h-full object-contain filter drop-shadow-xl brightness-90"
                />
                <div className="absolute inset-0 pointer-events-none z-20 flex flex-col items-center justify-center animate-fade-in">
                  <div className="absolute top-[28%] w-[48%] max-w-[280px] h-9 border-2 border-dashed border-emerald-400/80 rounded-full flex items-center justify-between px-3 bg-emerald-500/10 backdrop-blur-[1px]">
                    <span className="text-[10px] font-bold font-mono text-emerald-800 bg-white/90 px-1.5 py-0.5 rounded shadow-sm">
                      Shoulder: {measurements.shoulderCm} cm
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/90 px-1.5 py-0.5 rounded">
                      Zero Pull [Optimal]
                    </span>
                  </div>

                  <div className="absolute top-[38%] w-[54%] max-w-[320px] h-10 border-2 border-dashed border-emerald-400/90 rounded-full flex items-center justify-between px-3 bg-emerald-500/10 backdrop-blur-[1px]">
                    <span className="text-[10px] font-bold font-mono text-emerald-800 bg-white/90 px-1.5 py-0.5 rounded shadow-sm">
                      Chest: {measurements.chestCm} cm
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/90 px-1.5 py-0.5 rounded">
                      +2.8cm Ease [Tailored]
                    </span>
                  </div>

                  <div className="absolute top-[52%] w-[44%] max-w-[260px] h-9 border-2 border-dashed border-cyan-400/80 rounded-full flex items-center justify-between px-3 bg-cyan-500/10 backdrop-blur-[1px]">
                    <span className="text-[10px] font-bold font-mono text-cyan-800 bg-white/90 px-1.5 py-0.5 rounded shadow-sm">
                      Waist: {measurements.waistCm} cm
                    </span>
                    <span className="text-[10px] font-bold text-cyan-700 bg-cyan-100/90 px-1.5 py-0.5 rounded">
                      Natural Drape
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* Top Toolbar: [Fabric View] <-> [Final Outfit View] Slider Toggle */}
            <div className="absolute top-4 left-4 flex flex-wrap items-center gap-1.5 spatial-glass p-1 rounded-full border border-white/90 shadow-md z-20">
              <button
                onClick={() => {
                  kioskAudio.playBeep(650, 0.05);
                  setViewMode('outfit');
                }}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === 'outfit'
                    ? 'spatial-pill-active border border-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>Final Outfit View</span>
              </button>

              <button
                onClick={() => {
                  kioskAudio.playBeep(650, 0.05);
                  setViewMode('fabric');
                }}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === 'fabric'
                    ? 'spatial-pill-active border border-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Scissors className="w-3.5 h-3.5 text-amber-600" />
                <span>Fabric View</span>
              </button>

              <button
                onClick={() => {
                  kioskAudio.playBeep(700, 0.05);
                  setViewMode(viewMode === 'split' ? 'outfit' : 'split');
                }}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === 'split'
                    ? 'spatial-pill-active border border-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                <span>Fabric/Outfit Split</span>
              </button>

              <button
                onClick={() => {
                  kioskAudio.playBeep(750, 0.05);
                  setViewMode(viewMode === 'heatmap' ? 'outfit' : 'heatmap');
                }}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === 'heatmap'
                    ? 'spatial-pill-active border border-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Activity className="w-3.5 h-3.5 text-emerald-600" />
                <span>Fit Heatmap</span>
              </button>

              <label
                className="px-3 py-1.5 rounded-full text-[11px] font-bold transition-all flex items-center gap-1.5 text-indigo-700 bg-indigo-50/80 hover:bg-white border border-indigo-200/60 shadow-xs cursor-pointer"
                title="Upload a new person image to wear this outfit"
              >
                <Upload className="w-3.5 h-3.5 text-indigo-600" />
                <span>Upload Photo</span>
                <input
                  type="file"
                  hidden
                  accept="image/*"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      processPersonPhoto(file);
                      handleBodyUpload(file);
                    }
                  }}
                />
              </label>

              <button
                onClick={() => wearOnMyBody(activeGarment, bodyProfile, currentPersonPhoto)}
                disabled={bodyFitLoading}
                className="px-3 py-1.5 rounded-full text-[11px] font-bold transition-all flex items-center gap-1.5 text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs active:scale-95 disabled:opacity-60 cursor-pointer"
                title="Drape this saree on your body structure using AI"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>{bodyFitLoading ? 'Draping On Body...' : 'Wear On My Body'}</span>
              </button>
            </div>

            {/* Top Right Tools: Loupe, Tuner & Llama Assistant */}
            <div className="absolute top-4 right-4 flex flex-col items-end gap-2 z-20">
              <button
                onClick={() => {
                  kioskAudio.playBeep(850, 0.05);
                  setShowStyleAssistant(true);
                }}
                className="px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/30 hover:brightness-110 transition-all border border-indigo-400/40"
              >
                <Bot className="w-3.5 h-3.5 text-white" />
                <span>Style Advisor</span>
              </button>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setShowFitTuner(!showFitTuner)}
                  className={`spatial-pill px-3 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1.5 border border-white/80 shadow-md transition-all ${
                    showFitTuner ? 'spatial-pill-active text-slate-950' : 'text-slate-800 hover:bg-white'
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Drape Tuner</span>
                </button>
              </div>
            </div>

            {/* Bottom Floating Ambience Lighting Bar */}
            <div className="absolute bottom-4 right-4 flex items-center gap-1.5 spatial-glass p-1 rounded-full border border-white/90 shadow-md z-20">
              <span className="text-[10px] font-bold text-slate-500 px-2 uppercase">Lighting:</span>
              <button
                onClick={() => handleAmbienceChange('studio')}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition ${
                  ambience === 'studio' ? 'bg-white text-slate-950 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Daylight (5500K)
              </button>
              <button
                onClick={() => handleAmbienceChange('warm')}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition flex items-center gap-1 ${
                  ambience === 'warm' ? 'bg-amber-100 text-amber-950 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sun className="w-3 h-3 text-amber-500" />
                <span>Boutique Warm</span>
              </button>
              <button
                onClick={() => handleAmbienceChange('evening')}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition flex items-center gap-1 ${
                  ambience === 'evening' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Moon className="w-3 h-3 text-indigo-400" />
                <span>Runway Gala</span>
              </button>
            </div>

            {/* Drape Tuner Drawer */}
            {showFitTuner && (
              <div className="absolute bottom-16 right-4 w-80 spatial-glass border border-white/95 p-4 rounded-3xl shadow-2xl z-30 text-xs animate-fade-in max-h-[75vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-3 border-b border-slate-300 pb-2">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-indigo-700" />
                    <span>Drape & Fit Calibration</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleResetTuning}
                      className="text-[10px] text-slate-600 hover:text-slate-900 flex items-center gap-1 font-bold"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Reset</span>
                    </button>
                    <button
                      onClick={handleSaveCalibration}
                      className={`text-[10px] px-2.5 py-1 rounded-full font-bold flex items-center gap-1 transition-all ${
                        calibrationSaved
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs'
                      }`}
                    >
                      <span>{calibrationSaved ? 'Saved!' : 'Save'}</span>
                    </button>
                  </div>
                </div>

                {/* Slider 1: Offset X */}
                <div className="mb-2">
                  <div className="flex justify-between text-[11px] text-slate-700 font-semibold mb-1">
                    <span>Offset X (Horizontal)</span>
                    <span className="font-mono text-indigo-800 font-bold">{drapeTuning.offsetX}px</span>
                  </div>
                  <input
                    type="range"
                    min="-20"
                    max="20"
                    step="1"
                    value={drapeTuning.offsetX}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setDrapeTuning({ ...drapeTuning, offsetX: val });
                      handleTuningChange({ offsetX: val });
                    }}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                </div>

                {/* Slider 2: Offset Y */}
                <div className="mb-2">
                  <div className="flex justify-between text-[11px] text-slate-700 font-semibold mb-1">
                    <span>Offset Y (Vertical)</span>
                    <span className="font-mono text-indigo-800 font-bold">{drapeTuning.offsetY}px</span>
                  </div>
                  <input
                    type="range"
                    min="-20"
                    max="20"
                    step="1"
                    value={drapeTuning.offsetY}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setDrapeTuning({ ...drapeTuning, offsetY: val });
                      handleTuningChange({ offsetY: val });
                    }}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                </div>

                {/* Slider 3: Width Scale */}
                <div className="mb-2">
                  <div className="flex justify-between text-[11px] text-slate-700 font-semibold mb-1">
                    <span>Width Scale</span>
                    <span className="font-mono text-indigo-800 font-bold">{Math.round(drapeTuning.widthScale * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.90"
                    max="1.10"
                    step="0.01"
                    value={drapeTuning.widthScale}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setDrapeTuning({ ...drapeTuning, widthScale: val });
                      handleTuningChange({ scale: val });
                    }}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                </div>

                {/* Slider 4: Length Scale */}
                <div className="mb-2">
                  <div className="flex justify-between text-[11px] text-slate-700 font-semibold mb-1">
                    <span>Length Scale</span>
                    <span className="font-mono text-indigo-800 font-bold">{Math.round(drapeTuning.lengthScale * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.90"
                    max="1.15"
                    step="0.01"
                    value={drapeTuning.lengthScale}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setDrapeTuning({ ...drapeTuning, lengthScale: val });
                    }}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                </div>

                {/* Slider 5: Shoulder Expand */}
                <div className="mb-2">
                  <div className="flex justify-between text-[11px] text-slate-700 font-semibold mb-1">
                    <span>Shoulder Expand</span>
                    <span className="font-mono text-indigo-800 font-bold">{drapeTuning.shoulderExpand.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min="1.30"
                    max="1.70"
                    step="0.01"
                    value={drapeTuning.shoulderExpand}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setDrapeTuning({ ...drapeTuning, shoulderExpand: val });
                    }}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>

          {/* ============================================================== */}
          {/* BOTTOM CAROUSEL: < Previous | Next > Arrows (Step 4 Carousel)   */}
          {/* ============================================================== */}
          <div className="w-full mt-4 flex flex-col gap-3">
            <div className="flex items-center justify-between px-2">
              {/* Previous Button */}
              <button
                onClick={handlePrevGarment}
                className="px-4 py-2 rounded-full spatial-pill border border-white/90 text-slate-800 hover:text-slate-950 hover:bg-white font-bold text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition"
              >
                <ChevronLeft className="w-4 h-4 text-indigo-600" />
                <span>&lt; Previous</span>
              </button>

              {/* Garment Indicator & Carousel Status */}
              <div className="text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  DRESS {activeGarmentIndex + 1} OF {garmentsList.length}
                </span>
                <h4 className="text-sm font-black text-slate-900 truncate max-w-xs md:max-w-md">
                  {activeGarment.name}
                </h4>
              </div>

              {/* Next Button */}
              <button
                onClick={handleNextGarment}
                className="px-4 py-2 rounded-full spatial-pill border border-white/90 text-slate-800 hover:text-slate-950 hover:bg-white font-bold text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition"
              >
                <span>Next &gt;</span>
                <ChevronRight className="w-4 h-4 text-indigo-600" />
              </button>
            </div>

            {/* Thumbnail Carousel Strip (Saree / Outfit Carousel like video) */}
            <div className="flex items-center gap-3 overflow-x-auto pb-2 px-2 scrollbar-none">
              {garmentsList.map((g, idx) => {
                const active = idx === activeGarmentIndex;
                return (
                  <div
                    key={g.id}
                    onClick={() => {
                      kioskAudio.playBeep(700, 0.05);
                      setActiveGarmentIndex(idx);
                    }}
                    className={`shrink-0 flex items-center gap-2 p-1.5 pr-3 rounded-2xl cursor-pointer transition-all border ${
                      active
                        ? 'bg-indigo-50/90 border-indigo-600 ring-2 ring-indigo-500/30 scale-105 shadow-md'
                        : 'bg-white/60 border-white/80 hover:bg-white/90 hover:border-indigo-300'
                    }`}
                  >
                    <img
                      src={g.flatlayImage || g.fabricCloseupImage}
                      alt={g.name}
                      className="w-10 h-10 object-contain rounded-xl bg-white p-0.5 border border-slate-200"
                    />
                    <div className="text-left">
                      <div className="text-xs font-bold text-slate-900 truncate max-w-[110px]">{g.name}</div>
                      <div className="text-[10px] text-slate-500 font-medium">{g.price}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* RIGHT: YOUR TAILOR MASTER SLIP (Step 4)                        */}
        {/* ============================================================== */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-4">
          
          {/* Master Cutting Chit Paper Aesthetic */}
          <div className="relative spatial-glass rounded-[2.5rem] p-6 border-2 border-amber-400/50 shadow-2xl flex flex-col justify-between bg-gradient-to-br from-amber-50/70 via-white/85 to-amber-50/60 backdrop-blur-xl">
            
            {/* Top Vintage Bespoke Master Seal */}
            <div className="border-b-2 border-dashed border-amber-300/80 pb-4 mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-white shadow-md shadow-amber-500/30">
                    <Scissors className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-amber-900 tracking-widest uppercase">
                      SAVILE ROW &bull; BESPOKE PATTERN
                    </span>
                    <h3 className="text-xl font-black text-slate-950 tracking-tight">
                      Your Tailor Master Slip
                    </h3>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[10px] font-mono text-slate-500 font-bold">CHIT NO.</div>
                  <div className="text-xs font-mono font-black text-indigo-900">
                    #MS-{activeGarment.id.slice(-4).toUpperCase()}
                  </div>
                </div>
              </div>
            </div>

            {/* Master Size Callout */}
            <div className="p-4 rounded-2xl bg-white/90 border border-amber-300/80 shadow-md mb-4 text-center relative overflow-hidden">
              <div className="text-[10px] font-bold text-amber-800 tracking-wider uppercase mb-1 flex items-center justify-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>CONFIRMED MASTER SIZE</span>
              </div>
              <div className="text-4xl font-black text-slate-950 font-mono tracking-tight">
                {isSaree ? 'FREE SIZE (6.3m)' : `SIZE ${currentSize}`}
              </div>
              <div className="text-xs text-slate-600 font-medium mt-1">
                {isSaree ? 'Matched with Blouse Size 36 & Pallu Drape' : 'Tailored Ease: +2.8 cm dynamic allowance'}
              </div>

              {/* Decorative Corner Stitch Marks */}
              <div className="absolute top-1 left-2 text-amber-400 font-mono text-xs">+</div>
              <div className="absolute top-1 right-2 text-amber-400 font-mono text-xs">+</div>
              <div className="absolute bottom-1 left-2 text-amber-400 font-mono text-xs">+</div>
              <div className="absolute bottom-1 right-2 text-amber-400 font-mono text-xs">+</div>
            </div>

            {/* Quick Size Switcher */}
            <div className="mb-4">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                <span>Switch Size Silhouette</span>
                <span className="text-indigo-700 font-mono">Current: {currentSize}</span>
              </div>
              <div className="flex gap-1.5">
                {availableSizes.map((size) => (
                  <button
                    key={size}
                    onClick={() => handleSizeChange(size)}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                      currentSize === size
                        ? 'spatial-pill-active border-amber-400 text-slate-950 shadow-xs'
                        : 'spatial-pill border-white/70 text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Biometric Measurements Grid (Chest, Waist, Shoulder, Length, Sleeve) */}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono mb-4">
              <div className="p-2.5 rounded-xl bg-white/80 border border-slate-200/90 shadow-2xs">
                <div className="text-[10px] text-slate-500 font-sans font-bold flex items-center justify-between">
                  <span>SHOULDER</span>
                  <Ruler className="w-3 h-3 text-amber-600" />
                </div>
                <div className="text-base font-extrabold text-slate-950">{measurements.shoulderCm} cm</div>
              </div>

              <div className="p-2.5 rounded-xl bg-white/80 border border-slate-200/90 shadow-2xs">
                <div className="text-[10px] text-slate-500 font-sans font-bold flex items-center justify-between">
                  <span>CHEST / BUST</span>
                  <Scissors className="w-3 h-3 text-amber-600" />
                </div>
                <div className="text-base font-extrabold text-slate-950">{measurements.chestCm} cm</div>
              </div>

              <div className="p-2.5 rounded-xl bg-white/80 border border-slate-200/90 shadow-2xs">
                <div className="text-[10px] text-slate-500 font-sans font-bold">WAIST</div>
                <div className="text-base font-extrabold text-slate-950">{measurements.waistCm} cm</div>
              </div>

              <div className="p-2.5 rounded-xl bg-white/80 border border-slate-200/90 shadow-2xs">
                <div className="text-[10px] text-slate-500 font-sans font-bold">GARMENT LENGTH</div>
                <div className="text-base font-extrabold text-slate-950">{measurements.lengthCm || 71} cm</div>
              </div>

              <div className="p-2.5 rounded-xl bg-white/80 border border-slate-200/90 shadow-2xs">
                <div className="text-[10px] text-slate-500 font-sans font-bold">SLEEVE ARC</div>
                <div className="text-base font-extrabold text-slate-950">{measurements.sleeveCm || 62} cm</div>
              </div>

              <div className="p-2.5 rounded-xl bg-white/80 border border-slate-200/90 shadow-2xs">
                <div className="text-[10px] text-slate-500 font-sans font-bold">CUSTOMER HEIGHT</div>
                <div className="text-base font-extrabold text-slate-950">{measurements.heightCm} cm</div>
              </div>
            </div>

            {/* Fabric Specification & Guaranteed Fit Box */}
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-400/40 mb-4 text-xs">
              <div className="flex items-center gap-2 font-bold text-amber-950 mb-1">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Master Pattern Guarantee</span>
              </div>
              <div className="text-[11px] text-amber-900 leading-snug">
                {activeGarment.brand} &bull; {activeGarment.fabricComposition}. Cut with zero collar gap and drape alignment.
              </div>
            </div>

            {/* Take-Home Export / Email & QR */}
            <div className="p-3 rounded-2xl bg-white/80 border border-slate-200 shadow-xs mb-4">
              <div className="text-xs font-bold text-slate-900 mb-2 flex items-center justify-between">
                <span>TAKE THIS LOOK HOME</span>
                <button
                  onClick={() => setShowQr(!showQr)}
                  className="text-[10px] font-bold text-indigo-700 hover:underline flex items-center gap-1"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>{showQr ? 'Hide QR' : 'Instant QR'}</span>
                </button>
              </div>

              {showQr && (
                <div className="mb-3 p-3 bg-white rounded-xl flex flex-col items-center justify-center border border-slate-200 shadow-xs">
                  <div className="w-24 h-24 bg-slate-900 rounded-lg flex items-center justify-center text-white text-[9px] font-mono text-center p-2">
                    [SCAN FOR 4K LOOK & MASTER SLIP]
                  </div>
                  <span className="text-[9px] text-slate-500 mt-1 font-mono">15m TTL Ephemeral Link</span>
                </div>
              )}

              <form onSubmit={handleSendEmail} className="flex gap-2">
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="name@example.com"
                  className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  disabled={emailSent}
                  className="spatial-btn-primary px-3 py-1.5 rounded-xl text-white text-xs font-bold flex items-center gap-1 shadow-md"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{emailSent ? 'Sent!' : 'Send'}</span>
                </button>
              </form>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              <button
                onClick={handleDownload}
                className="w-full py-3 px-4 rounded-xl spatial-btn-primary text-white font-bold text-xs tracking-wider flex items-center justify-center gap-2 shadow-lg active:scale-98"
              >
                <Download className="w-4 h-4 text-white" />
                <span>DOWNLOAD 4K LOOK & MASTER SLIP</span>
              </button>

              <div className="flex gap-2">
                <button
                  onClick={onTryAnother}
                  className="flex-1 py-2.5 px-3 rounded-xl spatial-pill border border-white/80 text-slate-700 hover:text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-white/70 shadow-xs"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Pick More Fabrics</span>
                </button>

                <button
                  onClick={handleFinish}
                  className="flex-1 py-2.5 px-3 rounded-xl spatial-pill border border-white/80 text-slate-700 hover:text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-white/70 shadow-xs"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Finish & Purge</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* STEP 5: CURATED FOR YOU (Occasion & Category Recommender)       */}
      {/* ============================================================== */}
      <div className="w-full max-w-7xl mx-auto mt-6 pt-6 border-t border-slate-200/80">
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4 mb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full spatial-pill border border-white/80 text-xs font-bold text-indigo-900 mb-1 shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>STEP 5: CURATED FOR YOU</span>
            </div>
            <h3 className="text-2xl font-black text-slate-950 tracking-tight">
              Personalized Recommendations for Your Master Pattern
            </h3>
            <p className="text-xs text-slate-600 font-medium">
              What's the occasion? Select your event and category to view handpicked fabrics tailored to your exact measurements.
            </p>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 p-1 rounded-full spatial-glass border border-white/90 shadow-md">
            {(['All', 'Saree', 'Kurti Material', 'Shirt Fabric', 'Tops'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  kioskAudio.playBeep(600, 0.04);
                  setCuratedCategory(cat);
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                  curatedCategory === cat
                    ? 'spatial-pill-active border border-white text-slate-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-950 hover:bg-white/50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Occasion Selection Bar */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wider mr-1">
            Occasion:
          </span>
          {[
            'Wedding / Reception',
            'Festive Gala',
            'Office Formal',
            'Casual Chic',
            'Cocktail Evening'
          ].map((occ) => (
            <button
              key={occ}
              onClick={() => {
                kioskAudio.playBeep(650, 0.04);
                setCuratedOccasion(occ);
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all border ${
                curatedOccasion === occ
                  ? 'bg-amber-400 border-amber-500 text-slate-950 shadow-md scale-102'
                  : 'spatial-pill border-white/70 text-slate-700 hover:text-slate-950 hover:bg-white'
              }`}
            >
              {occ}
            </button>
          ))}
        </div>

        {/* Curated Recommendations Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {curatedRecommendations.map((g) => (
            <div
              key={g.id}
              className="p-4 rounded-3xl spatial-glass border border-white/80 shadow-lg hover:shadow-xl transition-all duration-300 flex flex-col justify-between group"
            >
              <div className="relative w-full h-44 rounded-2xl overflow-hidden bg-slate-950 mb-3 border border-white/60">
                <img
                  src={g.fabricCloseupImage || g.flatlayImage}
                  alt={g.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute top-2 left-2 px-2.5 py-0.5 rounded-full bg-black/75 backdrop-blur-md text-amber-300 text-[10px] font-bold font-mono">
                  {g.fabricType}
                </div>
                <div className="absolute top-2 right-2 px-2.5 py-0.5 rounded-full bg-white/90 text-slate-900 text-[10px] font-black">
                  {g.price}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-950 truncate">{g.name}</h4>
                <div className="text-[11px] text-slate-500 font-medium truncate mb-3">
                  {g.brand} &bull; {g.weaveDetail || g.fabricComposition}
                </div>
              </div>

              <button
                onClick={() => handleAddCuratedGarment(g)}
                className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition"
              >
                <Plus className="w-3.5 h-3.5 text-white" />
                <span>Wear This Look Now</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Style Assistant Drawer */}
      <StyleAssistant
        sessionId={sessionId}
        garment={activeGarment}
        selectedSize={currentSize}
        isOpen={showStyleAssistant}
        onClose={() => setShowStyleAssistant(false)}
        onSelectSize={handleSizeChange}
      />
    </div>
  );
};
