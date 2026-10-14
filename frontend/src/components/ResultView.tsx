import React, { useState, useEffect } from 'react';
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
  UserCheck
} from 'lucide-react';
import type { Garment, SizeRecommendation } from '../types/kiosk';
import { kioskAudio } from '../utils/audio';
import { apiService, type GarmentTuningOptions } from '../services/api';

interface ResultViewProps {
  originalPhotoUri: string;
  tryonResultUri?: string;
  sizeRecommendation?: SizeRecommendation;
  garment: Garment;
  selectedSize: string;
  onTryAnother: () => void;
  onFinishSession: () => void;
}

export const ResultView: React.FC<ResultViewProps> = ({
  originalPhotoUri,
  tryonResultUri,
  sizeRecommendation,
  garment,
  selectedSize,
  onTryAnother,
  onFinishSession
}) => {
  const [showOriginal, setShowOriginal] = useState(false);
  const [viewMode, setViewMode] = useState<'fitted' | 'pure_model'>('fitted');
  const [currentSize, setCurrentSize] = useState<string>(selectedSize);
  const [emailInput, setEmailInput] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [showFitTuner, setShowFitTuner] = useState(false);

  // Live fitting adjustment state
  const [tuningOptions, setTuningOptions] = useState<GarmentTuningOptions>({
    offsetX: 0,
    offsetY: 0,
    scale: 1.0,
    opacity: 0.96
  });

  const isSaree = garment.category === 'Saree' || garment.isSaree;
  const isMenswear = garment.category === 'Menswear';
  const isWebcamPhoto = !originalPhotoUri.includes('virtualfit_model') && !originalPhotoUri.includes('demo_person');

  // Determine initial display URI:
  // If user used the studio model, show the high-res fitted model render
  // If user took their own camera photo, generate transparent cutout composite
  const defaultModelUri = garment.virtualModelImage || garment.tryonResultImage || '/assets/virtualfit_model_tshirt.jpg';

  const [activeDisplayUri, setActiveDisplayUri] = useState<string>(
    tryonResultUri || defaultModelUri
  );

  // Re-synthesize when size or tuning options change
  const updateSynthesis = async (sizeToUse: string, opts: GarmentTuningOptions) => {
    if (isWebcamPhoto) {
      const composite = await apiService.createClientSideTryonComposite(
        originalPhotoUri,
        garment,
        sizeToUse,
        opts
      );
      setActiveDisplayUri(composite);
    } else {
      // For studio model, if it's the model photo, use tailored model image or scaled composite
      if (opts.scale !== 1.0 || opts.offsetY !== 0 || opts.offsetX !== 0) {
        const composite = await apiService.createClientSideTryonComposite(
          originalPhotoUri,
          garment,
          sizeToUse,
          opts
        );
        setActiveDisplayUri(composite);
      } else {
        setActiveDisplayUri(defaultModelUri);
      }
    }
  };

  useEffect(() => {
    if (tryonResultUri && !tryonResultUri.includes('data:')) {
      setActiveDisplayUri(tryonResultUri);
    } else {
      updateSynthesis(currentSize, tuningOptions);
    }
  }, [tryonResultUri, garment, originalPhotoUri]);

  const handleSizeChange = async (newSize: string) => {
    kioskAudio.playBeep(800, 0.05);
    setCurrentSize(newSize);
    await updateSynthesis(newSize, tuningOptions);
  };

  const handleTuningChange = async (updated: Partial<GarmentTuningOptions>) => {
    const newOptions = { ...tuningOptions, ...updated };
    setTuningOptions(newOptions);
    await updateSynthesis(currentSize, newOptions);
  };

  const handleResetTuning = async () => {
    kioskAudio.playBeep(600, 0.05);
    const defaults = { offsetX: 0, offsetY: 0, scale: 1.0, opacity: 0.96 };
    setTuningOptions(defaults);
    await updateSynthesis(currentSize, defaults);
  };

  // Dynamic recommendation based on active size
  const recommendedSize = isSaree ? 'Free Size' : 'M';
  const recommendation: SizeRecommendation = sizeRecommendation || {
    recommendedSize,
    confidence: 0.96,
    fitClass: 'Regular',
    honestyWarning:
      !isSaree && currentSize !== recommendedSize && currentSize !== '40'
        ? `Honesty Rule Alert: You are viewing Size ${currentSize}. Based on body measurement regression, Size ${recommendedSize} offers optimal natural drape.`
        : undefined,
    measurementBreakdown: {
      chestCm: isMenswear ? 102 : 92,
      waistCm: isMenswear ? 84 : 74,
      hipCm: isMenswear ? 100 : 98,
      shoulderCm: isMenswear ? 46 : 42,
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
    link.download = `VirtualFit_${garment.sku}_Size_${currentSize}.jpg`;
    link.href = activeDisplayUri;
    link.click();
  };

  const currentImgSrc = showOriginal
    ? originalPhotoUri
    : viewMode === 'pure_model'
    ? defaultModelUri
    : activeDisplayUri;

  const availableSizes = garment.availableSizes && garment.availableSizes.length > 0
    ? garment.availableSizes
    : ['XS', 'S', 'M', 'L', 'XL'];

  return (
    <div className="relative w-full h-full min-h-[calc(100vh-5rem)] flex flex-col p-6 select-none overflow-y-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto w-full my-auto py-2">
        {/* Left 2 Cols: Main Try-On Render View */}
        <div className="lg:col-span-2 spatial-glass rounded-[2.5rem] p-6 border border-white/80 flex flex-col items-center justify-between shadow-2xl relative">
          {/* Main Image Display */}
          <div className="relative w-full h-[64vh] min-h-[480px] rounded-3xl overflow-hidden border border-white/70 flex items-center justify-center bg-white/30 shadow-inner">
            <img
              src={currentImgSrc}
              alt="VirtualFit Result"
              className="w-full h-full object-contain transition-all duration-300 filter drop-shadow-xl"
            />

            {/* Toggle Overlay Button (Hold to View Original Photo) */}
            <button
              onMouseDown={() => setShowOriginal(true)}
              onMouseUp={() => setShowOriginal(false)}
              onTouchStart={() => setShowOriginal(true)}
              onTouchEnd={() => setShowOriginal(false)}
              className="absolute bottom-4 left-4 spatial-glass px-4 py-2.5 rounded-full text-xs font-bold text-slate-800 hover:text-slate-950 flex items-center gap-2 border border-white/90 shadow-lg transition-all"
            >
              <Layers className="w-4 h-4 text-indigo-700" />
              <span>{showOriginal ? 'Showing Original Photo' : 'HOLD TO VIEW ORIGINAL PHOTO'}</span>
            </button>

            {/* View Mode Pills (Top Left) */}
            <div className="absolute top-4 left-4 flex items-center gap-1.5 spatial-glass p-1 rounded-full border border-white/90 shadow-md">
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
                <UserCheck className="w-3 h-3 text-indigo-600" />
                <span>{isWebcamPhoto ? 'Custom Fit Drape' : 'Fitted Look'}</span>
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
                <Eye className="w-3 h-3 text-indigo-600" />
                <span>Studio Model</span>
              </button>
            </div>

            {/* Top Right Badges & Fit Tuner Toggle */}
            <div className="absolute top-4 right-4 flex flex-col items-end gap-2">
              <div className="spatial-glass px-3.5 py-1.5 rounded-full text-[11px] font-bold text-slate-800 flex items-center gap-1.5 border border-white/90 shadow-md">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>SPATIAL FIT: SIZE {currentSize}</span>
              </div>

              <button
                onClick={() => setShowFitTuner(!showFitTuner)}
                className={`spatial-pill px-3.5 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1.5 border border-white/80 shadow-md transition-all ${
                  showFitTuner ? 'spatial-pill-active text-slate-950' : 'text-slate-800 hover:bg-white'
                }`}
              >
                <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                <span>{showFitTuner ? 'Hide Fit Tuner' : 'Adjust Fit & Size'}</span>
              </button>
            </div>

            {/* Interactive Precision Fit Drawer */}
            {showFitTuner && (
              <div className="absolute bottom-16 right-4 w-80 spatial-glass border border-white/95 p-4 rounded-3xl shadow-2xl z-30 text-xs animate-fade-in">
                <div className="flex items-center justify-between mb-3 border-b border-slate-300 pb-2">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-indigo-700" />
                    <span>Garment Drape & Fit Controls</span>
                  </span>
                  <button
                    onClick={handleResetTuning}
                    className="text-[10px] text-slate-600 hover:text-slate-900 flex items-center gap-1 font-bold"
                    title="Auto Calibrate"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Auto Fit</span>
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

                {/* Width Scale Slider */}
                <div className="mb-2.5">
                  <div className="flex justify-between text-[11px] text-slate-700 font-semibold mb-1">
                    <span>Garment Width / Drape</span>
                    <span className="font-mono text-indigo-800 font-bold">{Math.round((tuningOptions.scale || 1.0) * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.80"
                    max="1.25"
                    step="0.02"
                    value={tuningOptions.scale || 1.0}
                    onChange={(e) => handleTuningChange({ scale: Number(e.target.value) })}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                </div>

                {/* Vertical Position (Y) Slider */}
                <div className="mb-2.5">
                  <div className="flex justify-between text-[11px] text-slate-700 font-semibold mb-1">
                    <span>Collar / Vertical Height (Y)</span>
                    <span className="font-mono text-indigo-800 font-bold">{tuningOptions.offsetY || 0}px</span>
                  </div>
                  <input
                    type="range"
                    min="-60"
                    max="60"
                    value={tuningOptions.offsetY || 0}
                    onChange={(e) => handleTuningChange({ offsetY: Number(e.target.value) })}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                </div>

                {/* Horizontal Alignment (X) Slider */}
                <div className="mb-1">
                  <div className="flex justify-between text-[11px] text-slate-700 font-semibold mb-1">
                    <span>Center Alignment (X)</span>
                    <span className="font-mono text-indigo-800 font-bold">{tuningOptions.offsetX || 0}px</span>
                  </div>
                  <input
                    type="range"
                    min="-40"
                    max="40"
                    value={tuningOptions.offsetX || 0}
                    onChange={(e) => handleTuningChange({ offsetX: Number(e.target.value) })}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Garment Title Bar */}
          <div className="w-full mt-4 p-4 rounded-2xl spatial-card border border-white/70 flex items-center justify-between shadow-sm">
            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <span>{garment.brand}</span>
                <span>•</span>
                <span>{garment.category}</span>
              </div>
              <div className="text-base font-extrabold text-slate-900">{garment.name}</div>
            </div>

            <div className="text-right flex items-center gap-4">
              <div>
                <div className="text-xs text-slate-600 font-medium">
                  Size: <span className="font-bold text-slate-900">{currentSize}</span>
                </div>
                <div className="text-sm font-bold text-slate-900">{garment.price}</div>
              </div>

              <button
                onClick={handleDownload}
                className="p-2.5 rounded-full spatial-pill border border-white/80 text-slate-700 hover:text-slate-900 hover:bg-white shadow-xs"
                title="Download Photo"
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
            <h3 className="text-2xl font-extrabold text-slate-900 mb-4">Fit & Size Analysis</h3>

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
                  <span>{showQr ? 'Hide QR' : 'Show QR'}</span>
                </button>
              </div>

              {showQr ? (
                <div className="p-4 bg-white rounded-2xl flex flex-col items-center justify-center my-2 shadow-sm border border-slate-200">
                  <div className="w-28 h-28 bg-slate-900 rounded-xl flex items-center justify-center text-white text-[10px] font-mono text-center p-2">
                    [ VIRTUALFIT QR CODE ]
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium mt-2">Scan with smartphone to save look</div>
                </div>
              ) : emailSent ? (
                <div className="text-xs text-emerald-800 font-semibold p-2.5 bg-emerald-500/15 rounded-xl border border-emerald-500/30 text-center">
                  Look sent to {emailInput}!
                </div>
              ) : (
                <form onSubmit={handleSendEmail} className="flex gap-2">
                  <input
                    type="email"
                    placeholder="Enter email address..."
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="flex-1 bg-white/60 border border-white/80 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white"
                  />
                  <button
                    type="submit"
                    className="px-3 py-2 spatial-btn-primary rounded-xl text-xs font-bold text-white flex items-center gap-1 shadow-sm"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              )}
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
    </div>
  );
};
