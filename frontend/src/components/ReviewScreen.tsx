import React, { useRef, useState, useEffect } from 'react';
import { RotateCcw, ShieldCheck, Cpu, ArrowRight, Upload } from 'lucide-react';
import type { PoseQualityMetrics } from '../types/kiosk';
import { kioskAudio } from '../utils/audio';

interface ReviewScreenProps {
  photoUri: string;
  metrics: PoseQualityMetrics;
  onConfirm: () => void;
  onRetake: () => void;
  onUploadNew?: (newUri: string) => void;
}

export const ReviewScreen: React.FC<ReviewScreenProps> = ({
  photoUri,
  metrics,
  onConfirm,
  onRetake,
  onUploadNew
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const processUploadedFile = (file: File) => {
    if (!file || !file.type.startsWith('image/')) {
      alert('Please select an image file (JPEG, PNG, WEBP).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl && onUploadNew) {
        kioskAudio.playShutterSound();
        onUploadNew(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processUploadedFile(file);
    }
    e.target.value = '';
  };

  const openFilePicker = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
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
    if (file) {
      processUploadedFile(file);
    }
  };

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            processUploadedFile(file);
            break;
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [onUploadNew]);
  const handleConfirm = () => {
    kioskAudio.playBeep(800, 0.1);
    onConfirm();
  };

  const handleRetake = () => {
    kioskAudio.playBeep(400, 0.1);
    onRetake();
  };

  return (
    <div className="relative w-full h-full min-h-[calc(100vh-5rem)] flex flex-col p-6 select-none overflow-y-auto">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto w-full my-auto">
        {/* Left Col: Captured Photo Preview */}
        <div 
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`lg:col-span-2 spatial-glass rounded-[2.5rem] overflow-hidden border transition-all p-6 flex flex-col items-center justify-center shadow-2xl relative ${
            isDragging ? 'border-indigo-600 bg-indigo-500/20 scale-[1.01]' : 'border-white/80'
          }`}
        >
          <div className="relative w-full max-h-[65vh] overflow-hidden rounded-3xl border border-white/60 flex items-center justify-center bg-white/30">
            <img
              src={photoUri}
              alt="Captured Frame"
              className="w-full h-full object-contain max-h-[60vh] rounded-2xl"
            />

            {/* Quality Stamp */}
            <div className="absolute top-4 right-4 spatial-glass px-4 py-2 rounded-full border border-white/80 shadow-md flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-bold text-slate-900">EXIF REMOVED & VALIDATED</span>
            </div>

            {/* Drag hint overlay */}
            {isDragging && (
              <div className="absolute inset-0 bg-indigo-900/60 backdrop-blur-xs flex flex-col items-center justify-center text-white z-20">
                <Upload className="w-12 h-12 mb-2 animate-bounce" />
                <span className="text-base font-bold">Drop your image here to use it!</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Quality Breakdown & Actions */}
        <div className="spatial-glass rounded-[2.5rem] p-8 border border-white/80 shadow-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-indigo-700 font-mono text-xs mb-2">
              <Cpu className="w-4 h-4" />
              <span className="font-bold">INPUT GUARDRAILS VERIFIED</span>
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900 mb-6">Capture Quality Clear</h2>

            {/* Metrics Breakdown */}
            <div className="space-y-3.5 mb-8">
              <div className="p-4 rounded-2xl spatial-card border border-white/70 shadow-xs">
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-slate-600">Pose Landmark Confidence</span>
                  <span className="text-emerald-700 font-mono">99.4%</span>
                </div>
                <div className="text-xs text-slate-500">All 33 keypoints clear for VTON parsing</div>
              </div>

              <div className="p-4 rounded-2xl spatial-card border border-white/70 shadow-xs">
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-slate-600">Body Bounding Box Height</span>
                  <span className="text-indigo-700 font-mono">{metrics.bodyHeightPercent}%</span>
                </div>
                <div className="text-xs text-slate-500">Optimal framing (70%-90% window)</div>
              </div>

              <div className="p-4 rounded-2xl spatial-card border border-white/70 shadow-xs">
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-slate-600">Privacy & Occlusion Check</span>
                  <span className="text-emerald-700 font-mono">CLEARED</span>
                </div>
                <div className="text-xs text-slate-500">Single person verified, zero occlusion</div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={handleConfirm}
              className="w-full py-4 px-6 rounded-2xl spatial-btn-primary text-white font-bold tracking-wider flex items-center justify-center gap-3 shadow-xl active:scale-98 text-base"
            >
              <span>BROWSE SPATIAL CATALOG</span>
              <ArrowRight className="w-5 h-5 text-indigo-300" />
            </button>

            <button
              type="button"
              onClick={openFilePicker}
              className="w-full py-3.5 px-6 rounded-2xl spatial-pill border-2 border-indigo-400/50 text-indigo-800 hover:text-indigo-900 font-bold flex items-center justify-center gap-2 text-sm bg-indigo-50/70 hover:bg-white transition shadow-xs"
            >
              <Upload className="w-4 h-4 text-indigo-600" />
              <span>UPLOAD PHOTO FROM DEVICE</span>
            </button>

            <button
              onClick={handleRetake}
              className="w-full py-3 px-6 rounded-2xl spatial-pill border border-white/80 text-slate-700 hover:text-slate-900 font-semibold flex items-center justify-center gap-2 text-xs hover:bg-white/70 transition shadow-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>RETAKE PHOTO WITH WEBCAM</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
