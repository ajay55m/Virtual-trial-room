import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  CheckCircle2, 
  RotateCcw, 
  AlertTriangle, 
  Send, 
  QrCode, 
  ShieldCheck, 
  Layers, 
  Sliders, 
  Download, 
  RefreshCw, 
  Eye, 
  UserCheck, 
  Bot, 
  Sun, 
  Moon, 
  ZoomIn, 
  Activity,
  SlidersHorizontal,
  Upload
} from 'lucide-react';
import type { Garment, SizeRecommendation } from '../types/kiosk';
import { kioskAudio } from '../utils/audio';
import { apiService, type GarmentTuningOptions } from '../services/api';
import { StyleAssistant } from './StyleAssistant';

interface ResultViewProps {
  sessionId?: string;
  originalPhotoUri: string;
  tryonResultUri?: string;
  sizeRecommendation?: SizeRecommendation;
  garment: Garment;
  selectedSize: string;
  onTryAnother: () => void;
  onFinishSession: () => void;
}

export const ResultView: React.FC<ResultViewProps> = ({
  sessionId = 'sess_demo',
  originalPhotoUri,
  tryonResultUri,
  sizeRecommendation,
  garment,
  selectedSize,
  onTryAnother,
  onFinishSession
}) => {
  const [viewMode, setViewMode] = useState<'fitted' | 'pure_model' | 'split' | 'heatmap'>('fitted');
  const [currentSize, setCurrentSize] = useState<string>(selectedSize);
  const [emailInput, setEmailInput] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [showFitTuner, setShowFitTuner] = useState(false);
  const [showStyleAssistant, setShowStyleAssistant] = useState(false);
  
  // Interactive Split Slider State (0 to 100%)
  const [splitPos, setSplitPos] = useState<number>(50);

  // 4K Fabric Zoom Loupe State
  const [showLoupe, setShowLoupe] = useState<boolean>(false);
  const [loupePos, setLoupePos] = useState<{ x: number; y: number; px: number; py: number }>({ x: 0, y: 0, px: 50, py: 50 });

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

  const isSaree = garment.category === 'Saree' || garment.isSaree;

  // The editorial studio model image
  const defaultModelUri = garment.virtualModelImage || garment.tryonResultImage || '/assets/virtualfit_model_tshirt.jpg';
  
  // Initial active display
  const initialUri = (tryonResultUri && tryonResultUri !== defaultModelUri) ? tryonResultUri : currentPersonPhoto;
  const [activeDisplayUri, setActiveDisplayUri] = useState<string>(initialUri);

  const updateDrapedImage = async (
    photoUri: string,
    size: string,
    opts: GarmentTuningOptions
  ) => {
    try {
      const res = await apiService.createClientSideTryonComposite(
        photoUri,
        garment,
        size,
        opts
      );
      if (res) {
        setActiveDisplayUri(res);
      }
    } catch (err) {
      console.warn('[ResultView] Composite generation error:', err);
    }
  };

  // Re-drape when component mounts or original photo changes
  useEffect(() => {
    if (!tryonResultUri || tryonResultUri === defaultModelUri) {
      updateDrapedImage(currentPersonPhoto, currentSize, tuningOptions);
    }
  }, [currentPersonPhoto, garment]);

  const handlePersonPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        kioskAudio.playShutterSound();
        setCurrentPersonPhoto(dataUrl);
        await updateDrapedImage(dataUrl, currentSize, tuningOptions);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSizeChange = async (newSize: string) => {
    kioskAudio.playBeep(800, 0.05);
    setCurrentSize(newSize);
    await updateDrapedImage(currentPersonPhoto, newSize, tuningOptions);
  };

  const handleTuningChange = async (updated: Partial<GarmentTuningOptions>) => {
    const newOptions = { ...tuningOptions, ...updated };
    setTuningOptions(newOptions);
    await updateDrapedImage(currentPersonPhoto, currentSize, newOptions);
  };

  const handleResetTuning = async () => {
    kioskAudio.playBeep(600, 0.05);
    const defaults = { offsetX: 0, offsetY: 0, scale: 1.0, opacity: 0.96 };
    setTuningOptions(defaults);
    await updateDrapedImage(currentPersonPhoto, currentSize, defaults);
  };

  // Split Slider Touch / Mouse handlers
  const handleSplitMouseMove = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const posX = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const posY = Math.max(0, Math.min(rect.height, clientY - rect.top));
    const percentX = Math.round((posX / rect.width) * 100);
    const percentY = Math.round((posY / rect.height) * 100);

    if (viewMode === 'split') {
      setSplitPos(percentX);
    }

    if (showLoupe) {
      setLoupePos({ x: posX, y: posY, px: percentX, py: percentY });
    }
  };

  // Dynamic recommendation based on active size and body regression
  const recommendedSize = isSaree ? 'Free Size' : 'M';
  const fitClass: 'Slim' | 'Regular' | 'Relaxed' =
    currentSize === 'L' || currentSize === 'XL'
      ? 'Relaxed'
      : currentSize === 'XS' || currentSize === 'S'
      ? 'Slim'
      : 'Regular';

  const recommendation: SizeRecommendation = sizeRecommendation && sizeRecommendation.recommendedSize === currentSize
    ? sizeRecommendation
    : {
        recommendedSize,
        confidence: currentSize === recommendedSize ? 0.96 : 0.88,
        fitClass,
        honestyWarning:
          !isSaree && currentSize !== recommendedSize && currentSize !== '40'
            ? `Honesty Rule Alert: You selected Size ${currentSize}, but body measurement regression predicts Size ${recommendedSize} for optimal tailored drape.`
            : undefined,
        measurementBreakdown: {
          chestCm: currentSize === 'XS' ? 86 : currentSize === 'S' ? 91 : currentSize === 'M' ? 96 : currentSize === 'L' ? 102 : 108,
          waistCm: currentSize === 'XS' ? 70 : currentSize === 'S' ? 74 : currentSize === 'M' ? 78 : currentSize === 'L' ? 84 : 90,
          hipCm: currentSize === 'XS' ? 92 : currentSize === 'S' ? 95 : currentSize === 'M' ? 98 : currentSize === 'L' ? 104 : 110,
          shoulderCm: currentSize === 'XS' ? 40 : currentSize === 'S' ? 42 : currentSize === 'M' ? 44 : currentSize === 'L' ? 46 : 48,
          heightCm: 175
        }
      };

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

  const handleTryAnother = () => {
    kioskAudio.playBeep(700, 0.1);
    onTryAnother();
  };

  const handleDownload = () => {
    kioskAudio.playBeep(950, 0.08);
    const link = document.createElement('a');
    link.download = `AURA_Fitting_${garment.sku}_Size_${currentSize}.jpg`;
    link.href = activeDisplayUri;
    link.click();
  };

  const availableSizes = garment.availableSizes && garment.availableSizes.length > 0
    ? garment.availableSizes
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto w-full my-auto py-2">
        
        {/* Left 2 Cols: Main Try-On Render View */}
        <div className="lg:col-span-2 spatial-glass rounded-[2.5rem] p-6 border border-white/80 flex flex-col items-center justify-between shadow-2xl relative">
          
          {/* Main Viewport Container */}
          <div 
            className="relative w-full h-[64vh] min-h-[480px] rounded-3xl overflow-hidden border border-white/70 flex items-center justify-center bg-white/20 shadow-inner cursor-crosshair"
            onMouseMove={handleSplitMouseMove}
            onTouchMove={handleSplitMouseMove}
          >
            {/* Hidden file input for uploading/swapping person photo */}
            <input 
              ref={photoInputRef} 
              type="file" 
              accept="image/*" 
              onChange={handlePersonPhotoUpload} 
              className="hidden" 
            />

            {/* View 1 & 2: Base Fitted or Studio Model Render */}
            <img
              src={viewMode === 'pure_model' ? defaultModelUri : activeDisplayUri}
              alt="VirtualFit Result"
              className={`w-full h-full object-contain transition-all duration-300 filter drop-shadow-xl ${ambienceFilterClass}`}
            />

            {/* View 3: Interactive Split Screen Before / After Curtain */}
            {viewMode === 'split' && (
              <div 
                className="absolute inset-0 overflow-hidden pointer-events-none"
                style={{ clipPath: `inset(0 ${100 - splitPos}% 0 0)` }}
              >
                <img
                  src={currentPersonPhoto}
                  alt="Original Capture"
                  className="w-full h-full object-contain filter drop-shadow-xl"
                />
                <div className="absolute top-16 left-6 px-3 py-1 rounded-full bg-black/70 backdrop-blur-md text-white text-[10px] font-bold tracking-wider uppercase border border-white/20">
                  Original Person Photo
                </div>
              </div>
            )}

            {/* Split Screen Draggable Divider Line */}
            {viewMode === 'split' && (
              <div 
                className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_15px_rgba(255,255,255,0.8)] pointer-events-none z-20 flex items-center justify-center"
                style={{ left: `${splitPos}%` }}
              >
                <div className="w-8 h-8 rounded-full bg-white shadow-xl flex items-center justify-center text-slate-800 text-xs font-bold border border-slate-300">
                  &#8596;
                </div>
                <div className="absolute top-16 right-4 px-3 py-1 rounded-full bg-indigo-600/90 backdrop-blur-md text-white text-[10px] font-bold tracking-wider uppercase border border-white/20">
                  Fitted on Person
                </div>
              </div>
            )}

            {/* View 4: Anatomical Fit Tension Heatmap Overlay */}
            {viewMode === 'heatmap' && (
              <div className="absolute inset-0 pointer-events-none z-20 flex flex-col items-center justify-center animate-fade-in">
                {/* Shoulder tension line */}
                <div className="absolute top-[28%] w-[48%] max-w-[280px] h-9 border-2 border-dashed border-emerald-400/80 rounded-full flex items-center justify-between px-3 bg-emerald-500/10 backdrop-blur-[1px]">
                  <span className="text-[10px] font-bold font-mono text-emerald-800 bg-white/90 px-1.5 py-0.5 rounded shadow-sm">
                    Shoulder: {recommendation.measurementBreakdown.shoulderCm} cm
                  </span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/90 px-1.5 py-0.5 rounded">
                    Zero Drag [Optimal]
                  </span>
                </div>

                {/* Chest tension line */}
                <div className="absolute top-[38%] w-[54%] max-w-[320px] h-10 border-2 border-dashed border-emerald-400/90 rounded-full flex items-center justify-between px-3 bg-emerald-500/10 backdrop-blur-[1px]">
                  <span className="text-[10px] font-bold font-mono text-emerald-800 bg-white/90 px-1.5 py-0.5 rounded shadow-sm">
                    Chest: {recommendation.measurementBreakdown.chestCm} cm
                  </span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/90 px-1.5 py-0.5 rounded">
                    +2.8cm Ease [Tailored]
                  </span>
                </div>

                {/* Waist tension line */}
                <div className="absolute top-[52%] w-[44%] max-w-[260px] h-9 border-2 border-dashed border-cyan-400/80 rounded-full flex items-center justify-between px-3 bg-cyan-500/10 backdrop-blur-[1px]">
                  <span className="text-[10px] font-bold font-mono text-cyan-800 bg-white/90 px-1.5 py-0.5 rounded shadow-sm">
                    Waist: {recommendation.measurementBreakdown.waistCm} cm
                  </span>
                  <span className="text-[10px] font-bold text-cyan-700 bg-cyan-100/90 px-1.5 py-0.5 rounded">
                    Natural Drape
                  </span>
                </div>
              </div>
            )}

            {/* 4K Fabric Zoom Loupe */}
            {showLoupe && (
              <div 
                className="absolute w-44 h-44 rounded-full border-4 border-white shadow-2xl overflow-hidden pointer-events-none z-30 ring-4 ring-indigo-500/30"
                style={{ 
                  left: `${loupePos.x - 88}px`, 
                  top: `${loupePos.y - 88}px`,
                  backgroundImage: `url(${activeDisplayUri})`,
                  backgroundSize: '300%',
                  backgroundPosition: `${loupePos.px}% ${loupePos.py}%`
                }}
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-2.5 h-2.5 border border-white/80 rounded-full" />
                </div>
                <div className="absolute bottom-1 inset-x-0 text-center">
                  <span className="text-[9px] font-bold px-2 py-0.5 bg-black/80 text-white rounded-full">
                    4K Weave (3x)
                  </span>
                </div>
              </div>
            )}

            {/* View Mode Switcher Toolbar (Top Left) */}
            <div className="absolute top-4 left-4 flex flex-wrap items-center gap-1.5 spatial-glass p-1 rounded-full border border-white/90 shadow-md z-20">
              <button
                onClick={() => {
                  kioskAudio.playBeep(650, 0.05);
                  setViewMode('fitted');
                }}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === 'fitted'
                    ? 'spatial-pill-active border border-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                <span>AI Try-On Drape</span>
              </button>

              <button
                onClick={() => {
                  kioskAudio.playBeep(650, 0.05);
                  setViewMode('pure_model');
                }}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === 'pure_model'
                    ? 'spatial-pill-active border border-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Eye className="w-3.5 h-3.5 text-indigo-600" />
                <span>Editorial Model</span>
              </button>

              <button
                onClick={() => {
                  kioskAudio.playBeep(700, 0.05);
                  setViewMode(viewMode === 'split' ? 'fitted' : 'split');
                }}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === 'split'
                    ? 'spatial-pill-active border border-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                <span>Split Compare</span>
              </button>

              <button
                onClick={() => {
                  kioskAudio.playBeep(750, 0.05);
                  setViewMode(viewMode === 'heatmap' ? 'fitted' : 'heatmap');
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

              {/* Instant Upload/Swap Person Photo Button */}
              <button
                onClick={() => photoInputRef.current?.click()}
                className="px-3 py-1.5 rounded-full text-[11px] font-bold transition-all flex items-center gap-1.5 text-indigo-700 bg-indigo-50/80 hover:bg-white border border-indigo-200/60 shadow-xs"
                title="Upload a new person image to wear this outfit"
              >
                <Upload className="w-3.5 h-3.5 text-indigo-600" />
                <span>Upload Person Photo</span>
              </button>
            </div>

            {/* Top Right Badges & AI Assistant Toggle */}
            <div className="absolute top-4 right-4 flex flex-col items-end gap-2 z-20">
              <button
                onClick={() => {
                  kioskAudio.playBeep(850, 0.05);
                  setShowStyleAssistant(true);
                }}
                className="px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/30 hover:brightness-110 transition-all border border-indigo-400/40"
              >
                <Bot className="w-4 h-4 text-white" />
                <span>Llama Style & Return Risk</span>
              </button>

              <div className="spatial-glass px-3.5 py-1.5 rounded-full text-[11px] font-bold text-slate-800 flex items-center gap-1.5 border border-white/90 shadow-md">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>SPATIAL FIT: SIZE {currentSize}</span>
              </div>

              {/* 4K Zoom & Ambience Tools */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    kioskAudio.playBeep(600, 0.04);
                    setShowLoupe(!showLoupe);
                  }}
                  className={`spatial-pill px-3 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1.5 border border-white/80 shadow-md transition-all ${
                    showLoupe ? 'spatial-pill-active text-slate-950 ring-2 ring-indigo-500/30' : 'text-slate-800 hover:bg-white'
                  }`}
                  title="4K Fabric Magnifier"
                >
                  <ZoomIn className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{showLoupe ? 'Loupe On' : '4K Loupe'}</span>
                </button>

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
              <span className="text-[10px] font-bold text-slate-500 px-2 uppercase">Ambience:</span>
              <button
                onClick={() => setAmbience('studio')}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition ${
                  ambience === 'studio' ? 'bg-white text-slate-950 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Daylight (5500K)
              </button>
              <button
                onClick={() => setAmbience('warm')}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition flex items-center gap-1 ${
                  ambience === 'warm' ? 'bg-amber-100 text-amber-950 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sun className="w-3 h-3 text-amber-500" />
                <span>Boutique Warm</span>
              </button>
              <button
                onClick={() => setAmbience('evening')}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition flex items-center gap-1 ${
                  ambience === 'evening' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Moon className="w-3 h-3 text-indigo-400" />
                <span>Runway Gala</span>
              </button>
            </div>

            {/* Interactive Precision Drape Tuner Drawer */}
            {showFitTuner && (
              <div className="absolute bottom-16 right-4 w-80 spatial-glass border border-white/95 p-4 rounded-3xl shadow-2xl z-30 text-xs animate-fade-in">
                <div className="flex items-center justify-between mb-3 border-b border-slate-300 pb-2">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-indigo-700" />
                    <span>Drape & Size Calibration</span>
                  </span>
                  <button
                    onClick={handleResetTuning}
                    className="text-[10px] text-slate-600 hover:text-slate-900 flex items-center gap-1 font-bold"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Reset</span>
                  </button>
                </div>

                {/* Instant Size Selector */}
                <div className="mb-3">
                  <div className="text-[11px] text-slate-700 font-bold mb-1.5 flex items-center justify-between">
                    <span>Selected Size</span>
                    <span className="font-mono text-indigo-800">{currentSize}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {availableSizes.map((size) => (
                      <button
                        key={size}
                        onClick={() => handleSizeChange(size)}
                        className={`flex-1 py-1 rounded-xl text-xs font-bold transition-all border ${
                          currentSize === size
                            ? 'spatial-pill-active border-white text-slate-950 shadow-xs'
                            : 'spatial-pill border-white/60 text-slate-700 hover:bg-white/60'
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Scale Slider */}
                <div className="mb-2.5">
                  <div className="flex justify-between text-[11px] text-slate-700 font-semibold mb-1">
                    <span>Garment Silhouette Scale</span>
                    <span className="font-mono text-indigo-800 font-bold">{Math.round((tuningOptions.scale || 1.0) * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.80"
                    max="1.25"
                    step="0.01"
                    value={tuningOptions.scale || 1.0}
                    onChange={(e) => handleTuningChange({ scale: Number(e.target.value) })}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Bottom Bar: Garment Spec Badge */}
          <div className="w-full mt-4 flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <img
                src={garment.flatlayImage}
                alt={garment.name}
                className="w-12 h-12 object-contain rounded-xl bg-white/60 p-1 border border-white/80 shadow-xs"
              />
              <div>
                <h4 className="font-extrabold text-slate-900 text-sm">{garment.name}</h4>
                <div className="text-xs text-slate-500 font-medium">{garment.brand} &bull; {garment.fabricComposition}</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-xs text-slate-600 font-medium">
                  Size: <span className="font-bold text-slate-900">{currentSize}</span>
                </div>
                <div className="text-sm font-bold text-slate-900">{garment.price}</div>
              </div>

              <button
                onClick={handleDownload}
                className="p-2.5 rounded-full spatial-pill border border-white/80 text-slate-700 hover:text-slate-900 hover:bg-white shadow-xs"
                title="Download 4K Photo"
              >
                <Download className="w-4 h-4 text-slate-700" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Col: Size Recommendation Engine & Export Actions */}
        <div className="spatial-glass rounded-[2.5rem] p-6 border border-white/80 shadow-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs mb-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>MEASUREMENT REGRESSION ENGINE</span>
            </div>
            <h3 className="text-2xl font-extrabold text-slate-900 mb-3">Fit & Size Analysis</h3>

            {/* Llama Style & Return Reduction Trigger Card */}
            <div 
              onClick={() => {
                kioskAudio.playBeep(850, 0.05);
                setShowStyleAssistant(true);
              }}
              className="p-3.5 rounded-2xl bg-gradient-to-r from-indigo-900/10 via-violet-900/10 to-indigo-950/15 border border-indigo-500/30 mb-3.5 shadow-sm hover:border-indigo-500/60 cursor-pointer transition group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30 group-hover:scale-105 transition shrink-0">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                      <span>Llama Style & Sizing Advisor</span>
                      <span className="text-[9px] px-1.5 py-0.2 bg-indigo-600 text-white rounded font-bold uppercase tracking-wider">AI</span>
                    </div>
                    <div className="text-[11px] text-slate-600">
                      Honest Fit Analysis &bull; Return Risk Diagnostic
                    </div>
                  </div>
                </div>
                <span className="text-xs font-bold text-indigo-700 group-hover:translate-x-0.5 transition flex items-center">
                  Consult &rarr;
                </span>
              </div>
            </div>

            {/* Size Card */}
            <div className="p-4 rounded-2xl spatial-card border border-white/70 mb-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-600">Recommended Size</span>
                <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                  {Math.round(recommendation.confidence * 100)}% MATCH
                </span>
              </div>
              <div className="text-3xl font-black text-slate-900 font-mono mb-1">
                {isSaree ? 'FREE SIZE (6.3m)' : `SIZE ${recommendation.recommendedSize}`}
              </div>
              <div className="text-xs text-slate-500 font-medium">
                Derived from SMPL 3D human body shape estimation
              </div>
            </div>

            {/* Honesty Alert if applicable */}
            {recommendation.honestyWarning && (
              <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex gap-3 items-start mb-4">
                <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-950 font-medium leading-snug">
                  {recommendation.honestyWarning}
                </div>
              </div>
            )}

            {/* Quick Size Switcher */}
            <div className="mb-4">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
                Switch Preview Size
              </label>
              <div className="flex gap-1.5">
                {availableSizes.map((size) => (
                  <button
                    key={size}
                    onClick={() => handleSizeChange(size)}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                      currentSize === size
                        ? 'spatial-pill-active border-white text-slate-950 shadow-xs'
                        : 'spatial-pill border-white/60 text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Measurements Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono mb-6">
              <div className="p-2.5 rounded-2xl spatial-card border border-white/70 shadow-xs">
                <div className="text-[10px] text-slate-500 font-semibold">Chest</div>
                <div className="text-slate-900 font-bold">{recommendation.measurementBreakdown.chestCm} cm</div>
              </div>
              <div className="p-2.5 rounded-2xl spatial-card border border-white/70 shadow-xs">
                <div className="text-[10px] text-slate-500 font-semibold">Waist</div>
                <div className="text-slate-900 font-bold">{recommendation.measurementBreakdown.waistCm} cm</div>
              </div>
              <div className="p-2.5 rounded-2xl spatial-card border border-white/70 shadow-xs">
                <div className="text-[10px] text-slate-500 font-semibold">Hips</div>
                <div className="text-slate-900 font-bold">{recommendation.measurementBreakdown.hipCm} cm</div>
              </div>
              <div className="p-2.5 rounded-2xl spatial-card border border-white/70 shadow-xs">
                <div className="text-[10px] text-slate-500 font-semibold">Height</div>
                <div className="text-slate-900 font-bold">{recommendation.measurementBreakdown.heightCm} cm</div>
              </div>
            </div>

            {/* Take-Home Export */}
            <div className="p-4 rounded-2xl spatial-card border border-white/70 mb-6 shadow-xs">
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
                  <div className="w-28 h-28 bg-slate-900 rounded-lg flex items-center justify-center text-white text-[10px] font-mono text-center p-2">
                    [AURA QR: SCAN TO SAVE 4K LOOK & MEASUREMENTS]
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 font-mono">Session auto-expires in 15m</span>
                </div>
              )}

              <form onSubmit={handleSendEmail} className="flex gap-2">
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="name@example.com"
                  className="flex-1 bg-white/70 border border-white/90 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
                />
                <button
                  type="submit"
                  disabled={emailSent}
                  className="spatial-btn-primary px-3 py-2 rounded-xl text-white text-xs font-bold flex items-center gap-1 shadow-md"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{emailSent ? 'Sent!' : 'Send'}</span>
                </button>
              </form>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={handleTryAnother}
              className="w-full py-4 px-6 rounded-2xl spatial-btn-primary text-white font-bold tracking-wider flex items-center justify-center gap-2 shadow-xl active:scale-98"
            >
              <RotateCcw className="w-5 h-5 text-indigo-300" />
              <span>TRY ANOTHER LOOK</span>
            </button>

            <button
              onClick={handleFinish}
              className="w-full py-3 px-4 rounded-xl spatial-pill border border-white/70 text-slate-700 hover:text-slate-900 text-xs font-bold flex items-center justify-center gap-2 hover:bg-white/60 transition shadow-xs"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>FINISH SESSION & PURGE DATA</span>
            </button>
          </div>
        </div>
      </div>

      {/* Llama Style & Return Reduction Assistant Drawer */}
      <StyleAssistant
        sessionId={sessionId}
        garment={garment}
        selectedSize={currentSize}
        isOpen={showStyleAssistant}
        onClose={() => setShowStyleAssistant(false)}
        onSelectSize={handleSizeChange}
      />
    </div>
  );
};
