import React, { useState, useEffect, useRef } from 'react';
import { Camera, CheckCircle2, Sparkles, Video, UserCheck } from 'lucide-react';
import type { PoseQualityMetrics } from '../types/kiosk';
import { kioskAudio } from '../utils/audio';

interface PositioningCameraProps {
  onCaptured: (photoUri: string, metrics: PoseQualityMetrics) => void;
  onCancel: () => void;
}

export const PositioningCamera: React.FC<PositioningCameraProps> = ({ onCaptured, onCancel }) => {
  const [useWebcam, setUseWebcam] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [stabilityTime, setStabilityTime] = useState(0); // 0 to 1.0s
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Simulated metrics state
  const metrics: PoseQualityMetrics = {
    sharpnessVariance: 420,
    bodyHeightPercent: 82,
    horizontalCenterOffset: 2,
    shoulderYawDegrees: 3,
    personCount: 1,
    aPoseCompliant: true,
    stabilityTimeSec: 0
  };

  // Toggle live camera vs demo photo mode
  useEffect(() => {
    let stream: MediaStream | null = null;
    if (useWebcam) {
      navigator.mediaDevices
        .getUserMedia({ video: { width: 1280, height: 720, facingMode: 'user' } })
        .then((s) => {
          stream = s;
          if (videoRef.current) {
            videoRef.current.srcObject = s;
          }
        })
        .catch(() => {
          setUseWebcam(false);
        });
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [useWebcam]);

  // Pose stability countdown loop simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setStabilityTime((prev) => {
        if (prev >= 1.0) {
          if (countdown === null) {
            startCountdown();
          }
          return 1.0;
        }
        return Math.min(1.0, prev + 0.25);
      });
    }, 250);

    return () => clearInterval(interval);
  }, [countdown]);

  const startCountdown = () => {
    kioskAudio.playBeep(800, 0.1);
    setCountdown(3);
  };

  useEffect(() => {
    if (countdown === null) return;
    if (countdown > 0) {
      const timer = setTimeout(() => {
        kioskAudio.playBeep(800 + (4 - countdown) * 200, 0.1);
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      // Flash capture!
      kioskAudio.playShutterSound();
      triggerCapture();
    }
  }, [countdown]);

  const triggerCapture = () => {
    const targetImage = useWebcam && videoRef.current
      ? captureVideoFrame()
      : '/assets/demo_person.jpg';
    onCaptured(targetImage, metrics);
  };

  const captureVideoFrame = (): string => {
    if (!videoRef.current || !canvasRef.current) return '/assets/demo_person.jpg';
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.92);
    }
    return '/assets/demo_person.jpg';
  };

  return (
    <div className="relative w-full h-full min-h-[calc(100vh-5rem)] flex flex-col p-6 select-none bg-slate-950">
      <canvas ref={canvasRef} className="hidden" />

      {/* Main Vision Interface Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full flex-1">
        {/* Left 3 cols: Video Feed / Silhouette HUD */}
        <div className="lg:col-span-3 glass-panel rounded-3xl overflow-hidden relative border border-indigo-500/30 flex items-center justify-center bg-slate-900">
          {/* Feed Content */}
          {useWebcam ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transform -scale-x-100"
            />
          ) : (
            <img
              src="/assets/demo_person.jpg"
              alt="Guided Pose Demo"
              className="w-full h-full object-contain max-h-[75vh]"
            />
          )}

          {/* Futuristic Silhouette Overlay & Skeleton HUD */}
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
            {/* Corner Bracket HUD */}
            <div className="absolute top-6 left-6 w-12 h-12 border-t-2 border-l-2 border-indigo-400/80 rounded-tl-xl" />
            <div className="absolute top-6 right-6 w-12 h-12 border-t-2 border-r-2 border-indigo-400/80 rounded-tr-xl" />
            <div className="absolute bottom-6 left-6 w-12 h-12 border-b-2 border-l-2 border-indigo-400/80 rounded-bl-xl" />
            <div className="absolute bottom-6 right-6 w-12 h-12 border-b-2 border-r-2 border-indigo-400/80 rounded-br-xl" />

            {/* Scanning Line Animation */}
            <div className="absolute inset-x-8 h-0.5 bg-gradient-to-r from-transparent via-indigo-400 to-transparent animate-scan" />

            {/* Silhouette Outline Guide */}
            <div className={`w-72 h-[75%] border-2 rounded-full flex flex-col items-center justify-between p-6 transition-all duration-500 ${
              stabilityTime >= 1.0 ? 'border-emerald-400/80 bg-emerald-500/10' : 'border-indigo-400/50 bg-indigo-500/5'
            }`}>
              <div className="w-16 h-16 rounded-full border border-indigo-300/40 mt-4" />
              <div className="w-full border-t border-indigo-300/30 my-auto" />
              <div className="text-[10px] font-mono text-indigo-300 bg-slate-900/80 px-3 py-1 rounded-full border border-indigo-500/30">
                A-POSE SILHOUETTE ALIGNMENT
              </div>
            </div>

            {/* Active Floating Prompt */}
            <div className="absolute bottom-12 bg-slate-900/90 border border-slate-700 px-6 py-3 rounded-2xl backdrop-blur-md flex items-center gap-3 shadow-xl">
              <Sparkles className="w-5 h-5 text-indigo-400 animate-spin" style={{ animationDuration: '4s' }} />
              <span className="text-sm font-semibold text-white tracking-wide">
                {stabilityTime < 1.0 ? 'Hold pose steady inside outline...' : 'Pose locked! Keep still...'}
              </span>
            </div>
          </div>

          {/* Countdown Overlay */}
          {countdown !== null && (
            <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-md flex flex-col items-center justify-center z-30">
              <div className="text-9xl font-black text-transparent bg-clip-text bg-gradient-to-br from-indigo-300 via-purple-300 to-pink-400 animate-ping">
                {countdown > 0 ? countdown : 'FLASH'}
              </div>
              <div className="text-xl font-bold text-white tracking-widest mt-6">CAPTURING STILL</div>
            </div>
          )}

          {/* Mode Switch Button (Webcam vs Demo Studio Photo) */}
          <div className="absolute top-6 left-6 z-20">
            <button
              onClick={() => setUseWebcam(!useWebcam)}
              className="px-4 py-2 rounded-xl bg-slate-900/80 border border-slate-700 text-xs font-semibold text-slate-200 hover:text-white flex items-center gap-2 backdrop-blur-md"
            >
              <Video className="w-4 h-4 text-indigo-400" />
              <span>{useWebcam ? 'Switch to Studio Demo Mode' : 'Switch to Live Webcam'}</span>
            </button>
          </div>
        </div>

        {/* Right Col: MediaPipe Rule Quality Inspector */}
        <div className="glass-panel rounded-3xl p-6 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-indigo-400 font-mono text-xs tracking-wider mb-2">
              <UserCheck className="w-4 h-4" />
              <span>MEDIAPIPE TASKS VISION v0.10</span>
            </div>
            <h3 className="text-xl font-bold text-white mb-6">Pose Quality Rules</h3>

            {/* Validation Checklist */}
            <div className="space-y-3.5 text-xs">
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-300">33 Landmarks Visible (&gt;0.5)</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>

              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-300">Bounding Box Height (82%)</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>

              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-300">Horizontal Centering (2% off)</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>

              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-300">Shoulder &amp; Hip Yaw (&lt;10°)</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>

              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-300">Single Person Check</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>

              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-300">Laplacian Variance Sharpness</span>
                <span className="font-mono text-indigo-400">420 (PASS)</span>
              </div>
            </div>

            {/* Stability Progress Bar */}
            <div className="mt-8">
              <div className="flex justify-between text-xs font-semibold mb-2">
                <span className="text-slate-300">Stability Gate (1.0s)</span>
                <span className="text-indigo-400 font-mono">{Math.round(stabilityTime * 100)}%</span>
              </div>
              <div className="h-3 w-full bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full transition-all duration-200"
                  style={{ width: `${stabilityTime * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 mt-6">
            <button
              onClick={triggerCapture}
              className="w-full py-4 px-6 rounded-2xl glass-button text-white font-bold tracking-wider flex items-center justify-center gap-3 border border-white/20 active:scale-98"
            >
              <Camera className="w-5 h-5" />
              <span>CAPTURE STILL NOW</span>
            </button>

            <button
              onClick={onCancel}
              className="w-full py-3 px-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white text-xs font-medium"
            >
              CANCEL SESSION
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
