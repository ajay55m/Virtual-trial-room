import React from 'react';
import { ShieldCheck, Lock, Trash2, EyeOff, ArrowRight, X } from 'lucide-react';
import { kioskAudio } from '../utils/audio';

interface ConsentModalProps {
  onAgree: () => void;
  onDecline: () => void;
}

export const ConsentModal: React.FC<ConsentModalProps> = ({ onAgree, onDecline }) => {
  const handleAgree = () => {
    kioskAudio.playBeep(800, 0.1);
    onAgree();
  };

  const handleDecline = () => {
    kioskAudio.playBeep(300, 0.1);
    onDecline();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-xl animate-fade-in select-none">
      <div className="glass-panel w-full max-w-2xl rounded-3xl p-8 border border-indigo-500/30 shadow-2xl relative flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-6 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Privacy & Consent Notice</h2>
              <p className="text-xs text-slate-400">Biometric & Image Data Processing Policy (v2026.1)</p>
            </div>
          </div>
          <button
            onClick={handleDecline}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content Clauses */}
        <div className="space-y-4 text-sm text-slate-300 mb-8 max-h-[50vh] overflow-y-auto pr-2">
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex gap-4 items-start">
            <Lock className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-white mb-1">Single-Frame Capture Only</div>
              <div className="text-xs text-slate-400">
                The kiosk captures a single high-resolution still image solely to generate your virtual garment preview. No live video stream is transmitted or stored externally.
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex gap-4 items-start">
            <Trash2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-white mb-1">Strict 15-Minute Ephemeral Purge (GDPR / BIPA)</div>
              <div className="text-xs text-slate-400">
                All captured photos, intermediate landmark masks, and measurement vector templates are automatically deleted from server memory at session conclusion (hard TTL limit of 15 minutes).
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex gap-4 items-start">
            <EyeOff className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-white mb-1">No Face/Biometric ID Reselling</div>
              <div className="text-xs text-slate-400">
                Your body imagery is never sold, trained into public foundation models, or analyzed for biometric tracking. Relational databases store zero personal photos.
              </div>
            </div>
          </div>
        </div>

        {/* Touch Action Buttons */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleDecline}
            className="flex-1 py-4 px-6 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300 text-base font-semibold hover:bg-slate-800 active:scale-98 transition"
          >
            I DECLINE
          </button>

          <button
            onClick={handleAgree}
            className="flex-1 py-4 px-6 rounded-2xl glass-button text-white text-base font-bold tracking-wider flex items-center justify-center gap-3 border border-white/20 active:scale-98"
          >
            <span>I AGREE & CONTINUE</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
