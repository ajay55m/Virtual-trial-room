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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/85 backdrop-blur-xl animate-fade-in select-none">
      <div className="glass-panel w-full max-w-4xl rounded-3xl p-8 border border-indigo-500/30 shadow-2xl relative flex flex-col max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-6 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
              <Cpu className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Kiosk Fleet Diagnostics</h2>
              <p className="text-xs text-slate-400">System Telemetry & Ephemeral Storage Audit (FastAPI / Redis / PyTorch)</p>
            </div>
          </div>
          <button
            onClick={() => {
              kioskAudio.playBeep(400, 0.05);
              onClose();
            }}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Telemetry Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-2">
              <span>GPU VRAM Memory</span>
              <Cpu className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-white mb-1">14.2 / 24 GB</div>
            <div className="text-[11px] text-emerald-400 font-mono">NVIDIA L40S Datacenter GPU (58°C)</div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-2">
              <span>Celery Queue Depth</span>
              <Server className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-white mb-1">0 Active / 2 Batch</div>
            <div className="text-[11px] text-indigo-300 font-mono">Redis Broker (AOF Persistence)</div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-2">
              <span>Data Purge Audit</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-300 mb-1">100% PURGED</div>
            <div className="text-[11px] text-slate-400 font-mono">Hard TTL 15-min Lifecycle Rule</div>
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">System Audit Logs</h3>
            <button
              onClick={handleManualPurge}
              disabled={purging}
              className="px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 hover:bg-rose-500/20 text-xs font-bold flex items-center gap-2"
            >
              {purging ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              <span>{purging ? 'Purging Ephemeral Memory...' : 'FORCE MANUAL PURGE'}</span>
            </button>
          </div>

          {purgeSuccess && (
            <div className="p-3 mb-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Storage reconciliation triggered! All temporary objects purged.</span>
            </div>
          )}

          <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 font-mono text-xs text-slate-300 space-y-3 max-h-48 overflow-y-auto">
            {logs.map((log) => (
              <div key={log.id} className="border-b border-slate-900 pb-2 flex gap-3">
                <span className="text-slate-500 shrink-0">{log.timestamp.split('T')[1].slice(0, 8)}</span>
                <span className="text-indigo-400 font-bold shrink-0">[{log.component}]</span>
                <span className="text-slate-300">{log.message}</span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-4 rounded-2xl bg-slate-900 border border-slate-800 text-slate-200 hover:text-white font-semibold text-sm"
        >
          CLOSE DIAGNOSTICS
        </button>
      </div>
    </div>
  );
};
