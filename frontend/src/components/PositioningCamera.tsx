import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  CheckCircle2, 
  Video, 
  UserCheck, 
  RefreshCw, 
  AlertCircle, 
  Settings2, 
  Upload, 
  ArrowRight,
  ShieldAlert,
  XCircle,
  Loader2,
  Sparkles,
  Activity
} from 'lucide-react';
import type { PoseQualityMetrics, Garment } from '../types/kiosk';
import { MOCK_GARMENTS } from '../data/mockGarments';
import { kioskAudio } from '../utils/audio';
import { poseLandmarkerService, type PoseGateEvaluation } from '../services/poseLandmarker';
import { arDrapeEngine, type GarmentAnchorMetadata, type DrapeTelemetry } from '../services/arDrapeEngine';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { isValidUploadFile, processFileToDataUrl } from '../utils/fileUploadHelper';

interface PositioningCameraProps {
  onCaptured: (photoUri: string, metrics: PoseQualityMetrics) => void;
  onCancel: () => void;
  category?: string;
  initialGarment?: Garment;
  onSelectGarment?: (garment: Garment) => void;
}

interface VideoDevice {
  deviceId: string;
  label: string;
}

function drawPoseSkeleton(
  ctx: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[],
  width: number,
  height: number,
  isMirrored: boolean,
  gatePassed: boolean,
  torsoRect?: { minX: number; maxX: number; minY: number; maxY: number }
) {
  ctx.save();
  ctx.clearRect(0, 0, width, height);

  const getCanvasCoord = (lm: NormalizedLandmark) => {
    const x = isMirrored ? (1 - lm.x) * width : lm.x * width;
    const y = lm.y * height;
    return { x, y, vis: lm.visibility !== undefined ? lm.visibility : 1.0 };
  };

  // Draw torso box if provided
  if (torsoRect) {
    const minX = isMirrored ? (1 - torsoRect.maxX) * width : torsoRect.minX * width;
    const maxX = isMirrored ? (1 - torsoRect.minX) * width : torsoRect.maxX * width;
    const minY = torsoRect.minY * height;
    const maxY = torsoRect.maxY * height;
    const boxW = maxX - minX;
    const boxH = maxY - minY;

    ctx.strokeStyle = gatePassed ? 'rgba(16, 185, 129, 0.85)' : 'rgba(239, 68, 68, 0.85)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash(gatePassed ? [] : [6, 6]);
    ctx.strokeRect(minX, minY, boxW, boxH);
    ctx.fillStyle = gatePassed ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.12)';
    ctx.fillRect(minX, minY, boxW, boxH);
    ctx.setLineDash([]);
  }

  // Skeletal Connections
  const connections = [
    [11, 12], // shoulders
    [11, 23], [12, 24], // torso sides
    [23, 24], // hips
    [11, 13], [13, 15], // left arm
    [12, 14], [14, 16], // right arm
    [23, 25], [25, 27], // left leg
    [24, 26], [26, 28], // right leg
  ];

  ctx.lineWidth = 3;
  ctx.lineCap = 'round';

  for (const [i1, i2] of connections) {
    const p1 = landmarks[i1];
    const p2 = landmarks[i2];
    if (!p1 || !p2) continue;
    const c1 = getCanvasCoord(p1);
    const c2 = getCanvasCoord(p2);
    if (c1.vis < 0.3 || c2.vis < 0.3) continue;

    ctx.strokeStyle = gatePassed ? '#10b981' : '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(c1.x, c1.y);
    ctx.lineTo(c2.x, c2.y);
    ctx.stroke();
  }

  // Draw Landmark Keypoints
  for (let i = 0; i < landmarks.length; i++) {
    const pt = landmarks[i];
    if (!pt) continue;
    const c = getCanvasCoord(pt);
    if (c.vis < 0.3) continue;

    const isTorsoKeypoint = i === 11 || i === 12 || i === 23 || i === 24;
    const isHandKeypoint = i >= 15 && i <= 22;
    const isAnkleKeypoint = i === 27 || i === 28;

    let radius = 4;
    let fill = gatePassed ? '#10b981' : '#6366f1';

    if (isTorsoKeypoint) {
      radius = 7;
      fill = c.vis >= 0.5 ? '#10b981' : '#ef4444';
    } else if (isHandKeypoint) {
      radius = 5.5;
      fill = '#f59e0b';
    } else if (isAnkleKeypoint) {
      radius = 6;
      fill = c.vis >= 0.5 ? '#10b981' : '#ef4444';
    }

    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(c.x, c.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  ctx.restore();
}

export const PositioningCamera: React.FC<PositioningCameraProps> = ({ 
  onCaptured, 
  onCancel,
  category = 'Upper',
  initialGarment,
  onSelectGarment
}) => {
  const [activeMode, setActiveMode] = useState<'camera' | 'upload' | 'demo'>('camera');
  const [uploadedPreview, setUploadedPreview] = useState<string | null>(null);
  const [useWebcam, setUseWebcam] = useState(true);
  const [demoModel, setDemoModel] = useState<'female' | 'male'>('male');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [videoDevices, setVideoDevices] = useState<VideoDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [isMirrored, setIsMirrored] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [stabilityTime, setStabilityTime] = useState(0);
  const [streamActive, setStreamActive] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>(category);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isLoadingVision, setIsLoadingVision] = useState(true);
  const [gateResult, setGateResult] = useState<PoseGateEvaluation | null>(null);

  // Phase 3 Mode A: Live AR Drape State
  const [activeGarment, setActiveGarment] = useState<Garment>(initialGarment || MOCK_GARMENTS[1]);
  const [overlayViewMode, setOverlayViewMode] = useState<'drape' | 'skeleton'>('drape');
  const [loadedGarmentImage, setLoadedGarmentImage] = useState<HTMLImageElement | null>(null);
  const [loadedGarmentMeta, setLoadedGarmentMeta] = useState<GarmentAnchorMetadata | null>(null);
  const [drapeTelemetry, setDrapeTelemetry] = useState<DrapeTelemetry>({
    fps: 30,
    trackingLatencyMs: 18,
    isAnchored: false,
    shoulderWidthPx: 0,
    rotationDegrees: 0
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const passedStartTimeRef = useRef<number | null>(null);

  // Preload garment asset and metadata for real-time drape
  useEffect(() => {
    let isCancelled = false;
    arDrapeEngine.preloadGarment(activeGarment.flatlayImage)
      .then(({ img, meta }) => {
        if (!isCancelled) {
          setLoadedGarmentImage(img);
          setLoadedGarmentMeta(meta);
          arDrapeEngine.resetFilter();
        }
      })
      .catch((err) => {
        console.warn('[PositioningCamera] Could not preload garment for AR drape:', err);
      });
    return () => {
      isCancelled = true;
    };
  }, [activeGarment.flatlayImage]);

  const getCameraDevices = async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices
        .filter((d) => d.kind === 'videoinput')
        .map((d, index) => ({
          deviceId: d.deviceId,
          label: d.label || `Camera ${index + 1} (${d.deviceId.slice(0, 5)}...)`
        }));
      setVideoDevices(videoInputs);
      if (videoInputs.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(videoInputs[0].deviceId);
      }
    } catch (err) {
      console.warn('Could not enumerate video devices:', err);
    }
  };

  const startCamera = async (deviceId?: string) => {
    setCameraError(null);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
          facingMode: deviceId ? undefined : 'user'
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(console.error);
          setStreamActive(true);
        };
      }

      await getCameraDevices();
    } catch (err: any) {
      console.warn('Webcam access error:', err);
      setCameraError(
        err.name === 'NotAllowedError'
          ? 'Camera access denied by browser. Please grant permission or use Upload Photo.'
          : 'Unable to start camera stream. Falling back to Demo Mode.'
      );
      setUseWebcam(false);
      setStreamActive(false);
    }
  };

  useEffect(() => {
    if (useWebcam) {
      startCamera(selectedDeviceId || undefined);
    } else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      setStreamActive(false);
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [useWebcam, selectedDeviceId]);

  // Initialize MediaPipe PoseLandmarker and run continuous per-frame gate evaluation loop
  useEffect(() => {
    let animationFrameId: number;
    let isMounted = true;

    setIsLoadingVision(true);
    poseLandmarkerService.init()
      .then(() => {
        if (isMounted) setIsLoadingVision(false);
      })
      .catch((err) => {
        console.warn('[PositioningCamera] MediaPipe init fallback:', err);
        if (isMounted) setIsLoadingVision(false);
      });

    const runVisionLoop = () => {
      if (
        activeMode === 'camera' &&
        useWebcam &&
        streamActive &&
        videoRef.current &&
        videoRef.current.readyState >= 2 &&
        !videoRef.current.paused
      ) {
        const loopStart = performance.now();
        const video = videoRef.current;
        const evaluation = poseLandmarkerService.evaluateVideoFrame(
          video,
          selectedCategory,
          stabilityTime
        );

        if (evaluation) {
          setGateResult(evaluation);

          // Render live AR drape or landmark skeleton on overlay canvas
          if (overlayCanvasRef.current) {
            const canvas = overlayCanvasRef.current;
            if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
              canvas.width = video.videoWidth || 1280;
              canvas.height = video.videoHeight || 720;
            }
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              if (evaluation.landmarks) {
                if (overlayViewMode === 'drape' && loadedGarmentImage && loadedGarmentMeta) {
                  const trackingLatency = Math.round(performance.now() - loopStart);
                  const telemetry = arDrapeEngine.renderDrape(
                    ctx,
                    evaluation.landmarks,
                    loadedGarmentMeta,
                    loadedGarmentImage,
                    canvas.width,
                    canvas.height,
                    isMirrored,
                    trackingLatency
                  );
                  setDrapeTelemetry(telemetry);
                } else {
                  drawPoseSkeleton(
                    ctx,
                    evaluation.landmarks,
                    canvas.width,
                    canvas.height,
                    isMirrored,
                    evaluation.passed,
                    evaluation.torsoRect
                  );
                }
              }
            }
          }

          // Real stability tracking: only increments when all gate criteria pass continuously for 1.0s!
          if (evaluation.passed) {
            if (passedStartTimeRef.current === null) {
              passedStartTimeRef.current = performance.now();
            }
            const elapsedSec = (performance.now() - passedStartTimeRef.current) / 1000.0;
            const progress = Math.min(1.0, elapsedSec / 1.0);
            setStabilityTime(progress);
            if (progress >= 1.0 && countdown === null) {
              startCountdown();
            }
          } else {
            // Cancel countdown and reset stability immediately if user moves away or breaks gate
            passedStartTimeRef.current = null;
            setStabilityTime(0);
            if (countdown !== null) {
              setCountdown(null);
            }
          }
        }
      }

      animationFrameId = requestAnimationFrame(runVisionLoop);
    };

    animationFrameId = requestAnimationFrame(runVisionLoop);

    return () => {
      isMounted = false;
      cancelAnimationFrame(animationFrameId);
    };
  }, [
    activeMode, 
    useWebcam, 
    streamActive, 
    selectedCategory, 
    isMirrored, 
    countdown, 
    stabilityTime, 
    overlayViewMode, 
    loadedGarmentImage, 
    loadedGarmentMeta
  ]);

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
      kioskAudio.playShutterSound();
      triggerCapture();
    }
  }, [countdown]);

  const captureVideoFrame = (): string => {
    if (!videoRef.current || !canvasRef.current) return '/assets/virtualfit_model_tshirt.jpg';
    const canvas = canvasRef.current;
    const video = videoRef.current;

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      if (isMirrored) {
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, width, height);
      return canvas.toDataURL('image/jpeg', 0.95);
    }
    return '/assets/virtualfit_model_tshirt.jpg';
  };

  const processUploadedFile = async (file: File) => {
    if (!isValidUploadFile(file)) {
      alert('Please select a valid photo or document (JPEG, PNG, WEBP, Apple HEIC/HEIF, or PDF).');
      return;
    }

    setIsProcessingFile(true);
    try {
      const dataUrl = await processFileToDataUrl(file);
      if (dataUrl) {
        kioskAudio.playShutterSound();
        setUploadedPreview(dataUrl);
        setActiveMode('upload');
        setUseWebcam(false);
        setCountdown(null);
        setStabilityTime(0);
      }
    } catch (err: any) {
      console.error('File processing error:', err);
      alert(err.message || 'Unable to process the selected photo/document.');
    } finally {
      setIsProcessingFile(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processUploadedFile(file);
    }
    e.target.value = '';
  };

  const openFilePicker = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processUploadedFile(file);
    }
  };

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const file = items[i].getAsFile();
        if (file && isValidUploadFile(file)) {
          processUploadedFile(file);
          break;
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const demoImageUri = demoModel === 'female' ? '/assets/demo_person.jpg' : '/assets/virtualfit_model_tshirt.jpg';

  const defaultCameraMetrics: PoseQualityMetrics = gateResult?.metrics || {
    sharpnessVariance: 480,
    bodyHeightPercent: 84,
    horizontalCenterOffset: 1,
    shoulderYawDegrees: 2,
    personCount: 1,
    aPoseCompliant: true,
    stabilityTimeSec: stabilityTime
  };

  // Check whether capture is allowed by the gate
  const canCapture = activeMode === 'upload' 
    ? uploadedPreview !== null 
    : activeMode === 'demo' 
    ? true 
    : (gateResult?.passed === true && stabilityTime >= 1.0);

  const triggerCapture = () => {
    if (!canCapture) return;

    if (activeMode === 'upload' && uploadedPreview) {
      onCaptured(uploadedPreview, defaultCameraMetrics);
      return;
    }
    const targetImage = (activeMode === 'camera' && useWebcam && streamActive)
      ? captureVideoFrame()
      : demoImageUri;
    onCaptured(targetImage, defaultCameraMetrics);
  };

  const isFullOutfit =
    selectedCategory.toLowerCase().includes('saree') ||
    selectedCategory.toLowerCase().includes('dress') ||
    selectedCategory.toLowerCase().includes('full');

  return (
    <div className="relative w-full h-full min-h-[calc(100vh-5rem)] flex flex-col p-6 select-none overflow-y-auto">
      <canvas ref={canvasRef} className="hidden" />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.heic,.heif,.HEIC,.HEIF,.pdf,.PDF,application/pdf"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Main Vision Interface Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full flex-1">
        {/* Left 3 cols: Live Video Feed / Upload Zone / Silhouette HUD */}
        <div 
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className="lg:col-span-3 spatial-glass rounded-[2.5rem] overflow-hidden relative border border-white/80 flex items-center justify-center min-h-[60vh] shadow-2xl bg-slate-900/10"
        >
          
          {/* MODE 1: UPLOAD PERSON PHOTO */}
          {activeMode === 'upload' && (
            <div className="w-full h-full min-h-[55vh] flex flex-col items-center justify-center p-8 text-center animate-fade-in z-10">
              {uploadedPreview ? (
                <div className="flex flex-col items-center max-w-md w-full">
                  <div className="relative w-72 h-96 rounded-3xl overflow-hidden border-2 border-indigo-500 shadow-2xl mb-4 bg-white/20">
                    <img src={uploadedPreview} alt="User Upload" className="w-full h-full object-contain" />
                    <div className="absolute top-3 right-3 bg-emerald-600 text-white text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1 shadow-md">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>PHOTO READY</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2.5 w-full">
                    <button
                      onClick={() => onCaptured(uploadedPreview, defaultCameraMetrics)}
                      className="w-full py-3.5 px-6 rounded-2xl spatial-btn-primary text-white font-bold flex items-center justify-center gap-2 shadow-xl hover:brightness-110 active:scale-98"
                    >
                      <span>USE THIS PHOTO & TRY ON CLOTHES</span>
                      <ArrowRight className="w-4 h-4 text-indigo-200" />
                    </button>
                    <button
                      onClick={openFilePicker}
                      className="w-full py-2.5 px-4 rounded-xl spatial-pill border border-white/80 text-slate-700 hover:text-slate-900 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-white/70"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
                      <span>Choose Different Photo</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div 
                  onClick={openFilePicker}
                  className={`w-full max-w-lg p-10 border-2 border-dashed rounded-[2.5rem] cursor-pointer transition-all flex flex-col items-center justify-center group ${
                    isDragging
                      ? 'border-indigo-600 bg-indigo-500/20 scale-102 shadow-2xl'
                      : 'border-indigo-400/80 bg-indigo-500/5 hover:bg-indigo-500/10'
                  }`}
                >
                  <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center shadow-lg mb-5 group-hover:scale-105 transition-transform">
                    <Upload className="w-10 h-10" />
                  </div>
                  <h4 className="text-xl font-black text-slate-900 mb-2">Upload Person Photo or Document</h4>
                  <p className="text-xs text-slate-600 max-w-sm mb-4 leading-relaxed">
                    Select, drag-and-drop, or paste (Ctrl+V) any photo of yourself or a person. Clothing will be fitted directly onto this photo!
                  </p>

                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-[11px] font-semibold mb-6 shadow-xs">
                    <span>📱 iPhone Photos (HEIC) & Documents (PDF) Supported</span>
                  </div>

                  {isProcessingFile ? (
                    <div className="flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-indigo-600 text-white text-xs font-bold shadow-lg">
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Converting iPhone Photo / Document...</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={openFilePicker}
                      className="px-6 py-3 rounded-2xl spatial-btn-primary text-white text-xs font-bold tracking-wider shadow-lg hover:brightness-110 active:scale-98 transition-all"
                    >
                      BROWSE FILES FROM DEVICE
                    </button>
                  )}

                  {/* Quick Sample Presets */}
                  <div className="mt-8 pt-6 border-t border-slate-300/60 w-full">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-3">Or quick-try with sample photos:</span>
                    <div className="flex items-center justify-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setUploadedPreview('/assets/demo_person_male.jpg');
                        }}
                        className="px-3 py-1.5 rounded-full spatial-pill border border-white/80 text-xs font-semibold text-slate-700 hover:bg-white flex items-center gap-1 shadow-xs"
                      >
                        <span>👤 Male Model</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setUploadedPreview('/assets/demo_person.jpg');
                        }}
                        className="px-3 py-1.5 rounded-full spatial-pill border border-white/80 text-xs font-semibold text-slate-700 hover:bg-white flex items-center gap-1 shadow-xs"
                      >
                        <span>👩 Female Model</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MODE 2: LIVE CAMERA FEED WITH MEDIAPIPE SKELETON */}
          {activeMode === 'camera' && (
            <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
              {useWebcam ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${isMirrored ? 'transform -scale-x-100' : ''}`}
                  />
                  {/* Real-time MediaPipe Landmark Canvas Overlay */}
                  <canvas
                    ref={overlayCanvasRef}
                    className="absolute inset-0 w-full h-full object-cover pointer-events-none z-10"
                  />
                </>
              ) : (
                <img
                  src={demoImageUri}
                  alt="Guided Pose Demo"
                  className="w-full h-full object-contain max-h-[75vh]"
                />
              )}

              {/* Mode A: Top Status Badge & View Mode Toggle */}
              <div className="absolute top-5 left-5 z-20 flex flex-wrap items-center gap-2.5">
                <div className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xs font-black tracking-wider uppercase shadow-xl border border-indigo-400/50 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Mode A: Live AR Drape (30 fps)</span>
                </div>

                <div className="flex items-center gap-1 spatial-glass p-0.5 rounded-full border border-white/80 shadow-md">
                  <button
                    type="button"
                    onClick={() => setOverlayViewMode('drape')}
                    className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all ${
                      overlayViewMode === 'drape'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    👗 AR Drape
                  </button>
                  <button
                    type="button"
                    onClick={() => setOverlayViewMode('skeleton')}
                    className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all ${
                      overlayViewMode === 'skeleton'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    🦴 Skeleton
                  </button>
                </div>
              </div>

              {/* Mode A: Real-Time Latency & FPS Counter */}
              <div className="absolute top-5 right-5 z-20 flex items-center gap-2">
                <div className="px-3.5 py-1.5 rounded-full bg-slate-900/85 backdrop-blur-md text-emerald-400 font-mono text-[11px] font-bold border border-white/20 shadow-lg flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                  <span>Tracking: {drapeTelemetry.trackingLatencyMs} ms | FPS: {drapeTelemetry.fps}</span>
                </div>
              </div>

              {/* Real-Time Live Guidance Banner */}
              <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center pointer-events-none max-w-[90%]">
                {isLoadingVision ? (
                  <div className="spatial-glass px-5 py-2.5 rounded-full border border-white/90 shadow-xl flex items-center gap-2.5">
                    <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
                    <span className="text-xs font-bold text-slate-800">Loading MediaPipe Pose Landmarker...</span>
                  </div>
                ) : gateResult ? (
                  <div className={`px-6 py-3 rounded-full border backdrop-blur-md shadow-2xl flex items-center gap-3 transition-all duration-300 ${
                    gateResult.passed 
                      ? 'bg-emerald-500/90 border-emerald-300 text-white scale-105' 
                      : 'bg-slate-900/85 border-amber-400/80 text-white'
                  }`}>
                    {gateResult.passed ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-200 shrink-0 animate-bounce" />
                    ) : (
                      <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
                    )}
                    <div className="text-left">
                      <div className="text-sm font-extrabold tracking-wide uppercase">
                        {gateResult.guidance}
                      </div>
                      {gateResult.subGuidance && (
                        <div className="text-[11px] opacity-90 font-medium">
                          {gateResult.subGuidance}
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>

              {/* In-View Interactive Garment Carousel: Switch garments in real-time */}
              <div className="absolute bottom-20 left-4 right-4 z-20 flex flex-col items-center pointer-events-auto">
                <div className="spatial-glass px-4 py-2.5 rounded-2xl border border-white/90 shadow-2xl backdrop-blur-xl flex items-center gap-2 max-w-full overflow-x-auto no-scrollbar">
                  <span className="text-[10px] font-mono font-bold text-slate-600 uppercase shrink-0 mr-1 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-indigo-600" />
                    <span>Try on live:</span>
                  </span>
                  {MOCK_GARMENTS.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => {
                        setActiveGarment(g);
                        setSelectedCategory(g.category === 'Full body' ? 'Full body' : 'Upper');
                        if (onSelectGarment) onSelectGarment(g);
                        kioskAudio.playBeep(700, 0.05);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 flex items-center gap-2 border transition-all ${
                        activeGarment.id === g.id
                          ? 'bg-indigo-600 text-white border-indigo-400 shadow-lg scale-105'
                          : 'bg-white/80 text-slate-800 hover:bg-white border-white/80 shadow-xs'
                      }`}
                    >
                      <img
                        src={g.flatlayImage}
                        alt={g.name}
                        className="w-5 h-5 object-contain rounded bg-white/40"
                      />
                      <span className="truncate max-w-[120px]">{g.name}</span>
                      <span className="text-[10px] opacity-75">{g.price}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Bottom Quick Controls & Floating Prompt */}
              <div className="absolute bottom-6 flex flex-wrap items-center justify-center gap-3 px-4 z-20">
                <button
                  type="button"
                  onClick={() => {
                    setActiveMode('upload');
                    setUseWebcam(false);
                    openFilePicker();
                  }}
                  className="spatial-glass pointer-events-auto px-4 py-2 rounded-full border border-white/90 flex items-center gap-2 shadow-xl text-xs font-bold text-indigo-800 bg-white/80 hover:bg-white hover:scale-105 active:scale-95 transition-all"
                >
                  <Upload className="w-4 h-4 text-indigo-600" />
                  <span>Upload From Device Instead</span>
                </button>
              </div>

              {/* Countdown Overlay */}
              {countdown !== null && (
                <div className="absolute inset-0 bg-white/70 backdrop-blur-md flex flex-col items-center justify-center z-30">
                  <div className="text-9xl font-black text-slate-900 animate-ping">
                    {countdown > 0 ? countdown : 'FLASH'}
                  </div>
                  <div className="text-xl font-extrabold text-slate-800 tracking-widest mt-6">CAPTURING FRAME</div>
                </div>
              )}
            </div>
          )}

          {/* MODE 3: DEMO MODELS */}
          {activeMode === 'demo' && (
            <div className="w-full h-full flex items-center justify-center p-6 animate-fade-in">
              <img
                src={demoImageUri}
                alt="Demo Model Pose"
                className="w-full h-full object-contain max-h-[75vh]"
              />
            </div>
          )}

          {/* Top Primary Navigation Bar */}
          <div className="absolute top-6 left-6 z-20 flex flex-wrap items-center gap-2 max-w-[90%]">
            <div className="flex items-center gap-1 spatial-glass p-1 rounded-full border border-white/90 shadow-md">
              <button
                onClick={() => {
                  setActiveMode('camera');
                  setUseWebcam(true);
                }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all ${
                  activeMode === 'camera'
                    ? 'spatial-pill-active border border-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Video className="w-3.5 h-3.5 text-slate-800" />
                <span>Live Camera</span>
              </button>

              <button
                onClick={() => {
                  setActiveMode('upload');
                  setUseWebcam(false);
                }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all ${
                  activeMode === 'upload'
                    ? 'spatial-pill-active border border-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Upload className="w-3.5 h-3.5 text-indigo-600" />
                <span>Upload Photo</span>
              </button>

              <button
                onClick={() => {
                  setActiveMode('demo');
                  setUseWebcam(false);
                }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all ${
                  activeMode === 'demo'
                    ? 'spatial-pill-active border border-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5 text-slate-700" />
                <span>Demo Models</span>
              </button>
            </div>

            {/* Sub-controls for Camera mode */}
            {activeMode === 'camera' && useWebcam && (
              <>
                {videoDevices.length > 1 && (
                  <div className="flex items-center gap-1.5 spatial-pill rounded-full px-3 py-1.5 border border-white/70 shadow-xs">
                    <Settings2 className="w-3.5 h-3.5 text-slate-600" />
                    <select
                      value={selectedDeviceId}
                      onChange={(e) => setSelectedDeviceId(e.target.value)}
                      className="bg-transparent text-xs text-slate-800 outline-none cursor-pointer font-semibold"
                    >
                      {videoDevices.map((d) => (
                        <option key={d.deviceId} value={d.deviceId} className="bg-white text-slate-900">
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <button
                  onClick={() => setIsMirrored(!isMirrored)}
                  className="px-3 py-1.5 rounded-full spatial-pill border border-white/70 text-xs font-semibold text-slate-700 hover:text-slate-900 flex items-center gap-1.5 shadow-xs"
                  title="Toggle Mirror Feed"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-slate-700" />
                  <span>{isMirrored ? 'Mirrored' : 'Unmirrored'}</span>
                </button>
              </>
            )}

            {/* Outfit Gating Mode Toggle */}
            <div className="flex items-center gap-1 spatial-pill p-1 rounded-full border border-white/70 shadow-xs">
              <button
                onClick={() => setSelectedCategory('Upper')}
                className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all ${
                  !isFullOutfit
                    ? 'spatial-pill-active border border-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tops Gate (Torso)
              </button>
              <button
                onClick={() => setSelectedCategory('Full body')}
                className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all ${
                  isFullOutfit
                    ? 'spatial-pill-active border border-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Full Outfit (Ankles)
              </button>
            </div>

            {/* Sub-controls for Demo mode */}
            {activeMode === 'demo' && (
              <div className="flex items-center gap-1 spatial-pill p-1 rounded-full border border-white/70 shadow-xs">
                <button
                  onClick={() => setDemoModel('male')}
                  className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all ${
                    demoModel === 'male'
                      ? 'spatial-pill-active border border-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Male Model
                </button>
                <button
                  onClick={() => setDemoModel('female')}
                  className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all ${
                    demoModel === 'female'
                      ? 'spatial-pill-active border border-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Female Model
                </button>
              </div>
            )}
          </div>

          {/* Camera Error / Warning Notice */}
          {cameraError && (
            <div className="absolute top-20 left-6 z-20 spatial-glass border border-amber-500/40 text-amber-900 text-xs px-4 py-2 rounded-2xl flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
              <span>{cameraError}</span>
            </div>
          )}
        </div>

        {/* Right Col: MediaPipe Real Capture Gate Inspector */}
        <div className="spatial-glass rounded-[2.5rem] p-6 border border-white/80 shadow-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-indigo-700 font-mono text-xs font-bold tracking-wider">
                <UserCheck className="w-4 h-4" />
                <span>MEDIAPIPE POSE GATE</span>
              </div>
              <div className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                canCapture ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
              }`}>
                {canCapture ? 'GATE PASS' : 'GATE LOCKED'}
              </div>
            </div>

            <h3 className="text-xl font-extrabold text-slate-900 mb-4">Pose Validation Rules</h3>

            {/* Live MediaPipe Rules Status */}
            <div className="space-y-2.5 text-xs">
              {/* Rule 1: Single Person */}
              <div className="p-3 rounded-2xl spatial-card border border-white/70 flex items-center justify-between shadow-xs">
                <span className="text-slate-700 font-medium">Single Person in Frame</span>
                {gateResult ? (
                  gateResult.allPosesCount === 1 ? (
                    <span className="flex items-center gap-1 font-bold text-emerald-700">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>1 Person</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 font-bold text-red-600">
                      <XCircle className="w-4 h-4 text-red-500" />
                      <span>{gateResult.allPosesCount} Persons</span>
                    </span>
                  )
                ) : (
                  <span className="text-slate-400">Waiting...</span>
                )}
              </div>

              {/* Rule 2: Shoulders (11, 12) */}
              <div className="p-3 rounded-2xl spatial-card border border-white/70 flex items-center justify-between shadow-xs">
                <span className="text-slate-700 font-medium">Shoulders Visible (11, 12 &gt;0.5)</span>
                {gateResult ? (
                  !gateResult.reasons.includes('SHOULDERS_NOT_VISIBLE') && gateResult.allPosesCount > 0 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <span className="flex items-center gap-1 font-bold text-red-600">
                      <XCircle className="w-4 h-4 text-red-500" />
                      <span>Missing</span>
                    </span>
                  )
                ) : (
                  <span className="text-slate-400">Waiting...</span>
                )}
              </div>

              {/* Rule 3: Hips / Torso (23, 24) */}
              <div className="p-3 rounded-2xl spatial-card border border-white/70 flex items-center justify-between shadow-xs">
                <span className="text-slate-700 font-medium">Torso &amp; Hips Visible (23, 24 &gt;0.5)</span>
                {gateResult ? (
                  !gateResult.reasons.includes('TORSO_HIPS_NOT_VISIBLE') && gateResult.allPosesCount > 0 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <span className="flex items-center gap-1 font-bold text-red-600">
                      <XCircle className="w-4 h-4 text-red-500" />
                      <span>Missing</span>
                    </span>
                  )
                ) : (
                  <span className="text-slate-400">Waiting...</span>
                )}
              </div>

              {/* Rule 4: Ankles (27, 28) for full outfit */}
              {isFullOutfit && (
                <div className="p-3 rounded-2xl spatial-card border border-white/70 flex items-center justify-between shadow-xs">
                  <span className="text-slate-700 font-medium">Ankles Visible (27, 28 &gt;0.5)</span>
                  {gateResult ? (
                    !gateResult.reasons.includes('ANKLES_NOT_VISIBLE') && gateResult.allPosesCount > 0 ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <span className="flex items-center gap-1 font-bold text-red-600">
                        <XCircle className="w-4 h-4 text-red-500" />
                        <span>Missing</span>
                      </span>
                    )
                  ) : (
                    <span className="text-slate-400">Waiting...</span>
                  )}
                </div>
              )}

              {/* Rule 5: Framing Height (>= 60%) */}
              <div className="p-3 rounded-2xl spatial-card border border-white/70 flex items-center justify-between shadow-xs">
                <span className="text-slate-700 font-medium">Person Height (&ge; 60%)</span>
                {gateResult ? (
                  gateResult.metrics.bodyHeightPercent >= 60 ? (
                    <span className="flex items-center gap-1 font-bold text-emerald-700 font-mono">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>{gateResult.metrics.bodyHeightPercent}%</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 font-bold text-amber-700 font-mono">
                      <XCircle className="w-4 h-4 text-amber-500" />
                      <span>{gateResult.metrics.bodyHeightPercent}%</span>
                    </span>
                  )
                ) : (
                  <span className="text-slate-400">Waiting...</span>
                )}
              </div>

              {/* Rule 6: Hands Away from Torso */}
              <div className="p-3 rounded-2xl spatial-card border border-white/70 flex items-center justify-between shadow-xs">
                <span className="text-slate-700 font-medium">Torso Clear (No Hand / Phone)</span>
                {gateResult ? (
                  !gateResult.reasons.includes('HAND_COVERING_TORSO') ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <span className="flex items-center gap-1 font-bold text-red-600">
                      <XCircle className="w-4 h-4 text-red-500" />
                      <span>Covered</span>
                    </span>
                  )
                ) : (
                  <span className="text-slate-400">Waiting...</span>
                )}
              </div>
            </div>

            {/* Stability Progress Bar */}
            <div className="mt-6">
              <div className="flex justify-between text-xs font-bold mb-2">
                <span className="text-slate-700">Hold Pose Steady (1.0s)</span>
                <span className="text-indigo-800 font-mono">{Math.round(stabilityTime * 100)}%</span>
              </div>
              <div className="h-3 w-full bg-white/40 rounded-full overflow-hidden p-0.5 border border-white/70 shadow-inner">
                <div
                  className={`h-full rounded-full transition-all duration-200 ${
                    canCapture 
                      ? 'bg-gradient-to-r from-indigo-600 to-emerald-500' 
                      : 'bg-slate-300'
                  }`}
                  style={{ width: `${stabilityTime * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2.5 mt-6">
            <button
              onClick={triggerCapture}
              disabled={!canCapture}
              className={`w-full py-4 px-6 rounded-2xl font-bold tracking-wider flex items-center justify-center gap-3 shadow-xl transition-all ${
                canCapture
                  ? 'spatial-btn-primary text-white active:scale-98 cursor-pointer'
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-60 border border-slate-300 shadow-none'
              }`}
            >
              {activeMode === 'upload' ? (
                <>
                  <Upload className="w-5 h-5 text-indigo-200" />
                  <span>USE PHOTO FOR TRY-ON</span>
                </>
              ) : activeMode === 'demo' ? (
                <>
                  <UserCheck className="w-5 h-5 text-indigo-200" />
                  <span>USE DEMO MODEL</span>
                </>
              ) : (
                <>
                  <Camera className="w-5 h-5" />
                  <span>
                    {canCapture
                      ? 'CAPTURE STILL NOW'
                      : gateResult?.passed
                      ? `HOLD POSE STEADY (${Math.round(stabilityTime * 100)}%)`
                      : (gateResult?.guidance || 'ALIGN BODY TO CAPTURE')}
                  </span>
                </>
              )}
            </button>

            <button
              onClick={openFilePicker}
              className="w-full py-3 px-4 rounded-2xl spatial-btn-glass text-slate-900 text-xs font-bold flex items-center justify-center gap-2 shadow-xs border border-white hover:bg-white"
            >
              <Upload className="w-4 h-4 text-slate-700" />
              <span>OR UPLOAD PHOTO FROM DEVICE</span>
            </button>

            <button
              onClick={onCancel}
              className="w-full py-2.5 px-4 rounded-2xl spatial-pill border border-white/60 text-slate-600 hover:text-slate-900 text-xs font-semibold"
            >
              CANCEL SESSION
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
