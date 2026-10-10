import React from 'react';
import { Sparkles, Touchpad, Shield } from 'lucide-react';
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
      className="relative w-full h-full min-h-screen flex flex-col justify-between p-12 overflow-hidden cursor-pointer select-none bg-gradient-to-br from-slate-950 via-indigo-950/40 to-slate-950"
    >
      {/* Background Animated Glow Spheres */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl animate-pulse-glow" />
      <div className="absolute bottom-1/4 right-1/4 w-[30rem] h-[30rem] bg-purple-600/15 rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: '1.5s' }} />

      {/* Grid Pattern Overlay */}
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.2) 1px, transparent 1px)`,
          backgroundSize: '32px 32px'
        }}
      />

      {/* Top Header */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-xl font-extrabold tracking-widest text-white">AURA</div>
            <div className="text-[10px] text-indigo-300 font-mono tracking-widest uppercase">HAUTE COUTURE VIRTUAL STUDIO</div>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-800 px-4 py-2 rounded-xl backdrop-blur-md">
          <Shield className="w-4 h-4 text-emerald-400" />
          <span className="text-xs text-slate-300 font-medium">EPHEMERAL PRIVACY GUARANTEED</span>
        </div>
      </div>

      {/* Hero Center Content */}
      <div className="relative z-10 my-auto text-center max-w-4xl mx-auto flex flex-col items-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-sm font-medium mb-8">
          <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
          <span>VTON Diffusion Engine 2.0 Ready</span>
        </div>

        <h1 className="text-6xl md:text-7xl font-extrabold tracking-tight text-white mb-6 leading-tight">
          Step Into Your <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400">
            Virtual Fitting Studio
          </span>
        </h1>

        <p className="text-lg text-slate-400 max-w-xl mx-auto mb-12 font-light leading-relaxed">
          Experience instant photorealistic clothing try-on without changing rooms. Guided AI pose alignment & precision measurement sizing.
        </p>

        {/* Touch Button Call To Action */}
        <div className="group relative">
          <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-indigo-500 to-purple-500 blur-lg opacity-70 group-hover:opacity-100 transition duration-500 animate-pulse" />
          <button className="relative px-10 py-6 rounded-2xl glass-button text-white text-2xl font-bold tracking-wider flex items-center gap-4 border border-white/20">
            <Touchpad className="w-8 h-8 text-indigo-200 animate-bounce" />
            <span>TOUCH SCREEN TO BEGIN</span>
          </button>
        </div>
      </div>

      {/* Footer Features */}
      <div className="relative z-10 grid grid-cols-3 gap-6 max-w-4xl mx-auto w-full text-center">
        <div className="glass-card p-4 rounded-2xl border border-slate-800">
          <div className="text-sm font-semibold text-white mb-1">Instant Photo Try-On</div>
          <div className="text-xs text-slate-400">No 3D models required from brands</div>
        </div>

        <div className="glass-card p-4 rounded-2xl border border-slate-800">
          <div className="text-sm font-semibold text-white mb-1">Precision Fit Engine</div>
          <div className="text-xs text-slate-400">Data-backed body measurement match</div>
        </div>

        <div className="glass-card p-4 rounded-2xl border border-slate-800">
          <div className="text-sm font-semibold text-white mb-1">100% Data Protection</div>
          <div className="text-xs text-slate-400">Session photos auto-deleted in 15 mins</div>
        </div>
      </div>
    </div>
  );
};
