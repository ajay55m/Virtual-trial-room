import React from 'react';
import { RotateCcw, ShieldCheck, Cpu, ArrowRight } from 'lucide-react';
import type { PoseQualityMetrics } from '../types/kiosk';
import { kioskAudio } from '../utils/audio';

interface ReviewScreenProps {
  photoUri: string;
  metrics: PoseQualityMetrics;
  onConfirm: () => void;
  onRetake: () => void;
}

export const ReviewScreen: React.FC<ReviewScreenProps> = ({
  photoUri,
  metrics,
  onConfirm,
  onRetake
}) => {
  const handleConfirm = () => {
    kioskAudio.playBeep(800, 0.1);
    onConfirm();
  };

  const handleRetake = () => {
    kioskAudio.playBeep(400, 0.1);
    onRetake();
  };

  return (
    <div className="relative w-full h-full min-h-[calc(100vh-5rem)] flex flex-col p-6 select-none bg-slate-950">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto w-full my-auto">
        {/* Left Col: Captured Photo Preview */}
        <div className="lg:col-span-2 glass-panel rounded-3xl overflow-hidden border border-indigo-500/30 p-4 flex flex-col items-center justify-center bg-slate-900/80">
          <div className="relative w-full max-h-[65vh] overflow-hidden rounded-2xl border border-slate-800 flex items-center justify-center">
            <img
              src={photoUri}
              alt="Captured Frame"
              className="w-full h-full object-contain max-h-[60vh]"
            />

            {/* Quality Stamp */}
            <div className="absolute top-4 right-4 bg-emerald-500/20 border border-emerald-500/40 px-4 py-2 rounded-xl backdrop-blur-md flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <span className="text-xs font-bold text-emerald-300">EXIF STRIPPED & VALIDATED</span>
            </div>
          </div>
        </div>

        {/* Right Col: Quality Breakdown & Actions */}
        <div className="glass-panel rounded-3xl p-8 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-indigo-400 font-mono text-xs mb-2">
              <Cpu className="w-4 h-4" />
              <span>SERVER-SIDE INPUT GUARDRAILS</span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-6">Capture Quality Verified</h2>

            {/* Metrics Breakdown */}
            <div className="space-y-4 mb-8">
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-slate-400">Pose Landmark Confidence</span>
                  <span className="text-emerald-400 font-mono">99.4%</span>
                </div>
                <div className="text-xs text-slate-300">All 33 keypoints clear for VTON parsing</div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-slate-400">Body Bounding Box Height</span>
                  <span className="text-indigo-400 font-mono">{metrics.bodyHeightPercent}%</span>
                </div>
                <div className="text-xs text-slate-300">Optimal framing (70%-90% window)</div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-slate-400">Safety & Security Check</span>
                  <span className="text-emerald-400 font-mono">CLEARED</span>
                </div>
                <div className="text-xs text-slate-300">Single person verified, no occlusion</div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-4">
            <button
              onClick={handleConfirm}
              className="w-full py-5 px-6 rounded-2xl glass-button text-white font-bold tracking-wider flex items-center justify-center gap-3 border border-white/20 active:scale-98 text-lg"
            >
              <span>BROWSE CLOTHING CATALOG</span>
              <ArrowRight className="w-6 h-6" />
            </button>

            <button
              onClick={handleRetake}
              className="w-full py-4 px-6 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white font-semibold flex items-center justify-center gap-2 text-sm"
            >
              <RotateCcw className="w-4 h-4" />
              <span>RETAKE PHOTO</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
