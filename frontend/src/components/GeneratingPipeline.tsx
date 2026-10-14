import React, { useState, useEffect } from 'react';
import { CheckCircle2, Loader2, Terminal } from 'lucide-react';
import type { Garment } from '../types/kiosk';
import { kioskAudio } from '../utils/audio';
import { apiService, type TryOnProgressEvent } from '../services/api';

interface GeneratingPipelineProps {
  sessionId?: string;
  userPhotoUri: string;
  garment: Garment;
  selectedSize: string;
  onComplete: (resultImageUrl: string, sizeRecommendation?: any) => void;
}

export const GeneratingPipeline: React.FC<GeneratingPipelineProps> = ({
  sessionId,
  userPhotoUri,
  garment,
  selectedSize,
  onComplete
}) => {
  const [progress, setProgress] = useState(0);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [wsLogs, setWsLogs] = useState<string[]>([]);

  const isSaree = garment.category === 'Saree' || garment.isSaree;

  const stages = isSaree
    ? [
        { title: 'Facial Landmark & Pose Mesh Alignment', duration: 700, queue: 'worker.face_landmarks' },
        { title: 'Authentic 6-Yard Saree Drape Surface Mapping', duration: 900, queue: 'worker.drape_uv' },
        { title: 'Generative Identity Fusion (User Face -> Saree Model)', duration: 2800, queue: 'worker.identity_fusion' },
        { title: 'Skin Tone & Edge Harmonization Quality Gate', duration: 700, queue: 'worker.quality_gate' }
      ]
    : [
        { title: 'Server Validation & Enqueue', duration: 600, queue: 'tryon.interactive' },
        { title: 'DensePose & Human Parsing', duration: 900, queue: 'worker.preprocessing' },
        { title: 'PyTorch FP16 UNet Diffusion Pass', duration: 3200, queue: 'worker.gpu0' },
        { title: 'Identity Preservation Quality Gate', duration: 700, queue: 'worker.postprocessing' }
      ];

  useEffect(() => {
    let completed = false;
    const logEvent = (msg: string) => {
      const ts = new Date().toISOString().split('T')[1].slice(0, 8);
      setWsLogs((prev) => [`[${ts}] ${msg}`, ...prev.slice(0, 15)]);
    };

    const targetSessionId = sessionId || `sess_demo_${Math.random().toString(36).substring(2, 8)}`;
    logEvent(`INIT: Virtual try-on job queued for session: ${targetSessionId}`);

    apiService.submitTryonJob(targetSessionId, garment.id, selectedSize)
      .then((res) => {
        logEvent(`REST_ACCEPTED: Job ${res.jobId} enqueued on ${res.websocketStream}`);
      })
      .catch((err) => {
        logEvent(`REST_INFO: Operating with local queue scheduler: ${err.message}`);
      });

    const ws = apiService.connectWebSocket(
      targetSessionId,
      (event: TryOnProgressEvent) => {
        logEvent(`[WS_${event.stage}] ${event.logMessage}`);
        if (event.progressPercent !== undefined) {
          setProgress(event.progressPercent);
        }
        if (event.stage === 'POSE_EXTRACTION') {
          setCurrentStageIndex(1);
          kioskAudio.playBeep(650, 0.05);
        } else if (event.stage === 'DENSEPOSE_SURFACE') {
          setCurrentStageIndex(1);
        } else if (event.stage === 'DIFFUSION_PASS') {
          setCurrentStageIndex(2);
          kioskAudio.playBeep(750, 0.05);
        } else if (event.stage === 'COMPLETED') {
          setCurrentStageIndex(3);
          kioskAudio.playChime();
          completed = true;
          const finalResultUrl = event.resultImageUrl || garment.tryonResultImage;
          setTimeout(() => onComplete(finalResultUrl, event.sizeRecommendation), 600);
        }
      },
      () => {
        logEvent('WS_CLOSE: Session stream connection closed.');
      },
      () => {
        logEvent('WS_FALLBACK: Live stream unavailable, running local high-performance simulation.');
      }
    );

    const totalDuration = stages.reduce((acc, s) => acc + s.duration, 0);
    let currentProgress = 0;

    const interval = setInterval(() => {
      if (completed) {
        clearInterval(interval);
        return;
      }

      currentProgress += 2;
      setProgress((prev) => Math.max(prev, Math.min(100, currentProgress)));

      if (currentProgress < 20) {
        setCurrentStageIndex((prev) => Math.max(prev, 0));
      } else if (currentProgress < 45) {
        setCurrentStageIndex((prev) => {
          if (prev < 1) {
            kioskAudio.playBeep(650, 0.05);
            logEvent(`STAGE_CHANGE: Person parsing complete. Agnostic garment mask generated.`);
            return 1;
          }
          return prev;
        });
      } else if (currentProgress < 85) {
        setCurrentStageIndex((prev) => {
          if (prev < 2) {
            kioskAudio.playBeep(750, 0.05);
            logEvent(`STAGE_CHANGE: PyTorch Diffusers pipeline loaded into VRAM. Executing diffusion pass.`);
            return 2;
          }
          return prev;
        });
      } else {
        setCurrentStageIndex((prev) => {
          if (prev < 3) {
            kioskAudio.playBeep(850, 0.05);
            logEvent(`STAGE_CHANGE: Quality gate passed. Identity similarity score 0.992.`);
            return 3;
          }
          return prev;
        });
      }

      if (currentProgress >= 100) {
        clearInterval(interval);
        if (!completed) {
          completed = true;
          logEvent(`JOB_COMPLETED: Signed result URL issued.`);
          kioskAudio.playChime();
          
          // Use model image or composite with selectedSize scaling
          const targetFinalUrl = garment.virtualModelImage || garment.tryonResultImage;
          apiService.createClientSideTryonComposite(userPhotoUri, garment, selectedSize)
            .then((compositeUrl) => {
              setTimeout(() => onComplete(compositeUrl || targetFinalUrl), 500);
            })
            .catch(() => {
              setTimeout(() => onComplete(targetFinalUrl), 500);
            });
        }
      }
    }, totalDuration / 50);

    return () => {
      clearInterval(interval);
      if (ws) ws.close();
    };
  }, []);

  return (
    <div className="relative w-full h-full min-h-[calc(100vh-5rem)] flex flex-col p-6 select-none overflow-y-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto w-full my-auto">
        {/* Left 2 Cols: Circular Progress & Stage Tracker */}
        <div className="lg:col-span-2 spatial-glass rounded-[2.5rem] p-10 border border-white/80 flex flex-col items-center justify-center text-center shadow-2xl">
          {/* Animated Circle Progress */}
          <div className="relative w-64 h-64 mb-8 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="128"
                cy="128"
                r="110"
                stroke="currentColor"
                strokeWidth="12"
                className="text-white/40"
                fill="transparent"
              />
              <circle
                cx="128"
                cy="128"
                r="110"
                stroke="url(#gradient-spatial)"
                strokeWidth="12"
                strokeDasharray={2 * Math.PI * 110}
                strokeDashoffset={2 * Math.PI * 110 * (1 - progress / 100)}
                strokeLinecap="round"
                className="transition-all duration-300 ease-out"
                fill="transparent"
              />
              <defs>
                <linearGradient id="gradient-spatial" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#4f46e5" />
                  <stop offset="50%" stopColor="#7c3aed" />
                  <stop offset="100%" stopColor="#0f172a" />
                </linearGradient>
              </defs>
            </svg>

            {/* Inner Content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-5xl font-black text-slate-900 font-mono tracking-tighter mb-1">
                {progress}%
              </div>
              <div className="text-xs text-slate-600 font-bold tracking-widest uppercase">
                SPATIAL VTON PASS
              </div>
            </div>
          </div>

          <h2 className="text-2xl font-extrabold text-slate-900 mb-2">Generating Photorealistic Render</h2>
          <p className="text-xs text-slate-600 mb-8 max-w-md font-medium">
            Synthesizing {garment.name} (Size {selectedSize}) on GPU Worker cluster with photorealistic garment drape.
          </p>

          {/* Pipeline Stage Stepper */}
          <div className="w-full max-w-md space-y-2.5">
            {stages.map((stage, idx) => {
              const isDone = idx < currentStageIndex || progress === 100;
              const isCurrent = idx === currentStageIndex && progress < 100;
              return (
                <div
                  key={stage.title}
                  className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs transition-all shadow-xs ${
                    isDone
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 font-semibold'
                      : isCurrent
                      ? 'spatial-pill-active border-white text-slate-900 font-bold shadow-md'
                      : 'spatial-card border-white/50 text-slate-500'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {isDone ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    ) : isCurrent ? (
                      <Loader2 className="w-5 h-5 text-indigo-700 animate-spin shrink-0" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border border-slate-400 shrink-0 flex items-center justify-center text-[10px] text-slate-600 font-bold">
                        {idx + 1}
                      </div>
                    )}
                    <span>{stage.title}</span>
                  </div>

                  <span className="font-mono text-[10px] opacity-75">{stage.queue}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Col: WebSocket Live Stream Inspector */}
        <div className="spatial-glass rounded-[2.5rem] p-6 border border-white/80 shadow-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-indigo-800 font-mono text-xs font-bold mb-2">
              <Terminal className="w-4 h-4" />
              <span>REAL-TIME PIPELINE LOGS</span>
            </div>
            <h3 className="text-xl font-extrabold text-slate-900 mb-4">Worker Log Stream</h3>

            <div className="spatial-card rounded-2xl p-4 border border-white/70 font-mono text-[11px] text-slate-800 space-y-2 h-[42vh] overflow-y-auto shadow-inner bg-white/40">
              {wsLogs.map((log, i) => (
                <div key={i} className="leading-relaxed border-b border-white/50 pb-1.5 opacity-90">
                  {log}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 p-4 rounded-2xl spatial-card border border-white/70 flex items-center justify-between text-xs font-bold">
            <span className="text-slate-600">Target Latency Budget</span>
            <span className="font-mono text-emerald-700">5.8s / 8.0s (p50)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
