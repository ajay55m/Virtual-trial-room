import React from 'react';
import { Sparkles, Touchpad, ShieldCheck, Shirt, Ruler } from 'lucide-react';
import { kioskAudio } from '../utils/audio';

interface IdleScreenProps {
  onStart: () => void;
}

export const IdleScreen: React.FC<IdleScreenProps> = ({ onStart }) => {
  const handleClick = () => {
    kioskAudio.playBeep(600, 0.1);
    onStart();
  };

  return (
    <div
      onClick={handleClick}
      className="relative w-full h-full max-h-screen flex flex-col justify-between p-4 sm:p-6 md:p-8 overflow-hidden cursor-pointer select-none"
    >
      {/* Top Header Floating Badge */}
      <div className="relative z-10 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5 sm:gap-3 spatial-pill px-3.5 py-1.5 sm:px-4 sm:py-2 border border-white/70 shadow-md">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-900 flex items-center justify-center text-white shadow-xs">
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-300" />
          </div>
          <div>
            <div className="text-sm sm:text-base font-extrabold tracking-tight text-slate-900 leading-none">VirtualFit</div>
            <div className="text-[8px] sm:text-[9px] text-slate-600 font-semibold tracking-widest uppercase">SPATIAL STUDIO</div>
          </div>
        </div>

        <div className="flex items-center gap-2 spatial-pill px-3.5 py-1.5 sm:px-4 sm:py-2 text-[11px] sm:text-xs font-semibold text-slate-800 border border-white/70 shadow-md">
          <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
          <span>15-MINUTE EPHEMERAL PRIVACY</span>
        </div>
      </div>

      {/* Hero Center Floating Glass Card */}
      <div className="relative z-10 my-auto text-center max-w-2xl lg:max-w-3xl mx-auto w-full py-1 sm:py-2">
        <div className="spatial-glass rounded-3xl sm:rounded-[2.5rem] py-6 px-6 sm:py-8 sm:px-10 md:py-9 md:px-12 border border-white/80 shadow-2xl flex flex-col items-center">
          {/* Top Pill Tag */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full spatial-pill-active text-slate-900 text-[11px] sm:text-xs font-bold mb-3 sm:mb-4 shadow-sm border border-white">
            <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping" />
            <span>AI Virtual Try-On 2.0 Ready</span>
          </div>

          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 mb-2 sm:mb-3 leading-tight">
            Try all the variants virtually, <br className="hidden sm:inline" />
            as much as you like with{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-700 via-indigo-600 to-indigo-800 font-black">
              Virtualfit
            </span>
          </h1>

          <p className="text-xs sm:text-sm md:text-base text-slate-700 max-w-md sm:max-w-lg mx-auto mb-4 sm:mb-6 font-normal leading-relaxed">
            Experience real-time photorealistic clothing simulation and personalized body size regression in full spatial glass comfort.
          </p>

          {/* Touch Screen Button */}
          <div className="group relative w-full max-w-md">
            <button className="w-full py-3.5 sm:py-4 px-6 sm:px-8 rounded-2xl spatial-btn-primary text-white text-base sm:text-lg font-bold tracking-wider flex items-center justify-center gap-3 border border-white/30 shadow-xl transition-all duration-300 group-hover:scale-[1.02] active:scale-98">
              <Touchpad className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-300 animate-bounce" />
              <span>TOUCH SCREEN TO ENTER</span>
            </button>
          </div>
        </div>
      </div>

      {/* Footer Feature Badges */}
      <div className="relative z-10 grid grid-cols-3 gap-2.5 sm:gap-4 max-w-3xl mx-auto w-full text-center shrink-0">
        <div className="spatial-card p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border border-white/70 shadow-md">
          <div className="flex items-center justify-center gap-1.5 sm:gap-2 text-slate-900 font-bold text-xs sm:text-sm mb-0.5">
            <Shirt className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-700" />
            <span>Instant Photo Try-On</span>
          </div>
          <div className="text-[10px] sm:text-xs text-slate-600 leading-tight">Try garments directly from flatlay photos</div>
        </div>

        <div className="spatial-card p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border border-white/70 shadow-md">
          <div className="flex items-center justify-center gap-1.5 sm:gap-2 text-slate-900 font-bold text-xs sm:text-sm mb-0.5">
            <Ruler className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-700" />
            <span>Precision Fit Engine</span>
          </div>
          <div className="text-[10px] sm:text-xs text-slate-600 leading-tight">Instant chest, waist, & hip size recommendation</div>
        </div>

        <div className="spatial-card p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border border-white/70 shadow-md">
          <div className="flex items-center justify-center gap-1.5 sm:gap-2 text-slate-900 font-bold text-xs sm:text-sm mb-0.5">
            <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-700" />
            <span>100% Ephemeral Storage</span>
          </div>
          <div className="text-[10px] sm:text-xs text-slate-600 leading-tight">Zero biometric storage, auto-purged in 15m</div>
        </div>
      </div>
    </div>
  );
};
