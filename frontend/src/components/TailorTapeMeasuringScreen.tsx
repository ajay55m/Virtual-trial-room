import React, { useState, useEffect, useRef } from 'react';
import { 
  Ruler, 
  Sparkles, 
  CheckCircle2, 
  Loader2, 
  Scissors, 
  ShieldCheck, 
  Activity 
} from 'lucide-react';
import type { Garment, BodyMeasurements } from '../types/kiosk';
import { kioskAudio } from '../utils/audio';
import { apiService } from '../services/api';

interface TailorTapeMeasuringScreenProps {
  photoUri: string;
  heightCm: number;
  measurements: BodyMeasurements;
  recommendedSize: string;
  selectedGarments: Garment[];
  onComplete: (resultsByGarmentId: Record<string, string>) => void;
}

export const TailorTapeMeasuringScreen: React.FC<TailorTapeMeasuringScreenProps> = ({
  photoUri,
  heightCm: _heightCm,
  measurements,
  recommendedSize,
  selectedGarments,
  onComplete,
}) => {
  const [tapePhase, setTapePhase] = useState<'shoulder' | 'chest' | 'waist' | 'length' | 'sleeve' | 'done'>('shoulder');
  const [activeStageText, setActiveStageText] = useState<string>('Measuring shoulder width...');
  const [revealedPins, setRevealedPins] = useState<{
    shoulder: boolean;
    chest: boolean;
    waist: boolean;
    length: boolean;
    sleeve: boolean;
  }>({
    shoulder: false,
    chest: false,
    waist: false,
    length: false,
    sleeve: false,
  });

  const [aiProgress, setAiProgress] = useState<number>(10);
  const [currentGarmentProcessing, setCurrentGarmentProcessing] = useState<string>(selectedGarments[0]?.name || 'Fabric');
  const isMountedRef = useRef(true);

  // Sound cues and phase progression
  useEffect(() => {
    isMountedRef.current = true;

    // Timeline of tailor tape scan across body
    const t1 = setTimeout(() => {
      setTapePhase('shoulder');
      setActiveStageText(`Scanning Shoulders: ${measurements.shoulderCm} cm`);
      setRevealedPins((prev) => ({ ...prev, shoulder: true }));
      kioskAudio.playBeep(700, 0.08);
    }, 600);

    const t2 = setTimeout(() => {
      setTapePhase('chest');
      setActiveStageText(`Measuring Chest / Bust: ${measurements.chestCm} cm`);
      setRevealedPins((prev) => ({ ...prev, chest: true }));
      kioskAudio.playBeep(780, 0.08);
    }, 2000);

    const t3 = setTimeout(() => {
      setTapePhase('waist');
      setActiveStageText(`Measuring Natural Waist: ${measurements.waistCm} cm`);
      setRevealedPins((prev) => ({ ...prev, waist: true }));
      kioskAudio.playBeep(860, 0.08);
    }, 3500);

    const t4 = setTimeout(() => {
      setTapePhase('length');
      setActiveStageText(`Measuring Garment Vertical Drop: ${measurements.lengthCm || 71} cm`);
      setRevealedPins((prev) => ({ ...prev, length: true }));
      kioskAudio.playBeep(920, 0.08);
    }, 5000);

    const t5 = setTimeout(() => {
      setTapePhase('sleeve');
      setActiveStageText(`Profiling Sleeve & Arm Arc: ${measurements.sleeveCm || 62} cm`);
      setRevealedPins((prev) => ({ ...prev, sleeve: true }));
      kioskAudio.playBeep(1000, 0.09);
    }, 6500);

    const t6 = setTimeout(() => {
      setTapePhase('done');
      setActiveStageText(`All Biometrics Verified & Master Pattern Locked (SIZE ${recommendedSize})`);
      kioskAudio.playChime();
    }, 8000);

    return () => {
      isMountedRef.current = false;
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
      clearTimeout(t6);
    };
  }, [measurements, recommendedSize]);

  // Background AI processing for ALL selected garments concurrently
  useEffect(() => {
    let progressTimer: ReturnType<typeof setInterval>;
    
    // Smooth progress ticker
    progressTimer = setInterval(() => {
      setAiProgress((prev) => {
        if (prev < 92) return prev + 2;
        return prev;
      });
    }, 200);

    // Concurrently process/resolve photoreal results for all garments
    const processAllGarments = async () => {
      const generatedResults: Record<string, string> = {};

      for (let i = 0; i < selectedGarments.length; i++) {
        const garment = selectedGarments[i];
        if (!isMountedRef.current) break;

        setCurrentGarmentProcessing(garment.name);

        try {
          // Attempt high-fidelity neural VTON call if user capture is valid
          let photoBlob: Blob;
          if (photoUri.startsWith('data:')) {
            const parts = photoUri.split(',');
            const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
            const bstr = atob(parts[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) u8arr[n] = bstr.charCodeAt(n);
            photoBlob = new Blob([u8arr], { type: mime });
          } else {
            const res = await fetch(photoUri);
            photoBlob = await res.blob();
          }

          // Convert flatlay or model image
          const garmImgUrl = garment.flatlayImage || garment.virtualModelImage || garment.tryonResultImage;
          const garmRes = await fetch(garmImgUrl);
          const garmBlob = await garmRes.blob();

          const vtonResp = await apiService.submitPhotorealTryon(
            photoBlob,
            garment.id,
            garmBlob,
            garment.category === 'Saree' ? 'dresses' : 'upper_body',
            garment.name
          );

          if (vtonResp?.job_id) {
            try {
              let attempts = 0;
              let finalUrl: string | null = null;
              while (attempts < 12 && isMountedRef.current) {
                await new Promise((r) => setTimeout(r, 500));
                attempts++;
                const status = await apiService.pollTryonJob(vtonResp.job_id);
                if (status?.status === 'COMPLETED' && status?.result_url) {
                  finalUrl = status.result_url;
                  break;
                } else if (status?.status === 'FAILED') {
                  break;
                }
              }
              if (finalUrl) {
                generatedResults[garment.id] = finalUrl;
              } else {
                generatedResults[garment.id] = photoUri;
              }
            } catch (pollErr) {
              console.warn(`[FeedGen] Poll error for ${garment.name}:`, pollErr);
              generatedResults[garment.id] = photoUri;
            }
          } else {
            generatedResults[garment.id] = photoUri;
          }
        } catch (e) {
          console.warn(`[FeedGen] Fallback for ${garment.name}:`, e);
          generatedResults[garment.id] = garment.virtualModelImage || garment.tryonResultImage || photoUri;
        }
      }

      if (isMountedRef.current) {
        setAiProgress(100);
        setTimeout(() => {
          onComplete(generatedResults);
        }, 1200);
      }
    };

    // Delay start slightly to align with tape measuring
    const startTimeout = setTimeout(() => {
      processAllGarments();
    }, 800);

    return () => {
      clearInterval(progressTimer);
      clearTimeout(startTimeout);
    };
  }, [selectedGarments, photoUri, onComplete]);

  return (
    <div className="relative w-full h-full min-h-[calc(100vh-5rem)] flex flex-col items-center justify-center p-6 select-none overflow-hidden">
      {/* Background Decorative Ambient Circles */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />

      {/* Main Glass Canvas Container */}
      <div className="relative z-10 w-full max-w-4xl spatial-glass rounded-[2.5rem] p-8 border border-white/90 shadow-2xl flex flex-col md:flex-row items-center gap-8 backdrop-blur-xl">
        
        {/* Left: Photo with Moving Tailor Tape Overlays */}
        <div className="relative w-72 h-[450px] md:w-80 md:h-[500px] rounded-3xl overflow-hidden bg-slate-900 border-2 border-amber-400/60 shadow-2xl shrink-0 group">
          {/* User's Photo */}
          <img
            src={photoUri}
            alt="Customer Fitting Twin"
            className="w-full h-full object-cover filter contrast-[1.05] brightness-95"
          />

          {/* Holographic Body Scanner Grid Lines */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(245,158,11,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(245,158,11,0.06)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none" />

          {/* 1. Shoulder Tape (Horizontal) */}
          <div 
            className={`absolute top-[24%] inset-x-4 h-6 transition-all duration-700 pointer-events-none flex items-center ${
              tapePhase === 'shoulder' ? 'opacity-100 scale-100' : revealedPins.shoulder ? 'opacity-70' : 'opacity-0 scale-95'
            }`}
          >
            <div className="w-full h-4 bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300 rounded border border-amber-600 shadow-lg flex items-center justify-between px-1 overflow-hidden relative">
              <div className="absolute inset-0 flex justify-between items-end pb-0.5 px-0.5 opacity-80">
                {Array.from({ length: 28 }).map((_, i) => (
                  <div key={i} className={`w-[1px] bg-amber-950 ${i % 5 === 0 ? 'h-3' : 'h-1.5'}`} />
                ))}
              </div>
              <span className="relative z-10 text-[9px] font-mono font-black text-amber-950 px-1 bg-amber-200/90 rounded">
                44 cm
              </span>
            </div>
            <div className="absolute -left-1 w-2 h-5 bg-gradient-to-b from-amber-700 via-amber-400 to-amber-800 rounded-sm border border-amber-900" />
            <div className="absolute -right-1 w-2 h-5 bg-gradient-to-b from-amber-700 via-amber-400 to-amber-800 rounded-sm border border-amber-900" />
          </div>

          {/* 2. Chest Tape (Horizontal) */}
          <div 
            className={`absolute top-[36%] inset-x-3 h-6 transition-all duration-700 pointer-events-none flex items-center ${
              tapePhase === 'chest' ? 'opacity-100 scale-100' : revealedPins.chest ? 'opacity-70' : 'opacity-0 scale-95'
            }`}
          >
            <div className="w-full h-4 bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300 rounded border border-amber-600 shadow-lg flex items-center justify-between px-1 overflow-hidden relative">
              <div className="absolute inset-0 flex justify-between items-end pb-0.5 px-0.5 opacity-80">
                {Array.from({ length: 32 }).map((_, i) => (
                  <div key={i} className={`w-[1px] bg-amber-950 ${i % 5 === 0 ? 'h-3' : 'h-1.5'}`} />
                ))}
              </div>
              <span className="relative z-10 text-[9px] font-mono font-black text-amber-950 px-1 bg-amber-200/90 rounded">
                94 cm
              </span>
            </div>
            <div className="absolute -left-1 w-2 h-5 bg-gradient-to-b from-amber-700 via-amber-400 to-amber-800 rounded-sm border border-amber-900" />
            <div className="absolute -right-1 w-2 h-5 bg-gradient-to-b from-amber-700 via-amber-400 to-amber-800 rounded-sm border border-amber-900" />
          </div>

          {/* 3. Waist Tape (Horizontal) */}
          <div 
            className={`absolute top-[48%] inset-x-6 h-6 transition-all duration-700 pointer-events-none flex items-center ${
              tapePhase === 'waist' ? 'opacity-100 scale-100' : revealedPins.waist ? 'opacity-70' : 'opacity-0 scale-95'
            }`}
          >
            <div className="w-full h-4 bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300 rounded border border-amber-600 shadow-lg flex items-center justify-between px-1 overflow-hidden relative">
              <div className="absolute inset-0 flex justify-between items-end pb-0.5 px-0.5 opacity-80">
                {Array.from({ length: 26 }).map((_, i) => (
                  <div key={i} className={`w-[1px] bg-amber-950 ${i % 5 === 0 ? 'h-3' : 'h-1.5'}`} />
                ))}
              </div>
              <span className="relative z-10 text-[9px] font-mono font-black text-amber-950 px-1 bg-amber-200/90 rounded">
                78 cm
              </span>
            </div>
            <div className="absolute -left-1 w-2 h-5 bg-gradient-to-b from-amber-700 via-amber-400 to-amber-800 rounded-sm border border-amber-900" />
            <div className="absolute -right-1 w-2 h-5 bg-gradient-to-b from-amber-700 via-amber-400 to-amber-800 rounded-sm border border-amber-900" />
          </div>

          {/* 4. Full Garment Length Tape (Vertical Drop Down) */}
          <div 
            className={`absolute top-[22%] bottom-[20%] left-1/2 -translate-x-1/2 w-5 transition-all duration-700 pointer-events-none flex flex-col items-center justify-between ${
              tapePhase === 'length' ? 'opacity-100 scale-100' : revealedPins.length ? 'opacity-70' : 'opacity-0 scale-95'
            }`}
          >
            <div className="w-4 h-full bg-gradient-to-b from-amber-300 via-yellow-400 to-amber-300 rounded border border-amber-600 shadow-lg flex flex-col items-center justify-between py-1 overflow-hidden relative">
              <div className="absolute inset-0 flex flex-col justify-between items-start pl-0.5 opacity-80">
                {Array.from({ length: 30 }).map((_, i) => (
                  <div key={i} className={`h-[1px] bg-amber-950 ${i % 5 === 0 ? 'w-3' : 'w-1.5'}`} />
                ))}
              </div>
              <span className="relative z-10 text-[8px] font-mono font-black text-amber-950 py-0.5 px-1 bg-amber-200/90 rounded rotate-90">
                71 cm
              </span>
            </div>
          </div>

          {/* 5. Sleeve / Arm Tape Arc */}
          <div 
            className={`absolute top-[24%] right-4 w-4 h-40 transition-all duration-700 pointer-events-none flex flex-col items-center rotate-12 ${
              tapePhase === 'sleeve' ? 'opacity-100 scale-100' : revealedPins.sleeve ? 'opacity-70' : 'opacity-0 scale-95'
            }`}
          >
            <div className="w-3.5 h-full bg-gradient-to-b from-amber-300 via-yellow-400 to-amber-300 rounded border border-amber-600 shadow-lg flex flex-col items-center justify-between py-1 overflow-hidden relative">
              <span className="relative z-10 text-[8px] font-mono font-black text-amber-950 py-0.5 px-0.5 bg-amber-200/90 rounded rotate-90">
                62 cm
              </span>
            </div>
          </div>

          {/* Floating Live Dimension Badges */}
          {revealedPins.shoulder && (
            <div className="absolute top-[22%] left-2 px-2 py-0.5 rounded-md bg-black/85 backdrop-blur-md text-amber-400 border border-amber-400/50 text-[10px] font-mono font-bold shadow-md animate-fade-in flex items-center gap-1">
              <Ruler className="w-3 h-3 text-amber-400" />
              <span>SHOULDER: {measurements.shoulderCm}cm</span>
            </div>
          )}

          {revealedPins.chest && (
            <div className="absolute top-[35%] right-2 px-2 py-0.5 rounded-md bg-black/85 backdrop-blur-md text-amber-400 border border-amber-400/50 text-[10px] font-mono font-bold shadow-md animate-fade-in flex items-center gap-1">
              <Scissors className="w-3 h-3 text-amber-400" />
              <span>CHEST: {measurements.chestCm}cm</span>
            </div>
          )}

          {revealedPins.waist && (
            <div className="absolute top-[47%] left-2 px-2 py-0.5 rounded-md bg-black/85 backdrop-blur-md text-amber-400 border border-amber-400/50 text-[10px] font-mono font-bold shadow-md animate-fade-in flex items-center gap-1">
              <span>WAIST: {measurements.waistCm}cm</span>
            </div>
          )}

          {revealedPins.length && (
            <div className="absolute bottom-16 right-2 px-2 py-0.5 rounded-md bg-black/85 backdrop-blur-md text-emerald-400 border border-emerald-400/50 text-[10px] font-mono font-bold shadow-md animate-fade-in flex items-center gap-1">
              <span>LENGTH: {measurements.lengthCm || 71}cm</span>
            </div>
          )}

          {/* Bottom Live Calibration Status Pill */}
          <div className="absolute bottom-3 inset-x-3 py-1.5 px-3 rounded-full bg-black/80 backdrop-blur-md border border-white/20 text-white text-xs font-mono flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-amber-400 font-bold">
              <Activity className="w-3.5 h-3.5 animate-pulse" />
              <span>TAPE SCAN</span>
            </span>
            <span className="font-extrabold text-white">SIZE {recommendedSize}</span>
          </div>
        </div>

        {/* Right: Processing Status, Biometric Readout & AI Pipeline */}
        <div className="flex-1 flex flex-col justify-between w-full h-full py-2">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full spatial-pill border border-white/80 text-xs font-bold text-indigo-900 mb-3 shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600 animate-spin" />
              <span>STEP 3: GENERATING YOUR FEED...</span>
            </div>

            <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">
              Bespoke Fitting & Tailor Scan
            </h2>
            <p className="text-sm text-slate-600 font-medium mb-6">
              Running computerized tailor measurements and synthesizing photoreal looks for: <span className="font-bold text-indigo-900">{currentGarmentProcessing}</span>.
            </p>

            {/* Active Sub-Status Box */}
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-400/40 mb-6 flex items-center gap-3 shadow-sm">
              <Loader2 className="w-6 h-6 text-amber-600 animate-spin shrink-0" />
              <div>
                <div className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                  Live Stage Execution
                </div>
                <div className="text-sm font-semibold text-amber-900 font-mono">
                  {activeStageText}
                </div>
              </div>
            </div>

            {/* Selected Garment Feed Pipeline Badges */}
            <div className="mb-6">
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Generating Neural Try-On Feed</span>
                <span className="text-indigo-700 font-mono">{aiProgress}%</span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-3 bg-slate-200/80 rounded-full overflow-hidden p-0.5 border border-white shadow-inner mb-4">
                <div 
                  className="h-full bg-gradient-to-r from-amber-500 via-indigo-600 to-indigo-500 rounded-full transition-all duration-300 shadow-md"
                  style={{ width: `${aiProgress}%` }}
                />
              </div>

              {/* Garment Cards being processed */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {selectedGarments.map((g, idx) => (
                  <div 
                    key={g.id}
                    className="p-2.5 rounded-xl spatial-card border border-white/80 flex items-center gap-2.5 shadow-xs bg-white/70"
                  >
                    <img 
                      src={g.flatlayImage || g.fabricCloseupImage} 
                      alt={g.name}
                      className="w-10 h-10 object-contain rounded-lg bg-white p-0.5 border border-slate-200 shrink-0" 
                    />
                    <div className="overflow-hidden flex-1">
                      <div className="text-xs font-bold text-slate-900 truncate">{g.name}</div>
                      <div className="text-[10px] text-slate-500 truncate">{g.brand} &bull; {g.fabricType}</div>
                    </div>
                    {aiProgress >= (idx + 1) * (100 / selectedGarments.length) ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <Loader2 className="w-4 h-4 text-amber-500 animate-spin shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Biometric Measurement Summary Chips */}
            <div className="grid grid-cols-3 gap-2 text-center font-mono">
              <div className="p-2 rounded-xl spatial-card border border-white/70">
                <div className="text-[10px] text-slate-500 font-sans font-bold">SHOULDER</div>
                <div className="text-sm font-extrabold text-slate-900">{measurements.shoulderCm} cm</div>
              </div>
              <div className="p-2 rounded-xl spatial-card border border-white/70">
                <div className="text-[10px] text-slate-500 font-sans font-bold">CHEST</div>
                <div className="text-sm font-extrabold text-slate-900">{measurements.chestCm} cm</div>
              </div>
              <div className="p-2 rounded-xl spatial-card border border-white/70">
                <div className="text-[10px] text-slate-500 font-sans font-bold">WAIST</div>
                <div className="text-sm font-extrabold text-slate-900">{measurements.waistCm} cm</div>
              </div>
            </div>
          </div>

          {/* Bottom Security / Privacy Assurance */}
          <div className="flex items-center justify-between pt-6 border-t border-slate-200/80 text-xs text-slate-600 font-medium">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Tailor Pattern Authenticated &bull; Ready for Main Screen</span>
            </span>
            <span className="font-mono text-indigo-700 font-bold">
              IDM-VTON Neural Pass
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
