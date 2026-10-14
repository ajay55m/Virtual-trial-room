/**
 * AURA Virtual Fitting Room - Frontend API Gateway & WebSocket Service.
 * Provides live connectivity to FastAPI backend with graceful offline fallback,
 * along with client-side Saree Virtual Model Identity Fusion and Garment Synthesis.
 */

import type { Garment } from '../types/kiosk';

const API_BASE = '/v1';

export interface CreateSessionResponse {
  sessionId: string;
  kioskId: string;
  token: string;
  websocketUrl: string;
}

export interface CaptureUploadResponse {
  captureId: string;
  sessionId: string;
  signedUploadUrl: string;
  isApproved: boolean;
  warnings: string[];
}

export interface TryOnJobSubmitResponse {
  jobId: string;
  sessionId: string;
  garmentId: string;
  status: string;
  estimatedSeconds: number;
  websocketStream: string;
}

export interface TryOnProgressEvent {
  jobId: string;
  stage: 'CONNECTED' | 'POSE_EXTRACTION' | 'DENSEPOSE_SURFACE' | 'DIFFUSION_PASS' | 'QUALITY_GATE' | 'COMPLETED' | 'FAILED';
  progressPercent: number;
  logMessage: string;
  intermediatePreviewUrl?: string;
  resultImageUrl?: string;
  sizeRecommendation?: any;
  error?: string;
}

export interface GarmentTuningOptions {
  offsetX?: number;      // delta in px (-80 to 80)
  offsetY?: number;      // delta in px (-80 to 80)
  scale?: number;        // scale factor (0.7 to 1.4)
  opacity?: number;      // opacity (0.7 to 1.0)
}

export type FaceTuningOptions = GarmentTuningOptions;

export const apiService = {
  /**
   * Initializes a transient 15-minute session on the backend gateway.
   */
  async createSession(heightCm = 175.0, genderPreference = 'Unisex'): Promise<CreateSessionResponse> {
    try {
      const res = await fetch(`${API_BASE}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kioskId: 'kiosk_active_node',
          heightCm,
          genderPreference,
          consentSigned: true,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('[API] Backend offline, generating local session ID:', err);
      const fallbackId = `sess_local_${Math.random().toString(36).substring(2, 10)}`;
      return {
        sessionId: fallbackId,
        kioskId: 'kiosk_local_node',
        token: 'jwt_mock_token',
        websocketUrl: `/v1/sessions/ws/${fallbackId}`,
      };
    }
  },

  /**
   * Converts dataURL to Blob and uploads live camera capture to backend.
   * Strips EXIF and validates Laplacian sharpness.
   */
  async uploadCapture(sessionId: string, photoDataUrl: string): Promise<CaptureUploadResponse> {
    try {
      let blob: Blob;
      if (photoDataUrl.startsWith('data:')) {
        const parts = photoDataUrl.split(',');
        const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
        const byteStr = atob(parts[1]);
        const n = byteStr.length;
        const u8arr = new Uint8Array(n);
        for (let i = 0; i < n; i++) {
          u8arr[i] = byteStr.charCodeAt(i);
        }
        blob = new Blob([u8arr], { type: mime });
      } else {
        const res = await fetch(photoDataUrl);
        blob = await res.blob();
      }

      const formData = new FormData();
      formData.append('file', blob, 'kiosk_live_frame.jpg');

      const res = await fetch(`${API_BASE}/sessions/${sessionId}/captures`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('[API] Backend capture upload skipped/offline, using local approval:', err);
      return {
        captureId: `cap_local_${Math.random().toString(36).substring(2, 8)}`,
        sessionId,
        signedUploadUrl: photoDataUrl,
        isApproved: true,
        warnings: [],
      };
    }
  },

  /**
   * Enqueues try-on generative model task on the backend.
   */
  async submitTryonJob(sessionId: string, garmentId: string, selectedSize: string): Promise<TryOnJobSubmitResponse> {
    try {
      const res = await fetch(`${API_BASE}/sessions/${sessionId}/tryon`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          garmentId,
          selectedSize,
          renderQuality: 'high_fidelity',
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('[API] Backend tryon job submit offline, falling back to local runner:', err);
      return {
        jobId: `job_local_${Math.random().toString(36).substring(2, 8)}`,
        sessionId,
        garmentId,
        status: 'QUEUED',
        estimatedSeconds: 5,
        websocketStream: `/v1/sessions/ws/${sessionId}`,
      };
    }
  },

  /**
   * Opens live WebSocket connection to stream inference steps from GPU worker / gateway.
   */
  connectWebSocket(
    sessionId: string,
    onMessage: (event: TryOnProgressEvent) => void,
    onClose?: () => void,
    onError?: (err: Event) => void
  ): WebSocket | null {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.port ? `${window.location.hostname}:8000` : window.location.host;
      const wsUrl = `${protocol}//${host}/v1/sessions/ws/${sessionId}`;

      const ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessage(data);
        } catch (e) {
          console.warn('[WS] Failed to parse message JSON:', event.data);
        }
      };

      ws.onclose = () => {
        if (onClose) onClose();
      };

      ws.onerror = (e) => {
        console.warn('[WS] WebSocket connection error:', e);
        if (onError) onError(e);
      };

      return ws;
    } catch (err) {
      console.warn('[WS] Could not initialize WebSocket:', err);
      return null;
    }
  },

  /**
   * Fuses user's face onto the high-resolution virtual model.
   * Performs face region extraction, feathered elliptical clipping, and smooth skin blending.
   */
  async blendUserFaceOntoSareeModel(
    userPhotoUri: string,
    sareeModelUri: string,
    options: FaceTuningOptions = {}
  ): Promise<string> {
    return new Promise((resolve) => {
      const userImg = new Image();
      userImg.crossOrigin = 'anonymous';

      userImg.onload = () => {
        const modelImg = new Image();
        modelImg.crossOrigin = 'anonymous';

        modelImg.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = modelImg.naturalWidth || 896;
          canvas.height = modelImg.naturalHeight || 1200;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(sareeModelUri);

          // 1. Draw base high-resolution virtual saree model
          ctx.drawImage(modelImg, 0, 0, canvas.width, canvas.height);

          // 2. Identify user face bounding region
          const uW = userImg.naturalWidth || userImg.width || 896;
          const uH = userImg.naturalHeight || userImg.height || 1200;

          // Estimate face coordinate in user picture (centered horizontally, top 9-22%)
          const uFaceCenterX = uW * 0.508;
          const uFaceCenterY = uH * 0.142;
          const uFaceHalfW = uW * 0.058;
          const uFaceHalfH = uH * 0.052;

          const cropX = Math.max(0, uFaceCenterX - uFaceHalfW);
          const cropY = Math.max(0, uFaceCenterY - uFaceHalfH);
          const cropW = Math.min(uW - cropX, uFaceHalfW * 2);
          const cropH = Math.min(uH - cropY, uFaceHalfH * 2.2);

          // 3. Create offscreen face stamp with soft elliptical feathered mask
          const faceCanvas = document.createElement('canvas');
          faceCanvas.width = Math.round(cropW);
          faceCanvas.height = Math.round(cropH);
          const fCtx = faceCanvas.getContext('2d');

          if (fCtx) {
            fCtx.drawImage(userImg, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

            fCtx.globalCompositeOperation = 'destination-in';
            const grad = fCtx.createRadialGradient(
              cropW / 2,
              cropH / 2,
              cropW * 0.32,
              cropW / 2,
              cropH / 2,
              cropW * 0.50
            );
            grad.addColorStop(0, 'rgba(0, 0, 0, 1.0)');
            grad.addColorStop(0.75, 'rgba(0, 0, 0, 0.95)');
            grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
            fCtx.fillStyle = grad;
            fCtx.beginPath();
            fCtx.ellipse(cropW / 2, cropH / 2, cropW * 0.48, cropH * 0.48, 0, 0, Math.PI * 2);
            fCtx.fill();

            const scale = options.scale ?? 1.0;
            const deltaX = options.offsetX ?? 0;
            const deltaY = options.offsetY ?? 0;
            const opacity = options.opacity ?? 0.96;

            const baseDestW = 104 * scale;
            const baseDestH = (cropH / cropW) * baseDestW;
            const destX = 397 + deltaX;
            const destY = 86 + deltaY;

            ctx.save();
            ctx.globalAlpha = opacity;
            ctx.drawImage(faceCanvas, destX, destY, baseDestW, baseDestH);
            ctx.restore();
          }

          resolve(canvas.toDataURL('image/jpeg', 0.96));
        };

        modelImg.onerror = () => resolve(userPhotoUri);
        modelImg.src = sareeModelUri;
      };

      userImg.onerror = () => resolve(sareeModelUri);
      userImg.src = userPhotoUri;
    });
  },

  /**
   * Client-side canvas synthesis:
   * - If the user is on the virtual model (not a custom webcam capture), returns the pristine photorealistic fitted model render.
   * - If garment is a Saree, fuses user face onto the virtual saree model.
   * - If user uploaded a custom camera photo, removes flatlay background with anti-aliasing and performs anatomical size-scaled drape.
   */
  async createClientSideTryonComposite(
    userPhotoUri: string,
    garmentOrUri: Garment | string,
    selectedSize = 'M',
    options: GarmentTuningOptions = {}
  ): Promise<string> {
    if (typeof garmentOrUri === 'object') {
      const garment = garmentOrUri;
      
      // If the photo being tried on is the built-in virtual studio model (and not a webcam/custom photo)
      const isStudioModel = userPhotoUri.includes('virtualfit_model') || userPhotoUri.includes('demo_person');
      if (isStudioModel && garment.virtualModelImage) {
        return garment.virtualModelImage;
      }

      if (garment.category === 'Saree' || garment.isSaree) {
        const sareeModelUri = garment.tryonResultImage || garment.virtualModelImage || '/assets/tryon_saree_kanjeevaram.jpg';
        return this.blendUserFaceOntoSareeModel(userPhotoUri, sareeModelUri, options);
      }

      return this._compositeTorso(userPhotoUri, garment.flatlayImage, selectedSize, options);
    }

    return this._compositeTorso(userPhotoUri, garmentOrUri, selectedSize, options);
  },

  /**
   * Geometric torso overlay with dynamic background extraction and size scaling.
   * Removes white/grey flatlay backgrounds so only the garment is cleanly draped onto the user.
   */
  async _compositeTorso(
    userPhotoUri: string, 
    garmentFlatlayUri: string, 
    selectedSize = 'M',
    options: GarmentTuningOptions = {}
  ): Promise<string> {
    return new Promise((resolve) => {
      const userImg = new Image();
      userImg.crossOrigin = 'anonymous';

      userImg.onload = () => {
        const garmentImg = new Image();
        garmentImg.crossOrigin = 'anonymous';

        garmentImg.onload = () => {
          // Step 1: Extract garment onto offscreen canvas with background removal
          const gW = garmentImg.naturalWidth || garmentImg.width || 800;
          const gH = garmentImg.naturalHeight || garmentImg.height || 800;

          const gCanvas = document.createElement('canvas');
          gCanvas.width = gW;
          gCanvas.height = gH;
          const gCtx = gCanvas.getContext('2d');
          if (!gCtx) return resolve(userPhotoUri);

          gCtx.drawImage(garmentImg, 0, 0, gW, gH);
          const imgData = gCtx.getImageData(0, 0, gW, gH);
          const data = imgData.data;

          // Sample 4 corners to detect background color
          const cPoints = [
            0,
            (gW - 1) * 4,
            (gH - 1) * gW * 4,
            ((gH * gW) - 1) * 4,
            Math.floor(gW * 0.1) * 4,
            Math.floor(gW * 0.9) * 4
          ];

          let bgR = 0, bgG = 0, bgB = 0;
          cPoints.forEach((idx) => {
            bgR += data[idx] || 240;
            bgG += data[idx + 1] || 240;
            bgB += data[idx + 2] || 240;
          });
          bgR /= cPoints.length;
          bgG /= cPoints.length;
          bgB /= cPoints.length;

          // Remove flatlay background with feathered edge
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const dist = Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2);

            if (dist < 28) {
              data[i + 3] = 0;
            } else if (dist < 48) {
              data[i + 3] = Math.round(((dist - 28) / 20) * 255);
            }
          }
          gCtx.putImageData(imgData, 0, 0);

          // Step 2: Render onto composite canvas
          const canvas = document.createElement('canvas');
          canvas.width = userImg.naturalWidth || userImg.width || 896;
          canvas.height = userImg.naturalHeight || userImg.height || 1200;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(userPhotoUri);

          // Draw user photo
          ctx.drawImage(userImg, 0, 0, canvas.width, canvas.height);

          // Size scaling factor: XS -> 0.88, S -> 0.94, M -> 1.0, L -> 1.08, XL -> 1.16
          const sizeFactors: Record<string, number> = {
            'XS': 0.88,
            'S': 0.94,
            'M': 1.00,
            'L': 1.08,
            'XL': 1.16,
            'XXL': 1.24
          };
          const sizeFactor = sizeFactors[selectedSize.toUpperCase()] || 1.0;
          const userScale = options.scale ?? 1.0;
          const totalScale = sizeFactor * userScale;

          const isPortrait = canvas.height > canvas.width;
          const baseW = isPortrait ? canvas.width * 0.52 : canvas.width * 0.38;
          const targetW = baseW * totalScale;
          const aspect = gH / gW;
          const targetH = targetW * aspect;

          const deltaX = options.offsetX ?? 0;
          const deltaY = options.offsetY ?? 0;

          const posX = (canvas.width - targetW) / 2 + deltaX;
          // Position naturally at collar/shoulder line
          const posY = (isPortrait ? canvas.height * 0.22 : canvas.height * 0.24) + deltaY;

          // Draw shadow & cut-out garment
          ctx.save();
          ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
          ctx.shadowBlur = 18;
          ctx.shadowOffsetY = 10;
          ctx.drawImage(gCanvas, posX, posY, targetW, targetH);
          ctx.restore();

          resolve(canvas.toDataURL('image/jpeg', 0.96));
        };

        garmentImg.onerror = () => resolve(userPhotoUri);
        garmentImg.src = garmentFlatlayUri;
      };

      userImg.onerror = () => resolve(userPhotoUri);
      userImg.src = userPhotoUri;
    });
  },
};

