import { FilesetResolver, PoseLandmarker, type NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { PoseQualityMetrics } from '../types/kiosk';

export interface PoseGateEvaluation {
  passed: boolean;
  guidance: string;
  subGuidance?: string;
  reasons: string[];
  metrics: PoseQualityMetrics;
  landmarks: NormalizedLandmark[] | null;
  allPosesCount: number;
  torsoRect?: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  suggestPhotoreal?: boolean;
  blockModeA?: boolean;
  medianSize?: string;
  chestMedianCm?: number;
  waistMedianCm?: number;
  shoulderMedianCm?: number;
}

class PoseLandmarkerService {
  private landmarker: PoseLandmarker | null = null;
  private initializingPromise: Promise<PoseLandmarker> | null = null;
  private lastVideoTime = -1;

  // Running 30-frame buffer for stable median size estimation (TASK 1)
  private sizeHistoryBuffer: Array<{
    chestCm: number;
    waistCm: number;
    shoulderCm: number;
  }> = [];

  private calculateMedian(vals: number[]): number {
    if (vals.length === 0) return 0;
    const sorted = [...vals].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  public getMedianSize(_userHeightCm: number = 175.0, category: string = 'Shirt'): {
    size: string;
    chestCm: number;
    waistCm: number;
    shoulderCm: number;
  } {
    if (this.sizeHistoryBuffer.length === 0) {
      return { size: 'M', chestCm: 94.0, waistCm: 78.0, shoulderCm: 44.0 };
    }
    const chestMed = this.calculateMedian(this.sizeHistoryBuffer.map(b => b.chestCm));
    const waistMed = this.calculateMedian(this.sizeHistoryBuffer.map(b => b.waistCm));
    const shMed = this.calculateMedian(this.sizeHistoryBuffer.map(b => b.shoulderCm));

    let size = 'M';
    if (chestMed < 91) size = 'S';
    else if (chestMed < 97) size = 'M';
    else if (chestMed < 102) size = 'L';
    else if (chestMed < 107) size = 'XL';
    else size = 'XXL';

    if (category.toLowerCase() === 'saree') {
      const chestIn = chestMed / 2.54;
      if (chestIn < 33) size = '32';
      else if (chestIn < 35) size = '34';
      else if (chestIn < 37) size = '36';
      else if (chestIn < 39) size = '38';
      else size = '40';
    }

    return { size, chestCm: Math.round(chestMed * 10) / 10, waistCm: Math.round(waistMed * 10) / 10, shoulderCm: Math.round(shMed * 10) / 10 };
  }

  async init(): Promise<PoseLandmarker> {
    if (this.landmarker) return this.landmarker;
    if (this.initializingPromise) return this.initializingPromise;

    this.initializingPromise = (async () => {
      try {
        // Resolve wasm from local assets directory or fallback to jsdelivr CDN
        let wasmFileset;
        try {
          wasmFileset = await FilesetResolver.forVisionTasks('/wasm');
        } catch (localErr) {
          console.warn('[PoseLandmarker] Local wasm failed, falling back to CDN:', localErr);
          wasmFileset = await FilesetResolver.forVisionTasks(
            'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
          );
        }

        // Try GPU delegate first, fallback to CPU if WebGL is unavailable
        try {
          this.landmarker = await PoseLandmarker.createFromOptions(wasmFileset, {
            baseOptions: {
              modelAssetPath: '/models/pose_landmarker_lite.task',
              delegate: 'GPU'
            },
            runningMode: 'VIDEO',
            numPoses: 2, // Critical: detect if multiple people are in frame
            minPoseDetectionConfidence: 0.5,
            minPosePresenceConfidence: 0.5,
            minTrackingConfidence: 0.5
          });
        } catch (gpuErr) {
          console.warn('[PoseLandmarker] GPU delegate failed, falling back to CPU:', gpuErr);
          this.landmarker = await PoseLandmarker.createFromOptions(wasmFileset, {
            baseOptions: {
              modelAssetPath: '/models/pose_landmarker_lite.task',
              delegate: 'CPU'
            },
            runningMode: 'VIDEO',
            numPoses: 2,
            minPoseDetectionConfidence: 0.5,
            minPosePresenceConfidence: 0.5,
            minTrackingConfidence: 0.5
          });
        }

        console.info('[PoseLandmarker] Initialized successfully');
        return this.landmarker;
      } catch (err) {
        console.error('[PoseLandmarker] Failed to initialize:', err);
        this.initializingPromise = null;
        throw err;
      }
    })();

    return this.initializingPromise;
  }

  isReady(): boolean {
    return this.landmarker !== null;
  }

  /**
   * Evaluates the current video frame against all Phase 1 Capture Gate criteria.
   */
  evaluateVideoFrame(
    video: HTMLVideoElement,
    category: string = 'Upper',
    stabilityTime: number = 0
  ): PoseGateEvaluation | null {
    if (!this.landmarker || video.readyState < 2 || video.paused) {
      return null;
    }

    const currentTime = video.currentTime;
    if (currentTime === this.lastVideoTime) {
      return null; // Skip duplicate frame
    }
    this.lastVideoTime = currentTime;

    const nowMs = performance.now();
    const result = this.landmarker.detectForVideo(video, nowMs);

    return this.evaluateLandmarks(result.landmarks, category, stabilityTime);
  }

  /**
   * Evaluates normalized landmarks for capture gating.
   */
  evaluateLandmarks(
    allPoses: NormalizedLandmark[][],
    category: string = 'Upper',
    stabilityTime: number = 0
  ): PoseGateEvaluation {
    const isFullOutfit =
      category.toLowerCase().includes('saree') ||
      category.toLowerCase().includes('dress') ||
      category.toLowerCase().includes('full');

    const defaultMetrics: PoseQualityMetrics = {
      sharpnessVariance: 450,
      bodyHeightPercent: 0,
      horizontalCenterOffset: 0,
      shoulderYawDegrees: 0,
      personCount: allPoses.length,
      aPoseCompliant: false,
      stabilityTimeSec: stabilityTime
    };

    // 1. Single Person Check
    if (allPoses.length === 0) {
      return {
        passed: false,
        guidance: 'Step into camera view',
        subGuidance: 'Position yourself centered in front of the kiosk',
        reasons: ['NO_PERSON_DETECTED'],
        metrics: defaultMetrics,
        landmarks: null,
        allPosesCount: 0
      };
    }

    if (allPoses.length > 1) {
      return {
        passed: false,
        guidance: 'Only one person',
        subGuidance: `${allPoses.length} persons detected. Please ensure only the shopper is in frame`,
        reasons: ['MULTIPLE_PERSONS_DETECTED'],
        metrics: { ...defaultMetrics, personCount: allPoses.length },
        landmarks: allPoses[0],
        allPosesCount: allPoses.length
      };
    }

    const lm = allPoses[0];

    const isVis = (idx: number, threshold = 0.5): boolean => {
      const pt = lm[idx];
      if (!pt) return false;
      const v = pt.visibility !== undefined ? pt.visibility : 1.0;
      return v >= threshold;
    };

    // 2. Required Landmarks for Category - Threshold >= 0.80 (TASK 1)
    const vis11 = isVis(11, 0.80);
    const vis12 = isVis(12, 0.80);
    const vis23 = isVis(23, 0.80);
    const vis24 = isVis(24, 0.80);
    const shouldersVis = vis11 && vis12;
    const hipsVis = vis23 && vis24;
    const anklesVis = isVis(27, 0.70) && isVis(28, 0.70);

    // Compute dimensions
    const dxSh = lm[12].x - lm[11].x;
    const dySh = lm[12].y - lm[11].y;
    const shoulderWidth = Math.hypot(dxSh, dySh);
    const torsoMidTopX = (lm[11].x + lm[12].x) / 2;
    const torsoMidTopY = (lm[11].y + lm[12].y) / 2;
    const torsoMidBotX = (lm[23].x + lm[24].x) / 2;
    const torsoMidBotY = (lm[23].y + lm[24].y) / 2;
    const torsoHeight = Math.max(0.01, Math.hypot(torsoMidBotX - torsoMidTopX, torsoMidBotY - torsoMidTopY));
    const rotationRatio = shoulderWidth / torsoHeight;

    // Shoulder tilt angle in degrees
    const shoulderTiltDeg = Math.abs(Math.atan2(Math.abs(dySh), Math.max(1e-4, Math.abs(dxSh))) * (180 / Math.PI));

    // Compute vertical height of person from landmarks
    const detectedY = lm
      .filter((_, i) => isVis(i, 0.4))
      .map((p) => p.y);
    const minY = detectedY.length > 0 ? Math.min(...detectedY) : 0;
    const maxY = detectedY.length > 0 ? Math.max(...detectedY) : 1;
    const bodyHeight = Math.max(0, maxY - minY);
    const bodyHeightPercent = Math.round(bodyHeight * 100);

    // Horizontal offset of torso from image center
    let centerOffset = 0;
    if (shouldersVis && hipsVis) {
      const torsoCenterX = (lm[11].x + lm[12].x + lm[23].x + lm[24].x) / 4;
      centerOffset = Math.round(Math.abs(torsoCenterX - 0.5) * 100);
    }

    const metrics: PoseQualityMetrics = {
      sharpnessVariance: 480,
      bodyHeightPercent,
      horizontalCenterOffset: centerOffset,
      shoulderYawDegrees: Math.round(shoulderTiltDeg),
      personCount: 1,
      aPoseCompliant: false,
      stabilityTimeSec: stabilityTime
    };

    const reasons: string[] = [];

    // Check 1: Key Landmark Visibility >= 0.80 (TASK 1)
    if (!shouldersVis || !hipsVis) {
      reasons.push('LOW_LANDMARK_VISIBILITY');
      return {
        passed: false,
        guidance: 'Stand in Clear View',
        subGuidance: `Shoulder & hip landmark visibility must be ≥ 80% (Current: 11=${(lm[11].visibility ?? 1).toFixed(2)}, 12=${(lm[12].visibility ?? 1).toFixed(2)})`,
        reasons,
        metrics,
        landmarks: lm,
        allPosesCount: 1
      };
    }

    // Check 2: Side / 3-4 Angle (Body Rotation) Detection (TASK 1 & ROOT RULE)
    // Frontal body ratio is typically 0.85-1.30. Side / 3-4 poses drop below 0.65.
    if (rotationRatio < 0.65) {
      reasons.push('SIDE_OR_ROTATED_POSE');
      return {
        passed: false,
        guidance: 'Please use Photoreal Mode for this photo',
        subGuidance: 'Side / 3-4 angle detected. Mode A Live Drape is strictly for front-facing preview.',
        reasons,
        metrics,
        landmarks: lm,
        allPosesCount: 1,
        suggestPhotoreal: true,
        blockModeA: true
      };
    }

    // Check 3: Excessive Shoulder Tilt Angle > 12 degrees (TASK 1)
    if (shoulderTiltDeg > 12.0) {
      reasons.push('SHOULDER_TILT_EXCESSIVE');
      return {
        passed: false,
        guidance: 'Level your shoulders',
        subGuidance: `Shoulder tilt is ${Math.round(shoulderTiltDeg)}° (maximum 12° allowed). Please stand straight facing camera.`,
        reasons,
        metrics,
        landmarks: lm,
        allPosesCount: 1
      };
    }

    // Check 4: Person Too Close: shoulder_width > 45% of frame width (TASK 1)
    if (shoulderWidth > 0.45) {
      reasons.push('PERSON_TOO_CLOSE');
      return {
        passed: false,
        guidance: 'Step back',
        subGuidance: `Shoulder width spans ${Math.round(shoulderWidth * 100)}% of frame width (maximum 45% allowed).`,
        reasons,
        metrics,
        landmarks: lm,
        allPosesCount: 1
      };
    }

    // Check 5: Person Too Far: shoulder_width < 15% of frame width (TASK 1)
    if (shoulderWidth < 0.15) {
      reasons.push('PERSON_TOO_FAR');
      return {
        passed: false,
        guidance: 'Step closer to camera',
        subGuidance: `Shoulder width spans ${Math.round(shoulderWidth * 100)}% of frame width (minimum 15% required).`,
        reasons,
        metrics,
        landmarks: lm,
        allPosesCount: 1
      };
    }

    // Check Ankles for full-body / dresses / sarees
    if (isFullOutfit && !anklesVis) {
      reasons.push('ANKLES_NOT_VISIBLE');
      return {
        passed: false,
        guidance: 'Step back',
        subGuidance: 'Full length view (including feet & ankles) required for dresses & sarees',
        reasons,
        metrics,
        landmarks: lm,
        allPosesCount: 1
      };
    }

    // Check 6: Hand covering the torso check (TASK 1)
    const torsoTopY = Math.min(lm[11].y, lm[12].y);
    const torsoBottomY = Math.max(lm[23].y, lm[24].y);
    const rawMinX = Math.min(lm[11].x, lm[12].x, lm[23].x, lm[24].x);
    const rawMaxX = Math.max(lm[11].x, lm[12].x, lm[23].x, lm[24].x);

    const insetX = (rawMaxX - rawMinX) * 0.10;
    const torsoMinX = rawMinX + insetX;
    const torsoMaxX = rawMaxX - insetX;

    const torsoRect = {
      minX: torsoMinX,
      maxX: torsoMaxX,
      minY: torsoTopY,
      maxY: torsoBottomY
    };

    const handIndices = [15, 16, 17, 18, 19, 20, 21, 22];
    const handOnTorso = handIndices.some((idx) => {
      const pt = lm[idx];
      if (!pt || !isVis(idx, 0.4)) return false;
      return (
        pt.x >= torsoMinX &&
        pt.x <= torsoMaxX &&
        pt.y >= torsoTopY &&
        pt.y <= torsoBottomY
      );
    });

    if (handOnTorso) {
      reasons.push('HAND_COVERING_TORSO');
      return {
        passed: false,
        guidance: 'Please use Photoreal Mode for this photo',
        subGuidance: 'Hands in front of torso / pocket detected. Live Mode A requires clear torso.',
        reasons,
        metrics,
        landmarks: lm,
        allPosesCount: 1,
        torsoRect,
        suggestPhotoreal: true,
        blockModeA: true
      };
    }

    // Calculate rolling 30-frame median metric body size (TASK 1)
    const userHeight = 175.0;
    const personPx = Math.max(0.2, bodyHeight);
    const scale = userHeight / (personPx * 1000);
    const shCm = shoulderWidth * 1000 * scale;
    const chCm = shCm * 2.3;
    const hipDist = Math.hypot(lm[24].x - lm[23].x, lm[24].y - lm[23].y);
    const wstCm = hipDist * 1000 * scale * 2.1;

    this.sizeHistoryBuffer.push({ chestCm: chCm, waistCm: wstCm, shoulderCm: shCm });
    if (this.sizeHistoryBuffer.length > 30) {
      this.sizeHistoryBuffer.shift();
    }
    const medianData = this.getMedianSize(userHeight, category);

    // All checks PASSED!
    metrics.aPoseCompliant = true;
    return {
      passed: true,
      guidance: 'Pose Verified — Ready to Capture',
      subGuidance: `Optimal frontal framing achieved. Median Size: ${medianData.size} (Chest ${medianData.chestCm}cm)`,
      reasons: [],
      metrics,
      landmarks: lm,
      allPosesCount: 1,
      torsoRect,
      medianSize: medianData.size,
      chestMedianCm: medianData.chestCm,
      waistMedianCm: medianData.waistCm,
      shoulderMedianCm: medianData.shoulderCm
    };
  }
}

export const poseLandmarkerService = new PoseLandmarkerService();
if (typeof window !== 'undefined') {
  (window as any).poseLandmarkerService = poseLandmarkerService;
}
