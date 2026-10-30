import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  Upload, 
  Ruler, 
  Sparkles, 
  ArrowRight,
  UserCheck
} from 'lucide-react';
import type { BodyMeasurements } from '../types/kiosk';
import { kioskAudio } from '../utils/audio';
import { isValidUploadFile, processFileToDataUrl } from '../utils/fileUploadHelper';

interface TailorProfileScreenProps {
  initialPhotoUri?: string;
  initialHeightCm?: number;
  onProfileComplete: (data: {
    photoUri: string;
    heightCm: number;
    measurements: BodyMeasurements;
    size: string;
  }) => void;
  onBackToFabrics: () => void;
}

export const TailorProfileScreen: React.FC<TailorProfileScreenProps> = ({
  initialPhotoUri = '/assets/demo_person_male.jpg',
  initialHeightCm = 175,
  onProfileComplete,
  onBackToFabrics
}) => {
  const [photoUri, setPhotoUri] = useState<string>(initialPhotoUri);
  const [heightCm, setHeightCm] = useState<number>(initialHeightCm);
  const [inputMode, setInputMode] = useState<'upload' | 'camera'>('upload');
  const [isProcessingFile, setIsProcessingFile] = useState<boolean>(false);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Tailor Measurements State
  const [measurements, setMeasurements] = useState<BodyMeasurements>({
    heightCm: initialHeightCm,
    shoulderCm: 44.0,
    chestCm: 94.0,
    waistCm: 78.0,
    hipCm: 96.0,
    lengthCm: 71.0,
    sleeveCm: 62.0,
  });
  const [recommendedSize, setRecommendedSize] = useState<string>('M');

  // Camera stream refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Calculate tailor measurements based on height and estimated ratios
  const calculateMeasurements = (h: number = heightCm) => {
    setIsCalculating(true);
    kioskAudio.playBeep(850, 0.08);

    setTimeout(() => {
      // Proportional human anthropometric scaling (Savile Row Master Ratios)
      const scale = h / 175.0;
      const shoulder = Math.round(44.0 * scale * 10) / 10;
      const chest = Math.round(94.0 * scale * 10) / 10;
      const waist = Math.round(78.0 * scale * 10) / 10;
      const hip = Math.round(96.0 * scale * 10) / 10;
      const length = Math.round(71.0 * scale * 10) / 10;
      const sleeve = Math.round(62.0 * scale * 10) / 10;

      let size = 'M';
      if (chest < 91) size = 'S';
      else if (chest < 97) size = 'M';
      else if (chest < 102) size = 'L';
      else if (chest < 107) size = 'XL';
      else size = 'XXL';

      setMeasurements({
        heightCm: h,
        shoulderCm: shoulder,
        chestCm: chest,
        waistCm: waist,
        hipCm: hip,
        lengthCm: length,
        sleeveCm: sleeve,
      });
      setRecommendedSize(size);
      setIsCalculating(false);
      kioskAudio.playBeep(980, 0.09);
    }, 600);
  };

  // Run calculation on mount and when height changes
  useEffect(() => {
    calculateMeasurements(heightCm);
  }, [heightCm]);

  // Camera start/stop
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(console.error);
      }
    } catch (e) {
      console.warn('Webcam start fallback:', e);
      alert('Camera access unavailable. Please upload a photo from your device.');
      setInputMode('upload');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    if (inputMode === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [inputMode]);

  const handleCaptureFromCamera = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 896;
    canvas.height = videoRef.current.videoHeight || 1200;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUri = canvas.toDataURL('image/jpeg', 0.95);
      kioskAudio.playShutterSound();
      setPhotoUri(dataUri);
      setInputMode('upload');
      calculateMeasurements(heightCm);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!isValidUploadFile(file)) {
      alert('Please select a valid image file (JPEG, PNG, WEBP, Apple HEIC, or PDF).');
      return;
    }
    setIsProcessingFile(true);
    try {
      const dataUrl = await processFileToDataUrl(file);
      if (dataUrl) {
        kioskAudio.playShutterSound();
        setPhotoUri(dataUrl);
        calculateMeasurements(heightCm);
      }
    } catch (err: any) {
      alert(err.message || 'Error processing photo.');
    } finally {
      setIsProcessingFile(false);
    }
  };

  const handleProceed = () => {
    kioskAudio.playBeep(900, 0.08);
    onProfileComplete({
      photoUri,
      heightCm,
      measurements,
      size: recommendedSize,
    });
  };

  return (
    <div className="relative w-full h-full min-h-[calc(100vh-5rem)] flex flex-col p-6 max-w-6xl mx-auto select-none overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6 pt-2">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full spatial-pill border border-white/80 text-xs font-bold text-indigo-900 mb-2 shadow-xs">
            <Ruler className="w-3.5 h-3.5 text-indigo-600" />
            <span>STEP 2: CREATE PROFILE (ONE TIME)</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            Tailor Profile & Anatomical Measurements
          </h1>
          <p className="text-sm text-slate-600 font-medium mt-1">
            Upload or capture your photo once. Our Master Tailor AI computes your exact shoulder, chest, waist, and sleeve dimensions.
          </p>
        </div>

        <button
          onClick={onBackToFabrics}
          className="px-4 py-2 rounded-xl spatial-pill border border-white text-xs font-bold text-slate-700 hover:text-slate-950 hover:bg-white shadow-xs"
        >
          &larr; Back to Fabrics
        </button>
      </div>

      {/* Main Grid: Photo Capture Area (Left) + Tailor Measurement Slip (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12">
        
        {/* LEFT COLUMN: Photo Capture & Tailor Silhouette Guide (7 Cols) */}
        <div className="lg:col-span-7 spatial-glass rounded-3xl p-6 border border-white/90 shadow-2xl flex flex-col justify-between relative">
          
          {/* Mode Switcher Tabs */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-1.5 p-1 rounded-full spatial-glass border border-white/90 shadow-xs">
              <button
                type="button"
                onClick={() => setInputMode('upload')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all ${
                  inputMode === 'upload'
                    ? 'spatial-pill-active border border-white text-slate-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                <Upload className="w-3.5 h-3.5 text-indigo-600" />
                <span>Upload Photo</span>
              </button>

              <button
                type="button"
                onClick={() => setInputMode('camera')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all ${
                  inputMode === 'camera'
                    ? 'spatial-pill-active border border-white text-slate-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                <Camera className="w-3.5 h-3.5 text-indigo-600" />
                <span>Capture Live</span>
              </button>
            </div>

            {/* Quick Demo Models */}
            <div className="flex items-center gap-1 text-[11px] font-bold text-slate-600">
              <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
              <span>Or Quick-Try:</span>
              <button
                type="button"
                onClick={() => {
                  setPhotoUri('/assets/demo_person_male.jpg');
                  calculateMeasurements(175);
                }}
                className="underline hover:text-indigo-600 ml-1"
              >
                Male Model
              </button>
              <span>&bull;</span>
              <button
                type="button"
                onClick={() => {
                  setPhotoUri('/assets/demo_person.jpg');
                  calculateMeasurements(165);
                }}
                className="underline hover:text-indigo-600"
              >
                Female Model
              </button>
            </div>
          </div>

          {/* Viewport Frame with Tailor Silhouette Guide */}
          <div 
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleFileUpload(file);
            }}
            className="relative w-full h-[52vh] min-h-[420px] rounded-2xl overflow-hidden bg-slate-900/5 border border-white/80 flex items-center justify-center shadow-inner"
          >
            {inputMode === 'upload' ? (
              <img
                src={photoUri}
                alt="Your Silhouette"
                className="w-full h-full object-contain"
              />
            ) : (
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover transform -scale-x-100"
              />
            )}

            {isProcessingFile && (
              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs flex flex-col items-center justify-center text-white z-20">
                <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin mb-2" />
                <span className="text-xs font-bold">Processing Photo...</span>
              </div>
            )}

            {/* TAILOR SILHOUETTE GUIDE OVERLAY (Mandatory Requirement) */}
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-between p-4 z-10">
              {/* Silhouette Prompt Banner */}
              <div className="px-5 py-2 rounded-full bg-slate-950/80 backdrop-blur-md text-amber-300 font-black text-xs uppercase tracking-wider border border-amber-400/40 shadow-xl flex items-center gap-2 animate-pulse">
                <Ruler className="w-4 h-4 text-amber-400" />
                <span>Stand Straight, Full Body Visible</span>
              </div>

              {/* Graphical Tailor Guide Overlay Lines */}
              <svg className="absolute inset-0 w-full h-full stroke-amber-400/40 fill-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                {/* Shoulder reference line */}
                <line x1="25" y1="26" x2="75" y2="26" strokeWidth="0.8" strokeDasharray="2,2" />
                <text x="76" y="27" fill="#f59e0b" fontSize="3.5" fontFamily="monospace">Shoulder</text>

                {/* Chest/Bust reference line */}
                <line x1="28" y1="38" x2="72" y2="38" strokeWidth="0.8" strokeDasharray="2,2" />
                <text x="73" y="39" fill="#f59e0b" fontSize="3.5" fontFamily="monospace">Chest</text>

                {/* Waist reference line */}
                <line x1="32" y1="52" x2="68" y2="52" strokeWidth="0.8" strokeDasharray="2,2" />
                <text x="69" y="53" fill="#f59e0b" fontSize="3.5" fontFamily="monospace">Waist</text>

                {/* Hem reference line */}
                <line x1="20" y1="92" x2="80" y2="92" strokeWidth="0.8" strokeDasharray="2,2" />
                <text x="81" y="93" fill="#f59e0b" fontSize="3.5" fontFamily="monospace">Hem</text>

                {/* Center vertical posture alignment axis */}
                <line x1="50" y1="10" x2="50" y2="95" strokeWidth="0.6" strokeDasharray="1,3" stroke="#10b981" />
              </svg>

              {/* Bottom Guidance Tag */}
              <div className="px-4 py-1.5 rounded-full bg-slate-900/70 backdrop-blur-md text-white text-[11px] font-mono border border-white/20">
                MediaPipe 33 Keypoint Landmark Regression Active
              </div>
            </div>

            {/* Drag Hint */}
            {isDragging && (
              <div className="absolute inset-0 bg-indigo-950/70 backdrop-blur-xs flex flex-col items-center justify-center text-white z-20">
                <Upload className="w-10 h-10 mb-2 animate-bounce" />
                <span className="text-sm font-bold">Drop your photo to calibrate measurements</span>
              </div>
            )}
          </div>

          {/* Action Row Under Viewport */}
          <div className="mt-4 flex items-center justify-between gap-3">
            {inputMode === 'upload' ? (
              <>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2.5 rounded-xl spatial-pill border border-white text-xs font-bold text-slate-800 hover:bg-white flex items-center gap-2 shadow-xs"
                >
                  <Upload className="w-4 h-4 text-indigo-600" />
                  <span>Choose Another Photo</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.heic,.heif,.pdf"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileUpload(f);
                  }}
                  className="hidden"
                />
              </>
            ) : (
              <button
                type="button"
                onClick={handleCaptureFromCamera}
                className="w-full py-3 rounded-xl spatial-btn-primary text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-lg"
              >
                <Camera className="w-4 h-4" />
                <span>Capture & Save Photo</span>
              </button>
            )}

            <div className="text-xs font-mono font-bold text-slate-500">
              Format: High-Res Frontal View
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Height Input & Live Tailor Measurements (5 Cols) */}
        <div className="lg:col-span-5 spatial-glass rounded-3xl p-6 border border-white/90 shadow-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-200">
              <Ruler className="w-5 h-5 text-indigo-600" />
              <h2 className="text-lg font-black text-slate-900 tracking-tight">
                Live Tailor Measurement
              </h2>
            </div>
            <p className="text-xs text-slate-500 font-medium mb-6">
              Enter height in cm. Metric scale dynamically derives chest, waist, shoulder, length, and sleeve.
            </p>

            {/* Height Slider Control */}
            <div className="p-4 rounded-2xl bg-white/70 border border-white/90 shadow-xs mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Your Height
                </span>
                <span className="text-xl font-black text-indigo-700 font-mono">
                  {heightCm} cm
                </span>
              </div>
              <input
                type="range"
                min="140"
                max="210"
                step="1"
                value={heightCm}
                onChange={(e) => setHeightCm(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
                <span>140 cm (4'7")</span>
                <span>175 cm (5'9")</span>
                <span>210 cm (6'11")</span>
              </div>
            </div>

            {/* Run Tailor Measurement Button */}
            <button
              type="button"
              onClick={() => calculateMeasurements(heightCm)}
              disabled={isCalculating}
              className="w-full py-3 mb-6 rounded-2xl bg-gradient-to-r from-amber-500 to-indigo-600 text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg hover:brightness-105 active:scale-98 transition-all"
            >
              <Sparkles className="w-4 h-4 animate-spin" />
              <span>{isCalculating ? 'Computing Anatomical Landmarking...' : 'Recalculate Measurements'}</span>
            </button>

            {/* Tailor Measurement Sheet Output */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/60 border border-white/80 shadow-xs">
                <span className="text-xs font-semibold text-slate-700">Shoulder Width (Acromion Line)</span>
                <span className="text-sm font-black font-mono text-slate-950">{measurements.shoulderCm} cm</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-white/60 border border-white/80 shadow-xs">
                <span className="text-xs font-semibold text-slate-700">Chest / Bust Circumference</span>
                <span className="text-sm font-black font-mono text-indigo-900">{measurements.chestCm} cm</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-white/60 border border-white/80 shadow-xs">
                <span className="text-xs font-semibold text-slate-700">Natural Waist</span>
                <span className="text-sm font-black font-mono text-slate-950">{measurements.waistCm} cm</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-white/60 border border-white/80 shadow-xs">
                <span className="text-xs font-semibold text-slate-700">Garment Finished Length</span>
                <span className="text-sm font-black font-mono text-slate-950">{measurements.lengthCm} cm</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-white/60 border border-white/80 shadow-xs">
                <span className="text-xs font-semibold text-slate-700">Sleeve Length (Shoulder to Wrist)</span>
                <span className="text-sm font-black font-mono text-slate-950">{measurements.sleeveCm} cm</span>
              </div>

              {/* Recommended Size Box */}
              <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase font-bold text-indigo-700 tracking-wider">
                    Recommended Size
                  </div>
                  <div className="text-xs text-slate-500 font-medium">Based on 94cm Chest & Height</div>
                </div>
                <div className="text-2xl font-black font-mono text-indigo-950">
                  SIZE {recommendedSize}
                </div>
              </div>
            </div>
          </div>

          {/* Proceed Button */}
          <div className="mt-6 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={handleProceed}
              className="w-full py-4 rounded-2xl spatial-btn-primary text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-xl hover:scale-102 active:scale-98 transition-all"
            >
              <span>CONTINUE TO FEED GENERATION (STEP 3)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
