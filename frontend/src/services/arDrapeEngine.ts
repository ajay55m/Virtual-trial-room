/**
 * Live AR Drape Engine (Mode A)
 * Real-time affine & landmark-anchored garment draping for in-store virtual try-on kiosks (~30-60 fps).
 *
 * Math & Architecture:
 * 1. Anchors garment neckline midpoint to shopper's shoulder midpoint (Landmarks 11 & 12).
 * 2. Scales garment width to match shopper's shoulder span (multiplied by relaxed fit factor 1.15).
 * 3. Rotates garment to match body tilt angle theta = atan2(dy, dx).
 * 4. Extends hem proportionally to waist / hips (Landmarks 23 & 24) or ankles (27 & 28).
 * 5. Applies Exponential Moving Average (EMA, alpha ~ 0.35) to eliminate high-frequency landmark jitter.
 */

import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

export interface GarmentAnchorMetadata {
  sku?: string;
  name?: string;
  category: 'upper' | 'lower' | 'overall';
  aspect_ratio: number;
  neckline_center: [number, number];
  left_shoulder: [number, number];
  right_shoulder: [number, number];
  hem_center: [number, number];
  left_cuff?: [number, number];
  right_cuff?: [number, number];
  waist_center?: [number, number];
  left_hip?: [number, number];
  right_hip?: [number, number];
  bbox?: [number, number, number, number];
}

export interface DrapeTelemetry {
  fps: number;
  trackingLatencyMs: number;
  isAnchored: boolean;
  shoulderWidthPx: number;
  rotationDegrees: number;
}

export interface TransformState {
  neckX: number;
  neckY: number;
  shoulderWidth: number;
  angle: number;
  scaleX: number;
  scaleY: number;
}

class ARDrapeEngine {
  private smoothedState: TransformState | null = null;
  private readonly alpha = 0.35; // EMA smoothing factor (0.3 - 0.4 gives buttery stability without lag)
  private readonly maxDiscontinuity = 0.20; // 20% canvas distance jump triggers instant reset

  // Image and metadata in-memory cache
  private imageCache = new Map<string, HTMLImageElement>();
  private metadataCache = new Map<string, GarmentAnchorMetadata>();

  // Telemetry rolling window
  private frameCount = 0;
  private currentFps = 30;
  private lastFpsCalcTime = performance.now();


  /**
   * Resets the temporal smoothing filter (e.g. when shopper steps away or camera changes).
   */
  resetFilter(): void {
    this.smoothedState = null;
  }

  /**
   * Preloads garment image and companion JSON into memory for zero frame lag.
   */
  async preloadGarment(imageUri: string): Promise<{ img: HTMLImageElement; meta: GarmentAnchorMetadata }> {
    const jsonUri = imageUri.replace(/\.(png|jpg|jpeg|webp)$/i, '.json');

    // 1. Load Metadata
    let meta = this.metadataCache.get(jsonUri);
    if (!meta) {
      try {
        const res = await fetch(jsonUri);
        if (res.ok) {
          meta = await res.json();
          this.metadataCache.set(jsonUri, meta!);
        }
      } catch (err) {
        console.warn(`[ARDrapeEngine] Could not load JSON metadata for ${jsonUri}:`, err);
      }
    }

    // Fallback metadata if JSON missing
    if (!meta) {
      meta = {
        category: 'upper',
        aspect_ratio: 1.0,
        neckline_center: [0.5, 0.14],
        left_shoulder: [0.32, 0.16],
        right_shoulder: [0.68, 0.16],
        hem_center: [0.5, 0.88],
        left_cuff: [0.10, 0.60],
        right_cuff: [0.90, 0.60]
      };
    }

    // 2. Load Image
    let img = this.imageCache.get(imageUri);
    if (!img) {
      img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => resolve(image);
        image.onerror = (e) => reject(e);
        image.src = imageUri;
      });
      this.imageCache.set(imageUri, img);
    }

    return { img, meta };
  }

  /**
   * Computes the smoothed affine transformation for the current frame.
   */
  computeDrapeTransform(
    landmarks: NormalizedLandmark[],
    meta: GarmentAnchorMetadata,
    img: HTMLImageElement,
    canvasWidth: number,
    canvasHeight: number,
    isMirrored: boolean
  ): TransformState | null {
    // Landmark indices:
    // 11: left shoulder, 12: right shoulder
    // 23: left hip, 24: right hip
    const p11 = landmarks[11];
    const p12 = landmarks[12];
    const p23 = landmarks[23];
    const p24 = landmarks[24];

    if (!p11 || !p12) return null;

    const vis11 = p11.visibility !== undefined ? p11.visibility : 1.0;
    const vis12 = p12.visibility !== undefined ? p12.visibility : 1.0;
    if (vis11 < 0.4 || vis12 < 0.4) return null;

    // Convert normalized coordinates to canvas pixels
    const getPixel = (lm: NormalizedLandmark) => {
      const x = isMirrored ? (1.0 - lm.x) * canvasWidth : lm.x * canvasWidth;
      const y = lm.y * canvasHeight;
      return { x, y };
    };

    const s11 = getPixel(p11);
    const s12 = getPixel(p12);

    // Order points from viewer's left to viewer's right
    const leftPt = s11.x <= s12.x ? s11 : s12;
    const rightPt = s11.x <= s12.x ? s12 : s11;

    // 1. Neckline midpoint target on person
    const rawNeckX = (leftPt.x + rightPt.x) / 2.0;
    const rawNeckY = (leftPt.y + rightPt.y) / 2.0;

    // 2. Shoulder distance and angle
    const dx = rightPt.x - leftPt.x;
    const dy = rightPt.y - leftPt.y;
    const rawShoulderWidth = Math.sqrt(dx * dx + dy * dy);
    const rawAngle = Math.atan2(dy, dx);

    // 3. Garment anchor metrics in garment image pixels
    const gWidth = img.width || 1024;
    const gHeight = img.height || 1024;

    const gLeftShoulderX = meta.left_shoulder[0] * gWidth;
    const gRightShoulderX = meta.right_shoulder[0] * gWidth;
    const gShoulderSpan = Math.abs(gRightShoulderX - gLeftShoulderX);

    // Fit scale factor: 1.15 relaxes the drape slightly over the shoulder contour
    const fitFactor = meta.category === 'overall' ? 1.18 : 1.14;
    const rawScaleX = (rawShoulderWidth / Math.max(10, gShoulderSpan)) * fitFactor;

    // Vertical scaling: check hips if available
    let rawScaleY = rawScaleX;
    if (p23 && p24) {
      const h23 = getPixel(p23);
      const h24 = getPixel(p24);
      const hipMidY = (h23.y + h24.y) / 2.0;
      const personTorsoHeight = Math.max(20, hipMidY - rawNeckY);

      const gNeckY = meta.neckline_center[1] * gHeight;
      const gHemY = meta.hem_center[1] * gHeight;
      const gTorsoHeight = Math.max(20, gHemY - gNeckY);

      const torsoScale = (personTorsoHeight * 1.12) / gTorsoHeight;
      // Blend horizontal and vertical scale to preserve natural fabric stretch
      rawScaleY = rawScaleX * 0.65 + torsoScale * 0.35;
    }

    const rawState: TransformState = {
      neckX: rawNeckX,
      neckY: rawNeckY,
      shoulderWidth: rawShoulderWidth,
      angle: rawAngle,
      scaleX: rawScaleX,
      scaleY: rawScaleY
    };

    // 4. Temporal Exponential Moving Average (EMA) Filtering
    if (!this.smoothedState) {
      this.smoothedState = { ...rawState };
      return this.smoothedState;
    }

    // Check for large discontinuity (person jumped or tracking re-acquired)
    const distJump = Math.hypot(
      rawState.neckX - this.smoothedState.neckX,
      rawState.neckY - this.smoothedState.neckY
    );
    if (distJump > canvasWidth * this.maxDiscontinuity) {
      this.smoothedState = { ...rawState };
      return this.smoothedState;
    }

    // Smooth continuous state
    const a = this.alpha;
    this.smoothedState.neckX = a * rawState.neckX + (1 - a) * this.smoothedState.neckX;
    this.smoothedState.neckY = a * rawState.neckY + (1 - a) * this.smoothedState.neckY;
    this.smoothedState.shoulderWidth = a * rawState.shoulderWidth + (1 - a) * this.smoothedState.shoulderWidth;
    this.smoothedState.scaleX = a * rawState.scaleX + (1 - a) * this.smoothedState.scaleX;
    this.smoothedState.scaleY = a * rawState.scaleY + (1 - a) * this.smoothedState.scaleY;

    // Smooth angle handling wrap-around
    let angleDiff = rawState.angle - this.smoothedState.angle;
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
    this.smoothedState.angle += a * angleDiff;

    return this.smoothedState;
  }

  /**
   * Renders the garment with the affine transformation directly onto the destination canvas.
   */
  renderDrape(
    ctx: CanvasRenderingContext2D,
    landmarks: NormalizedLandmark[],
    meta: GarmentAnchorMetadata,
    img: HTMLImageElement,
    canvasWidth: number,
    canvasHeight: number,
    isMirrored: boolean,
    trackingLatencyMs: number = 22
  ): DrapeTelemetry {
    // Update FPS calculation
    const now = performance.now();
    this.frameCount++;
    if (now - this.lastFpsCalcTime >= 500) {
      this.currentFps = Math.round((this.frameCount * 1000) / (now - this.lastFpsCalcTime));
      this.frameCount = 0;
      this.lastFpsCalcTime = now;
    }

    const transform = this.computeDrapeTransform(

      landmarks,
      meta,
      img,
      canvasWidth,
      canvasHeight,
      isMirrored
    );

    if (!transform) {
      this.resetFilter();
      return {
        fps: this.currentFps,
        trackingLatencyMs,
        isAnchored: false,
        shoulderWidthPx: 0,
        rotationDegrees: 0
      };
    }

    const gWidth = img.width || 1024;
    const gHeight = img.height || 1024;

    // Garment anchor point in pixel coordinates of source image
    const anchorPixelX = meta.neckline_center[0] * gWidth;
    const anchorPixelY = meta.neckline_center[1] * gHeight;

    // Execute Affine Transformation
    ctx.save();
    // 1. Move origin to person's neck anchor point
    ctx.translate(transform.neckX, transform.neckY);
    // 2. Rotate to align with shoulder angle
    ctx.rotate(transform.angle);
    // 3. Scale to shopper dimensions
    ctx.scale(transform.scaleX, transform.scaleY);
    // 4. Offset by garment's neckline anchor
    ctx.translate(-anchorPixelX, -anchorPixelY);

    // 5. Draw transparent garment image with high quality bilinear/bicubic filter
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0);

    ctx.restore();

    return {
      fps: this.currentFps,
      trackingLatencyMs,
      isAnchored: true,
      shoulderWidthPx: Math.round(transform.shoulderWidth),
      rotationDegrees: Math.round((transform.angle * 180) / Math.PI)
    };
  }
}

export const arDrapeEngine = new ARDrapeEngine();
