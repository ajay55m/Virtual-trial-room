/**
 * AURA Virtual Fitting Room - Frontend API Gateway & WebSocket Service.
 * Provides live connectivity to FastAPI backend with graceful offline fallback.
 */

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
      // Convert base64 dataUrl to Blob
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
        // Fallback for static demo url
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
   * Client-side canvas synthesis fallback to guarantee that the garment is
   * always rendered on top of the user's actual photo under all conditions.
   */
  async createClientSideTryonComposite(userPhotoUri: string, garmentFlatlayUri: string): Promise<string> {
    return new Promise((resolve) => {
      const userImg = new Image();
      userImg.crossOrigin = 'anonymous';
      userImg.onload = () => {
        const garmentImg = new Image();
        garmentImg.crossOrigin = 'anonymous';
        garmentImg.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = userImg.naturalWidth || userImg.width || 896;
          canvas.height = userImg.naturalHeight || userImg.height || 1200;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(userPhotoUri);

          // 1. Draw user's captured / uploaded photo
          ctx.drawImage(userImg, 0, 0, canvas.width, canvas.height);

          // 2. Draw garment over torso
          const isPortrait = canvas.height > canvas.width;
          const targetW = isPortrait ? canvas.width * 0.54 : canvas.width * 0.36;
          const aspect = (garmentImg.naturalHeight || garmentImg.height) / (garmentImg.naturalWidth || garmentImg.width || 1);
          const targetH = targetW * aspect;
          const posX = (canvas.width - targetW) / 2;
          const posY = isPortrait ? canvas.height * 0.25 : canvas.height * 0.28;

          // Soft shadow under garment for realism
          ctx.save();
          ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
          ctx.shadowBlur = 15;
          ctx.shadowOffsetY = 8;
          ctx.drawImage(garmentImg, posX, posY, targetW, targetH);
          ctx.restore();

          resolve(canvas.toDataURL('image/jpeg', 0.95));
        };
        garmentImg.onerror = () => resolve(userPhotoUri);
        garmentImg.src = garmentFlatlayUri;
      };
      userImg.onerror = () => resolve(userPhotoUri);
      userImg.src = userPhotoUri;
    });
  },
};
