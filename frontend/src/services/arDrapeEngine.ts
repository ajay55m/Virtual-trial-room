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
  id?: string;
  sku?: string;
  name?: string;
  category: 'upper' | 'lower' | 'overall';
  type?: 'upper' | 'long_upper' | 'saree' | string;
  aspect_ratio: number;
  fit_factor?: number;
  anchors?: {
    neck_left: [number, number];
    neck_right: [number, number];
    shoulder_left: [number, number];
    shoulder_right: [number, number];
    armpit_left: [number, number];
    armpit_right: [number, number];
    hem_left: [number, number];
    hem_right: [number, number];
  };
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

export interface DrapeTuningOptions {
  offsetX?: number;         // -20 to +20px
  offsetY?: number;         // -20 to +20px
  widthScale?: number;      // 0.90 to 1.10
  lengthScale?: number;     // 0.90 to 1.15
  shoulderExpand?: number;  // 1.30 to 1.70
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
  leftShoulderPt: { x: number; y: number };
  rightShoulderPt: { x: number; y: number };
  leftArmAngle?: number;
  rightArmAngle?: number;
  leftWristPt?: { x: number; y: number };
  rightWristPt?: { x: number; y: number };
  shopperYawDegrees: number;
  timestampMs: number;
}

class ARDrapeEngine {
  private smoothedState: TransformState | null = null;
  // TASK 4: smooth = 0.65*prev + 0.35*curr
  private readonly alpha = 0.35; 
  private readonly maxDiscontinuity = 0.20; 
  private lastLandmarkTimestamp = 0;
  private readonly landmarkLossGracePeriodMs = 100; // 100ms lock if landmark lost

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
   * Incorporates 8-point anchor alignment, anatomical sizing, and 100ms lock grace period.
   */
  computeDrapeTransform(
    landmarks: NormalizedLandmark[],
    meta: GarmentAnchorMetadata,
    img: HTMLImageElement,
    canvasWidth: number,
    canvasHeight: number,
    isMirrored: boolean,
    selectedSize: string = 'M',
    tuning?: DrapeTuningOptions
  ): TransformState | null {
    const now = performance.now();
    const p11 = landmarks[11];
    const p12 = landmarks[12];
    const p23 = landmarks[23];
    const p24 = landmarks[24];

    // TASK 4: Lock garment for 100ms if landmark lost
    if (!p11 || !p12) {
      if (this.smoothedState && (now - this.lastLandmarkTimestamp) < this.landmarkLossGracePeriodMs) {
        return this.smoothedState;
      }
      return null;
    }

    const vis11 = p11.visibility !== undefined ? p11.visibility : 1.0;
    const vis12 = p12.visibility !== undefined ? p12.visibility : 1.0;
    if (vis11 < 0.4 || vis12 < 0.4) {
      if (this.smoothedState && (now - this.lastLandmarkTimestamp) < this.landmarkLossGracePeriodMs) {
        return this.smoothedState;
      }
      return null;
    }

    this.lastLandmarkTimestamp = now;

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

    // 1. Shoulder distance and angle
    const dx = rightPt.x - leftPt.x;
    const dy = rightPt.y - leftPt.y;
    const rawShoulderWidth = Math.max(20, Math.sqrt(dx * dx + dy * dy));
    const rawAngle = Math.atan2(dy, dx);

    // 2. Anatomical Neckline midpoint target (TASK 2)
    // neck_center = midpoint(11,12) moved UP by 0.35 * dist(neck to nose)
    const noseLm = landmarks[0];
    const shoulderCenter = { x: (leftPt.x + rightPt.x) / 2.0, y: (leftPt.y + rightPt.y) / 2.0 };
    let neckOffsetUp = rawShoulderWidth * 0.18;
    if (noseLm && (noseLm.visibility ?? 1) > 0.4) {
      const nosePt = getPixel(noseLm);
      const neckToNoseDist = Math.abs(shoulderCenter.y - nosePt.y);
      neckOffsetUp = Math.max(rawShoulderWidth * 0.10, Math.min(rawShoulderWidth * 0.28, 0.35 * neckToNoseDist));
    }

    const deltaX = tuning?.offsetX ?? 0;
    const deltaY = tuning?.offsetY ?? 0;
    const rawNeckX = shoulderCenter.x + deltaX;
    const rawNeckY = shoulderCenter.y - neckOffsetUp + deltaY;

    // 3. Garment anchor metrics in garment image pixels
    const gWidth = img.width || 1024;
    const gHeight = img.height || 1024;

    // TASK 2: SIZE_FACTOR: S=1.35, M=1.45, L=1.55, XL=1.65
    const sizeFactors: Record<string, number> = {
      'XS': 1.25,
      'S': 1.35,
      'M': 1.45,
      'L': 1.55,
      'XL': 1.65,
      'XXL': 1.75
    };
    const sizeFactor = tuning?.shoulderExpand ?? (sizeFactors[selectedSize.toUpperCase()] || meta.fit_factor || 1.45);
    const widthMult = tuning?.widthScale ?? 1.0;
    const lengthMult = tuning?.lengthScale ?? 1.0;

    const targetWidth = rawShoulderWidth * sizeFactor * widthMult;
    const rawScaleX = targetWidth / gWidth;

    // Vertical scaling: check hips/knees/ankles based on garment category (TASK 2)
    let rawScaleY = rawScaleX * lengthMult;
    if (p23 && p24) {
      const h23 = getPixel(p23);
      const h24 = getPixel(p24);
      const hipMidY = (h23.y + h24.y) / 2.0;
      const torsoLen = Math.max(30, hipMidY - rawNeckY);

      const catLower = (meta.category || meta.type || '').toLowerCase();
      let targetHemY: number;

      if (catLower.includes('kurti')) {
        // Kurti: knee_y (26) - torso_len * 0.05
        const p25 = landmarks[25];
        const p26 = landmarks[26];
        if (p25 && p26) {
          const k25 = getPixel(p25);
          const k26 = getPixel(p26);
          targetHemY = (k25.y + k26.y) / 2.0 - torsoLen * 0.05;
        } else {
          targetHemY = hipMidY + torsoLen * 0.70;
        }
      } else if (catLower.includes('saree') || catLower.includes('dress') || catLower.includes('overall')) {
        // Dress/Saree: ankle_y (28)
        const p27 = landmarks[27];
        const p28 = landmarks[28];
        if (p27 && p28) {
          const a27 = getPixel(p27);
          const a28 = getPixel(p28);
          targetHemY = (a27.y + a28.y) / 2.0;
        } else {
          targetHemY = hipMidY + torsoLen * 1.5;
        }
      } else {
        // Shirt/Tshirt/Top: hip_y + torso_len * 0.15
        targetHemY = hipMidY + torsoLen * 0.15;
      }

      const personGarmentHeight = Math.max(40, targetHemY - rawNeckY);
      const gNeckY = (meta.anchors ? (meta.anchors.neck_left[1] + meta.anchors.neck_right[1]) / 2 : (meta.neckline_center?.[1] ?? 0.14)) * gHeight;
      const gHemY = (meta.anchors ? (meta.anchors.hem_left[1] + meta.anchors.hem_right[1]) / 2 : (meta.hem_center?.[1] ?? 0.88)) * gHeight;
      const gTorsoHeight = Math.max(30, gHemY - gNeckY);

      const torsoScale = (personGarmentHeight * 1.02) / gTorsoHeight;
      rawScaleY = (rawScaleX * 0.55 + torsoScale * 0.45) * lengthMult;
    }

    // Arm tracking landmarks for separate sleeve rigging (TASK 3)
    const p13 = landmarks[13]; // left elbow
    const p14 = landmarks[14]; // right elbow
    const p15 = landmarks[15]; // left wrist
    const p16 = landmarks[16]; // right wrist

    const eLeft = s11.x <= s12.x ? (p13 ? getPixel(p13) : undefined) : (p14 ? getPixel(p14) : undefined);
    const eRight = s11.x <= s12.x ? (p14 ? getPixel(p14) : undefined) : (p13 ? getPixel(p13) : undefined);
    const wLeft = s11.x <= s12.x ? (p15 ? getPixel(p15) : undefined) : (p16 ? getPixel(p16) : undefined);
    const wRight = s11.x <= s12.x ? (p16 ? getPixel(p16) : undefined) : (p15 ? getPixel(p15) : undefined);

    let leftArmAngle = Math.PI * 0.48; // default resting slightly downward
    if (eLeft && Math.hypot(eLeft.x - leftPt.x, eLeft.y - leftPt.y) > 15) {
      leftArmAngle = Math.atan2(eLeft.y - leftPt.y, eLeft.x - leftPt.x);
    }

    let rightArmAngle = Math.PI * 0.52; // default resting slightly downward
    if (eRight && Math.hypot(eRight.x - rightPt.x, eRight.y - rightPt.y) > 15) {
      rightArmAngle = Math.atan2(eRight.y - rightPt.y, eRight.x - rightPt.x);
    }

    let shopperYawDegrees = 0;
    if (p11.z !== undefined && p12.z !== undefined) {
      const dz = p12.z - p11.z;
      const dx3d = p12.x - p11.x;
      shopperYawDegrees = Math.round(Math.atan2(dz, dx3d) * (180 / Math.PI));
    }

    const rawState: TransformState = {
      neckX: rawNeckX,
      neckY: rawNeckY,
      shoulderWidth: rawShoulderWidth,
      angle: rawAngle,
      scaleX: rawScaleX,
      scaleY: rawScaleY,
      leftShoulderPt: { x: leftPt.x, y: leftPt.y },
      rightShoulderPt: { x: rightPt.x, y: rightPt.y },
      leftArmAngle,
      rightArmAngle,
      leftWristPt: wLeft,
      rightWristPt: wRight,
      shopperYawDegrees,
      timestampMs: now
    };

    // 4. Temporal Exponential Moving Average (EMA) Filtering: smooth = 0.65*prev + 0.35*curr (TASK 4)
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
    this.smoothedState.leftShoulderPt.x = a * rawState.leftShoulderPt.x + (1 - a) * this.smoothedState.leftShoulderPt.x;
    this.smoothedState.leftShoulderPt.y = a * rawState.leftShoulderPt.y + (1 - a) * this.smoothedState.leftShoulderPt.y;
    this.smoothedState.rightShoulderPt.x = a * rawState.rightShoulderPt.x + (1 - a) * this.smoothedState.rightShoulderPt.x;
    this.smoothedState.rightShoulderPt.y = a * rawState.rightShoulderPt.y + (1 - a) * this.smoothedState.rightShoulderPt.y;

    if (this.smoothedState.leftArmAngle !== undefined && rawState.leftArmAngle !== undefined) {
      this.smoothedState.leftArmAngle = a * rawState.leftArmAngle + (1 - a) * this.smoothedState.leftArmAngle;
    } else {
      this.smoothedState.leftArmAngle = rawState.leftArmAngle;
    }

    if (this.smoothedState.rightArmAngle !== undefined && rawState.rightArmAngle !== undefined) {
      this.smoothedState.rightArmAngle = a * rawState.rightArmAngle + (1 - a) * this.smoothedState.rightArmAngle;
    } else {
      this.smoothedState.rightArmAngle = rawState.rightArmAngle;
    }

    this.smoothedState.leftWristPt = rawState.leftWristPt;
    this.smoothedState.rightWristPt = rawState.rightWristPt;
    this.smoothedState.shopperYawDegrees = rawState.shopperYawDegrees;
    this.smoothedState.timestampMs = now;

    // Smooth angle handling wrap-around
    let angleDiff = rawState.angle - this.smoothedState.angle;
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
    this.smoothedState.angle += a * angleDiff;

    return this.smoothedState;
  }

  /**
   * Renders the garment with separate sleeve warping, non-rigid chest/waist curvature,
   * soft drop shadow, and occlusion masking directly onto the destination canvas at 60 fps.
   */
  renderDrape(
    ctx: CanvasRenderingContext2D,
    landmarks: NormalizedLandmark[],
    meta: GarmentAnchorMetadata,
    img: HTMLImageElement,
    canvasWidth: number,
    canvasHeight: number,
    isMirrored: boolean,
    trackingLatencyMs: number = 22,
    selectedSize: string = 'M',
    tuning?: DrapeTuningOptions
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
      isMirrored,
      selectedSize,
      tuning
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
    const anchorNormX = meta.anchors ? (meta.anchors.neck_left[0] + meta.anchors.neck_right[0]) / 2 : (meta.neckline_center?.[0] ?? 0.5);
    const anchorNormY = meta.anchors ? (meta.anchors.neck_left[1] + meta.anchors.neck_right[1]) / 2 : (meta.neckline_center?.[1] ?? 0.12);
    const anchorPixelX = anchorNormX * gWidth;
    const anchorPixelY = anchorNormY * gHeight;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // TASK 5: Realism Stack Step 3 - Soft shadow (multiply blurred black mask offset 6px down, opacity 0.25)
    ctx.save();
    ctx.translate(transform.neckX, transform.neckY + 6);
    ctx.rotate(transform.angle);
    ctx.scale(transform.scaleX, transform.scaleY);
    ctx.translate(-anchorPixelX, -anchorPixelY);

    ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 6;
    ctx.drawImage(img, 0, 0, gWidth, gHeight);
    ctx.restore();

    // TASK 3: Warp sleeve separately & Torso draping
    // Sleeve boundary columns from anchors
    const leftArmpitX = (meta.anchors?.armpit_left?.[0] ?? 0.24) * gWidth;
    const rightArmpitX = (meta.anchors?.armpit_right?.[0] ?? 0.76) * gWidth;

    // 1. Torso Center Drape
    ctx.save();
    ctx.translate(transform.neckX, transform.neckY);
    ctx.rotate(transform.angle);
    ctx.scale(transform.scaleX, transform.scaleY);
    ctx.translate(-anchorPixelX, -anchorPixelY);

    // Torso multi-slice curvature
    const numSlices = 16;
    const sliceH = gHeight / numSlices;
    for (let s = 0; s < numSlices; s++) {
      const t = s / (numSlices - 1);
      let sliceScaleX = 1.0;
      if (t > 0.15 && t <= 0.45) {
        sliceScaleX = 1.0 + 0.025 * Math.sin(((t - 0.15) / 0.30) * Math.PI);
      } else if (t > 0.45 && t <= 0.85) {
        sliceScaleX = 1.0 - 0.020 * Math.sin(((t - 0.45) / 0.40) * Math.PI);
      }

      const torsoW = rightArmpitX - leftArmpitX;
      const sliceW = torsoW * sliceScaleX;
      const sliceOffsetX = leftArmpitX + (torsoW - sliceW) / 2;
      const offsetY = s * sliceH;

      ctx.drawImage(
        img,
        leftArmpitX, offsetY, torsoW, sliceH + 0.5,
        sliceOffsetX, offsetY, sliceW, sliceH + 0.5
      );
    }
    ctx.restore();

    // 2. Left Sleeve Rigging (Anchored along 11 -> 13 -> 15)
    ctx.save();
    ctx.translate(transform.leftShoulderPt.x, transform.leftShoulderPt.y);
    const leftSleeveAngle = transform.leftArmAngle !== undefined ? transform.leftArmAngle - Math.PI / 2 : transform.angle;
    ctx.rotate(leftSleeveAngle * 0.75 + transform.angle * 0.25);
    ctx.scale(transform.scaleX, transform.scaleY);
    const leftShoulderRelX = (meta.anchors?.shoulder_left?.[0] ?? 0.20) * gWidth;
    const leftShoulderRelY = (meta.anchors?.shoulder_left?.[1] ?? 0.14) * gHeight;
    ctx.translate(-leftShoulderRelX, -leftShoulderRelY);

    ctx.drawImage(
      img,
      0, 0, leftArmpitX, gHeight * 0.70,
      0, 0, leftArmpitX, gHeight * 0.70
    );
    ctx.restore();

    // 3. Right Sleeve Rigging (Anchored along 12 -> 14 -> 16)
    ctx.save();
    ctx.translate(transform.rightShoulderPt.x, transform.rightShoulderPt.y);
    const rightSleeveAngle = transform.rightArmAngle !== undefined ? transform.rightArmAngle - Math.PI / 2 : transform.angle;
    ctx.rotate(rightSleeveAngle * 0.75 + transform.angle * 0.25);
    ctx.scale(transform.scaleX, transform.scaleY);
    const rightShoulderRelX = (meta.anchors?.shoulder_right?.[0] ?? 0.80) * gWidth;
    const rightShoulderRelY = (meta.anchors?.shoulder_right?.[1] ?? 0.14) * gHeight;
    ctx.translate(-rightShoulderRelX, -rightShoulderRelY);

    ctx.drawImage(
      img,
      rightArmpitX, 0, gWidth - rightArmpitX, gHeight * 0.70,
      rightArmpitX, 0, gWidth - rightArmpitX, gHeight * 0.70
    );
    ctx.restore();

    // Collar & Clavicle 3D Contact Shadow
    ctx.save();
    ctx.translate(transform.neckX, transform.neckY);
    ctx.rotate(transform.angle);

    const collarShadowW = transform.shoulderWidth * 0.42;
    const collarShadowY = anchorPixelY * transform.scaleY * 0.08 + 4;
    const collarGrad = ctx.createLinearGradient(0, collarShadowY, 0, collarShadowY + 10);
    collarGrad.addColorStop(0, 'rgba(15, 20, 30, 0.40)');
    collarGrad.addColorStop(0.6, 'rgba(25, 30, 40, 0.15)');
    collarGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = collarGrad;
    ctx.beginPath();
    ctx.ellipse(0, collarShadowY + 2, collarShadowW / 2, 5, 0, 0, Math.PI);
    ctx.fill();
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
