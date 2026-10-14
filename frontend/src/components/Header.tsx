import React, { useState, useEffect } from 'react';
import { Clock, Volume2, VolumeX, Settings, Sparkles, RefreshCw } from 'lucide-react';
import type { KioskState } from '../types/kiosk';
import { kioskAudio } from '../utils/audio';

interface HeaderProps {
  currentState: KioskState;
  onOpenAdmin: () => void;
  onReset: () => void;
  inactivitySec: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentState,
  onOpenAdmin,
  onReset,
  inactivitySec
}) => {
  const [currentTime, setCurrentTime] = useState<string>('');
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleSound = () => {
    setMuted(!muted);
    if (muted) kioskAudio.playBeep(800, 0.05);
  };

  if (currentState === 'IDLE') return null;

  return (
    <header className="h-20 px-8 spatial-glass border-b border-white/40 flex items-center justify-between z-40 select-none shadow-sm">
      {/* Brand & Kiosk Status */}
      <div className="flex items-center gap-6">
        <button
          onClick={onReset}
          className="text-left group transition-transform active:scale-95 flex items-center gap-3"
        >
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-slate-900 via-slate-800 to-indigo-950 flex items-center justify-center text-white shadow-md border border-white/30">
            <Sparkles className="w-5 h-5 text-indigo-300" />
          </div>
          <div>
            <div className="text-xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
              <span>VirtualFit</span>
              <span className="text-[10px] font-mono font-bold tracking-widest text-slate-600 spatial-pill px-2.5 py-0.5 border border-white/80">
                STUDIO KIOSK
              </span>
            </div>
            <div className="text-[10px] font-semibold text-slate-500 tracking-wider uppercase">
              Spatial AI Fitting Room
            </div>
          </div>
        </button>

        <div className="h-6 w-[1px] bg-slate-400/30" />

        <div className="flex items-center gap-2 spatial-pill px-3.5 py-1 text-xs font-semibold text-emerald-800 bg-emerald-500/10 border-emerald-500/30 shadow-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="tracking-wide">mTLS ENCRYPTED</span>
        </div>
      </div>

      {/* State Badge & Inactivity Warning */}
      <div className="flex items-center gap-4">
        {inactivitySec <= 15 && (
          <div className="bg-amber-500/20 border border-amber-500/40 text-amber-900 text-xs px-3.5 py-1.5 rounded-full flex items-center gap-2 animate-bounce font-medium backdrop-blur-md">
            <Clock className="w-4 h-4 text-amber-700" />
            <span>Session timeout in {inactivitySec}s</span>
          </div>
        )}

        <div className="px-3.5 py-1.5 rounded-full spatial-pill-active text-xs font-bold tracking-wider uppercase text-slate-800 border border-white shadow-xs">
          {currentState === 'CATALOG' ? 'STUDIO TRY-ON' : currentState}
        </div>
      </div>

      {/* Controls & Time */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSound}
          className="p-2.5 rounded-full spatial-pill text-slate-700 hover:text-slate-900 hover:bg-white/60 transition-all shadow-xs"
          title="Toggle Feedback Sound"
        >
          {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-slate-800" />}
        </button>

        <button
          onClick={onOpenAdmin}
          className="px-3.5 py-2 rounded-full spatial-pill text-slate-700 hover:text-slate-900 hover:bg-white/60 transition-all flex items-center gap-2 text-xs font-semibold shadow-xs"
          title="Telemetry & Diagnostics"
        >
          <Settings className="w-4 h-4 text-slate-700" />
          <span className="hidden md:inline">DIAGNOSTICS</span>
        </button>

        <button
          onClick={onReset}
          className="px-3.5 py-2 rounded-full spatial-pill text-slate-700 hover:text-slate-900 hover:bg-white/60 transition-all flex items-center gap-2 text-xs font-semibold shadow-xs"
          title="Reset Session"
        >
          <RefreshCw className="w-3.5 h-3.5 text-slate-700" />
          <span className="hidden md:inline">NEW SESSION</span>
        </button>

        <div className="flex items-center gap-2 text-xs font-mono font-medium text-slate-700 spatial-pill px-3.5 py-2 shadow-xs border border-white/60">
          <Clock className="w-3.5 h-3.5 text-slate-600" />
          <span>{currentTime}</span>
        </div>
      </div>
    </header>
  );
};
