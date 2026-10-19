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
}

class PoseLandmarkerService {
  private landmarker: PoseLandmarker | null = null;
  private initializingPromise: Promise<PoseLandmarker> | null = null;
  private lastVideoTime = -1;

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

    // 2. Required Landmarks for Category
    // Shoulders: 11 (left), 12 (right)
    const shouldersVis = isVis(11, 0.5) && isVis(12, 0.5);
    // Hips: 23 (left), 24 (right)
    const hipsVis = isVis(23, 0.5) && isVis(24, 0.5);
    // Ankles: 27 (left), 28 (right)
    const anklesVis = isVis(27, 0.5) && isVis(28, 0.5);

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

    // Shoulder angle / yaw proxy
    let shoulderYaw = 0;
    if (shouldersVis) {
      shoulderYaw = Math.round(Math.abs(lm[11].y - lm[12].y) * 100);
    }

    const metrics: PoseQualityMetrics = {
      sharpnessVariance: 480,
      bodyHeightPercent,
      horizontalCenterOffset: centerOffset,
      shoulderYawDegrees: shoulderYaw,
      personCount: 1,
      aPoseCompliant: false,
      stabilityTimeSec: stabilityTime
    };

    const reasons: string[] = [];

    // Check Shoulders
    if (!shouldersVis) {
      reasons.push('SHOULDERS_NOT_VISIBLE');
      return {
        passed: false,
        guidance: 'Step back — show shoulders',
        subGuidance: 'Both shoulders must be clearly visible in frame',
        reasons,
        metrics,
        landmarks: lm,
        allPosesCount: 1
      };
    }

    // Check Hips / Torso
    if (!hipsVis) {
      reasons.push('TORSO_HIPS_NOT_VISIBLE');
      return {
        passed: false,
        guidance: 'Step back',
        subGuidance: 'Torso and waist must be visible to fit tops and outfits',
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

    // 3. Person fills less than 60% of the frame height
    if (bodyHeightPercent < 60) {
      reasons.push('PERSON_TOO_SMALL');
      return {
        passed: false,
        guidance: 'Step closer to camera',
        subGuidance: `Person fills ${bodyHeightPercent}% of frame (minimum 60% required)`,
        reasons,
        metrics,
        landmarks: lm,
        allPosesCount: 1
      };
    }

    // 4. Hand covering the torso check
    // Torso box: Top = shoulders, Bottom = hips, Left/Right = shoulders & hips
    const torsoTopY = Math.min(lm[11].y, lm[12].y);
    const torsoBottomY = Math.max(lm[23].y, lm[24].y);
    const rawMinX = Math.min(lm[11].x, lm[12].x, lm[23].x, lm[24].x);
    const rawMaxX = Math.max(lm[11].x, lm[12].x, lm[23].x, lm[24].x);

    // Inset X by 10% so natural arm drop at sides is not flagged
    const insetX = (rawMaxX - rawMinX) * 0.10;
    const torsoMinX = rawMinX + insetX;
    const torsoMaxX = rawMaxX - insetX;

    const torsoRect = {
      minX: torsoMinX,
      maxX: torsoMaxX,
      minY: torsoTopY,
      maxY: torsoBottomY
    };

    // Hand landmark indices: wrists (15, 16), pinky (17, 18), index (19, 20), thumb (21, 22)
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
        guidance: 'Lower your phone',
        subGuidance: 'Keep your hands and phone away from your chest and torso',
        reasons,
        metrics,
        landmarks: lm,
        allPosesCount: 1,
        torsoRect
      };
    }

    // All checks PASSED!
    metrics.aPoseCompliant = true;
    return {
      passed: true,
      guidance: 'Pose Verified — Ready to Capture',
      subGuidance: 'Torso clear and optimal framing achieved',
      reasons: [],
      metrics,
      landmarks: lm,
      allPosesCount: 1,
      torsoRect
    };
  }
}

export const poseLandmarkerService = new PoseLandmarkerService();
if (typeof window !== 'undefined') {
  (window as any).poseLandmarkerService = poseLandmarkerService;
}
