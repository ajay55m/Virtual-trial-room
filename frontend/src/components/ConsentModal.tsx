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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-md animate-fade-in select-none">
      <div className="spatial-glass w-full max-w-2xl rounded-[2.5rem] p-8 md:p-10 border border-white/90 shadow-2xl relative flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/40 pb-5 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl spatial-pill bg-white/70 border border-white text-slate-900 shadow-sm">
              <ShieldCheck className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-slate-900">Privacy & Consent Notice</h2>
              <p className="text-xs text-slate-600 font-medium">Biometric & Image Data Processing Policy (v2026.1)</p>
            </div>
          </div>
          <button
            onClick={handleDecline}
            className="p-2.5 rounded-full spatial-pill border border-white/60 text-slate-600 hover:text-slate-900 hover:bg-white/60"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Clauses */}
        <div className="space-y-3.5 text-sm text-slate-700 mb-8 max-h-[50vh] overflow-y-auto pr-2">
          <div className="p-4 rounded-2xl spatial-card border border-white/70 flex gap-4 items-start shadow-xs">
            <Lock className="w-5 h-5 text-indigo-700 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-slate-900 mb-0.5">Single-Frame Capture Only</div>
              <div className="text-xs text-slate-600 leading-relaxed">
                The kiosk captures a single high-resolution still image solely to generate your virtual garment preview. No live video stream is transmitted or stored externally.
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl spatial-card border border-white/70 flex gap-4 items-start shadow-xs">
            <Trash2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-slate-900 mb-0.5">Strict 15-Minute Ephemeral Purge (GDPR / BIPA)</div>
              <div className="text-xs text-slate-600 leading-relaxed">
                All captured photos, intermediate landmark masks, and measurement vector templates are automatically deleted from server memory at session conclusion (hard TTL limit of 15 minutes).
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl spatial-card border border-white/70 flex gap-4 items-start shadow-xs">
            <EyeOff className="w-5 h-5 text-purple-700 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-slate-900 mb-0.5">No Face or Biometric Identity Reselling</div>
              <div className="text-xs text-slate-600 leading-relaxed">
                Your body imagery is never sold, trained into public foundation models, or analyzed for biometric tracking. Relational databases store zero personal photos.
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleDecline}
            className="flex-1 py-4 px-6 rounded-2xl spatial-pill border border-white/80 text-slate-800 text-sm font-bold hover:bg-white/80 active:scale-98 transition shadow-xs"
          >
            I DECLINE
          </button>

          <button
            onClick={handleAgree}
            className="flex-1 py-4 px-6 rounded-2xl spatial-btn-primary text-white text-sm font-bold tracking-wider flex items-center justify-center gap-2.5 shadow-xl active:scale-98"
          >
            <span>I AGREE & CONTINUE</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
