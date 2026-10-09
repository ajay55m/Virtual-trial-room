import React, { useState, useEffect } from 'react';
import { Clock, Volume2, VolumeX, Settings } from 'lucide-react';
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
    <header className="h-20 px-8 glass-panel border-b border-slate-800 flex items-center justify-between z-40 select-none">
      {/* Brand & Kiosk Status */}
      <div className="flex items-center gap-6">
        <button
          onClick={onReset}
          className="text-left group transition-transform active:scale-95"
        >
          <div className="text-2xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400">
            AURA <span className="text-xs font-light text-slate-400 border border-indigo-500/30 px-2 py-0.5 rounded-full ml-1">KIOSK #04</span>
          </div>
          <div className="text-[10px] text-slate-400 tracking-wider">AI VIRTUAL FITTING ROOM SYSTEM</div>
        </button>

        <div className="h-6 w-[1px] bg-slate-800" />

        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full text-xs font-medium text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>mTLS SECURED</span>
        </div>
      </div>

      {/* State Badge & Inactivity Warning */}
      <div className="flex items-center gap-4">
        {inactivitySec <= 15 && (
          <div className="bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 animate-bounce">
            <Clock className="w-4 h-4" />
            <span>Session timeout in {inactivitySec}s</span>
          </div>
        )}

        <div className="px-3 py-1 rounded-lg bg-slate-900/80 border border-slate-700/50 text-xs font-semibold text-indigo-300 tracking-wider uppercase">
          {currentState}
        </div>
      </div>

      {/* Controls & Time */}
      <div className="flex items-center gap-4">
        <button
          onClick={toggleSound}
          className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-100 hover:border-indigo-500/40 transition-colors"
          title="Toggle Feedback Sound"
        >
          {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5 text-indigo-400" />}
        </button>

        <button
          onClick={onOpenAdmin}
          className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-indigo-400 hover:border-indigo-500/40 transition-colors flex items-center gap-2 text-xs"
          title="Telemetry & Diagnostics"
        >
          <Settings className="w-5 h-5" />
          <span className="hidden md:inline font-medium">DIAGNOSTICS</span>
        </button>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-900/60 px-3 py-2 rounded-xl border border-slate-800">
          <Clock className="w-4 h-4 text-indigo-400" />
          <span>{currentTime}</span>
        </div>
      </div>
    </header>
  );
};
