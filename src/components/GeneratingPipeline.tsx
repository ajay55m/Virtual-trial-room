import React, { useState, useEffect } from 'react';
import { CheckCircle2, Loader2, Terminal } from 'lucide-react';
import type { Garment } from '../types/kiosk';
import { kioskAudio } from '../utils/audio';

interface GeneratingPipelineProps {
  garment: Garment;
  selectedSize: string;
  onComplete: () => void;
}

export const GeneratingPipeline: React.FC<GeneratingPipelineProps> = ({
  garment,
  selectedSize,
  onComplete
}) => {
  const [progress, setProgress] = useState(0);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [wsLogs, setWsLogs] = useState<string[]>([]);

  const stages = [
    { title: 'Server Validation & Enqueue', duration: 600, queue: 'tryon.interactive' },
    { title: 'DensePose & Human Parsing', duration: 900, queue: 'worker.preprocessing' },
    { title: 'PyTorch FP16 UNet Diffusion Pass', duration: 3200, queue: 'worker.gpu0' },
    { title: 'Identity Preservation Quality Gate', duration: 700, queue: 'worker.postprocessing' }
  ];

  useEffect(() => {
    let currentProgress = 0;
    const totalDuration = stages.reduce((acc, s) => acc + s.duration, 0);

    const logEvent = (msg: string) => {
      const ts = new Date().toISOString().split('T')[1].slice(0, 8);
      setWsLogs((prev) => [`[${ts}] ${msg}`, ...prev.slice(0, 10)]);
    };

    logEvent(`WS_CONNECT: Authenticated session socket created for SKU: ${garment.sku}`);
    logEvent(`REDIS_ENQUEUE: Priority job created on queue [tryon.interactive]`);

    const interval = setInterval(() => {
      currentProgress += 2;
      setProgress(Math.min(100, currentProgress));

      if (currentProgress < 20) {
        setCurrentStageIndex(0);
      } else if (currentProgress < 45) {
        if (currentStageIndex < 1) {
          setCurrentStageIndex(1);
          kioskAudio.playBeep(650, 0.05);
          logEvent(`STAGE_CHANGE: Person parsing complete. Agnostic garment mask generated.`);
        }
      } else if (currentProgress < 85) {
        if (currentStageIndex < 2) {
          setCurrentStageIndex(2);
          kioskAudio.playBeep(750, 0.05);
          logEvent(`STAGE_CHANGE: PyTorch Diffusers pipeline loaded into VRAM (CUDA 12.4). Executing 25 diffusion steps.`);
        }
      } else {
        if (currentStageIndex < 3) {
          setCurrentStageIndex(3);
          kioskAudio.playBeep(850, 0.05);
          logEvent(`STAGE_CHANGE: Quality gate passed. Identity similarity score 0.992.`);
        }
      }

      if (currentProgress >= 100) {
        clearInterval(interval);
        logEvent(`JOB_COMPLETED: Signed result URL issued.`);
        kioskAudio.playChime();
        setTimeout(onComplete, 500);
      }
    }, totalDuration / 50);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-full h-full min-h-[calc(100vh-5rem)] flex flex-col p-6 select-none bg-slate-950">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto w-full my-auto">
        {/* Left 2 Cols: Circular Progress & Stage Tracker */}
        <div className="lg:col-span-2 glass-panel rounded-3xl p-10 border border-indigo-500/30 flex flex-col items-center justify-center text-center bg-slate-900/80">
          {/* Animated Neon Circle Progress */}
          <div className="relative w-64 h-64 mb-8 flex items-center justify-center">
            {/* Background Track */}
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="128"
                cy="128"
                r="110"
                stroke="currentColor"
                strokeWidth="12"
                className="text-slate-800"
                fill="transparent"
              />
              <circle
                cx="128"
                cy="128"
                r="110"
                stroke="url(#gradient)"
                strokeWidth="12"
                strokeDasharray={2 * Math.PI * 110}
                strokeDashoffset={2 * Math.PI * 110 * (1 - progress / 100)}
                strokeLinecap="round"
                className="transition-all duration-300 ease-out"
                fill="transparent"
              />
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="50%" stopColor="#a855f7" />
                  <stop offset="100%" stopColor="#ec4899" />
                </linearGradient>
              </defs>
            </svg>

            {/* Inner Content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-5xl font-black text-white font-mono tracking-tighter mb-1">
                {progress}%
              </div>
              <div className="text-xs text-indigo-300 font-mono tracking-widest uppercase">
                VTON DIFFUSION PASS
              </div>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">Generating Photorealistic Render</h2>
          <p className="text-xs text-slate-400 mb-8 max-w-md">
            Synthesizing {garment.name} (Size {selectedSize}) on GPU Worker cluster using PyTorch CatVTON pipeline.
          </p>

          {/* Pipeline Stage Stepper */}
          <div className="w-full max-w-md space-y-3">
            {stages.map((stage, idx) => {
              const isDone = idx < currentStageIndex || progress === 100;
              const isCurrent = idx === currentStageIndex && progress < 100;
              return (
                <div
                  key={stage.title}
                  className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs transition-all ${
                    isDone
                      ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                      : isCurrent
                      ? 'bg-indigo-950/40 border-indigo-500/50 text-white shadow-lg shadow-indigo-500/20'
                      : 'bg-slate-900/40 border-slate-800 text-slate-500'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {isDone ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    ) : isCurrent ? (
                      <Loader2 className="w-5 h-5 text-indigo-400 animate-spin shrink-0" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border border-slate-700 shrink-0 flex items-center justify-center text-[10px] text-slate-500">
                        {idx + 1}
                      </div>
                    )}
                    <span className="font-semibold">{stage.title}</span>
                  </div>

                  <span className="font-mono text-[10px] opacity-75">{stage.queue}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Col: WebSocket Live Stream Inspector */}
        <div className="glass-panel rounded-3xl p-6 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-indigo-400 font-mono text-xs mb-2">
              <Terminal className="w-4 h-4" />
              <span>WEBSOCKET REAL-TIME EVENT STREAM</span>
            </div>
            <h3 className="text-xl font-bold text-white mb-4">Worker Log Inspector</h3>

            <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 font-mono text-[11px] text-indigo-300 space-y-2 h-[42vh] overflow-y-auto">
              {wsLogs.map((log, i) => (
                <div key={i} className="leading-relaxed border-b border-slate-900 pb-1.5 opacity-90">
                  {log}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-400">Target Latency Budget</span>
            <span className="font-mono text-emerald-400 font-bold">5.8s / 8.0s (p50)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
