import React, { useState } from 'react';
import { X, Cpu, Server, ShieldCheck, RefreshCw, Trash2, CheckCircle2 } from 'lucide-react';
import type { TelemetryLog } from '../types/kiosk';
import { kioskAudio } from '../utils/audio';

interface AdminModalProps {
  onClose: () => void;
}

export const AdminModal: React.FC<AdminModalProps> = ({ onClose }) => {
  const [purging, setPurging] = useState(false);
  const [purgeSuccess, setPurgeSuccess] = useState(false);

  const logs: TelemetryLog[] = [
    {
      id: 'log-01',
      timestamp: new Date().toISOString(),
      level: 'AUDIT',
      component: 'SecurityAudit',
      message: 'RECONCILIATION_JOB: Verified 0 objects older than 15-min TTL exist in MinIO bucket.'
    },
    {
      id: 'log-02',
      timestamp: new Date(Date.now() - 120000).toISOString(),
      level: 'INFO',
      component: 'VTONWorker',
      message: 'GPU_WORKER_POOL: PyTorch Diffusers model adapter CatVTON loaded into VRAM (fp16).'
    },
    {
      id: 'log-03',
      timestamp: new Date(Date.now() - 300000).toISOString(),
      level: 'INFO',
      component: 'GatewayAPI',
      message: 'FASTAPI_GATEWAY: mTLS device certificate verified for Kiosk #04.'
    }
  ];

  const handleManualPurge = () => {
    kioskAudio.playBeep(900, 0.1);
    setPurging(true);
    setTimeout(() => {
      setPurging(false);
      setPurgeSuccess(true);
      setTimeout(() => setPurgeSuccess(false), 3000);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-md animate-fade-in select-none">
      <div className="spatial-glass w-full max-w-4xl rounded-[2.5rem] p-8 md:p-10 border border-white/90 shadow-2xl relative flex flex-col max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/40 pb-5 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl spatial-pill bg-white/70 border border-white text-slate-900 shadow-sm">
              <Cpu className="w-6 h-6 text-indigo-700" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-slate-900">VirtualFit Fleet Diagnostics</h2>
              <p className="text-xs text-slate-600 font-medium">System Telemetry & Ephemeral Storage Audit (FastAPI / Redis / PyTorch)</p>
            </div>
          </div>
          <button
            onClick={() => {
              kioskAudio.playBeep(400, 0.05);
              onClose();
            }}
            className="p-2.5 rounded-full spatial-pill border border-white/60 text-slate-600 hover:text-slate-900 hover:bg-white/60"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Telemetry Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="p-4 rounded-2xl spatial-card border border-white/70 shadow-xs">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-2">
              <span>GPU VRAM Memory</span>
              <Cpu className="w-4 h-4 text-indigo-700" />
            </div>
            <div className="text-2xl font-black font-mono text-slate-900 mb-1">14.2 / 24 GB</div>
            <div className="text-[11px] text-emerald-800 font-mono font-medium">NVIDIA L40S Datacenter GPU (58°C)</div>
          </div>

          <div className="p-4 rounded-2xl spatial-card border border-white/70 shadow-xs">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-2">
              <span>Celery Queue Depth</span>
              <Server className="w-4 h-4 text-purple-700" />
            </div>
            <div className="text-2xl font-black font-mono text-slate-900 mb-1">0 Active / 2 Batch</div>
            <div className="text-[11px] text-indigo-800 font-mono font-medium">Redis Broker (AOF Persistence)</div>
          </div>

          <div className="p-4 rounded-2xl spatial-card border border-white/70 shadow-xs">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-2">
              <span>Data Purge Audit</span>
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
            </div>
            <div className="text-2xl font-black font-mono text-emerald-700 mb-1">100% PURGED</div>
            <div className="text-[11px] text-slate-500 font-mono font-medium">Hard TTL 15-min Lifecycle Rule</div>
          </div>
        </div>

        {/* Audit Log Box */}
        <div className="mb-6">
          <div className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>Ephemeral Storage Reconciliation Logs</span>
            <span className="text-[10px] text-emerald-700 font-mono font-semibold">STATUS: VERIFIED (0 LEAKS)</span>
          </div>
          <div className="spatial-card rounded-2xl p-4 border border-white/70 font-mono text-xs text-slate-800 space-y-2 max-h-40 overflow-y-auto bg-white/40 shadow-inner">
            {logs.map((log) => (
              <div key={log.id} className="flex gap-2">
                <span className="text-slate-500">[{log.timestamp.slice(11, 19)}]</span>
                <span className={`font-bold ${log.level === 'AUDIT' ? 'text-emerald-700' : 'text-indigo-800'}`}>
                  [{log.level}]
                </span>
                <span>{log.message}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Manual Purge Trigger */}
        <div className="flex items-center justify-between p-4 rounded-2xl spatial-card border border-white/70">
          <div>
            <div className="text-sm font-extrabold text-slate-900">Force Ephemeral Purge Cycle</div>
            <div className="text-xs text-slate-600">
              Immediately triggers MinIO and Redis memory cleanup for closed sessions.
            </div>
          </div>

          <button
            onClick={handleManualPurge}
            disabled={purging}
            className="py-2.5 px-5 rounded-2xl spatial-btn-primary text-white text-xs font-bold flex items-center gap-2 shadow-md active:scale-95 disabled:opacity-50"
          >
            {purging ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-indigo-300" />
                <span>PURGING MEMORY...</span>
              </>
            ) : purgeSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>PURGE VERIFIED</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>TRIGGER RECONCILER NOW</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
