/**
 * Test Suite for Phase 1 MediaPipe Pose Landmarker Capture Gate
 * Tests the 4 required gate rules + edge cases:
 * 1. Head-and-shoulders only -> REJECTED (hips missing)
 * 2. Phone / hand over torso -> REJECTED (chest occluded)
 * 3. Two persons in frame -> REJECTED (multiple persons)
 * 4. Properly framed single person -> PASS (ready to capture)
 * 5. Full body / saree missing ankles -> REJECTED
 * 6. Full body / saree with ankles -> PASS
 * 7. Person too small (< 60% height) -> REJECTED
 */

import { poseLandmarkerService } from '../src/services/poseLandmarker';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

function createLandmarks(overrides: Partial<Record<number, Partial<NormalizedLandmark>>> = {}): NormalizedLandmark[] {
  // 33 standard BlazePose landmarks with default high visibility
  const landmarks: NormalizedLandmark[] = [];
  for (let i = 0; i < 33; i++) {
    landmarks.push({
      x: 0.5,
      y: 0.1 + (i / 33) * 0.8,
      z: 0,
      visibility: 0.9,
    });
  }

  // Base well-framed person:
  // Nose: 0
  landmarks[0] = { x: 0.50, y: 0.12, z: 0, visibility: 0.95 };
  // Left shoulder: 11, Right shoulder: 12
  landmarks[11] = { x: 0.38, y: 0.25, z: 0, visibility: 0.92 };
  landmarks[12] = { x: 0.62, y: 0.25, z: 0, visibility: 0.92 };
  // Left elbow: 13, Right elbow: 14
  landmarks[13] = { x: 0.32, y: 0.42, z: 0, visibility: 0.88 };
  landmarks[14] = { x: 0.68, y: 0.42, z: 0, visibility: 0.88 };
  // Left hand: 15 (wrist), 17 (pinky), 19 (index), 21 (thumb) - resting at side
  landmarks[15] = { x: 0.28, y: 0.58, z: 0, visibility: 0.85 };
  landmarks[17] = { x: 0.26, y: 0.62, z: 0, visibility: 0.85 };
  landmarks[19] = { x: 0.27, y: 0.63, z: 0, visibility: 0.85 };
  landmarks[21] = { x: 0.28, y: 0.60, z: 0, visibility: 0.85 };

  // Right hand: 16 (wrist), 18 (pinky), 20 (index), 22 (thumb) - resting at side
  landmarks[16] = { x: 0.72, y: 0.58, z: 0, visibility: 0.85 };
  landmarks[18] = { x: 0.74, y: 0.62, z: 0, visibility: 0.85 };
  landmarks[20] = { x: 0.73, y: 0.63, z: 0, visibility: 0.85 };
  landmarks[22] = { x: 0.72, y: 0.60, z: 0, visibility: 0.85 };

  // Apply custom test overrides
  for (const [idxStr, pt] of Object.entries(overrides)) {
    const idx = Number(idxStr);
    landmarks[idx] = { ...landmarks[idx], ...pt };
  }

  return landmarks;
}

function createSmallPersonLandmarks(): NormalizedLandmark[] {
  const base = createLandmarks();
  // Scale down to 40% height to simulate standing far back
  return base.map((p) => ({
    ...p,
    x: 0.5 + (p.x - 0.5) * 0.45,
    y: 0.30 + (p.y - 0.12) * 0.45, // height = 0.76 * 0.45 = ~34% < 60%
  }));
}

interface TestCase {
  id: string;
  name: string;
  category: string;
  poses: NormalizedLandmark[][];
  expectedPassed: boolean;
  expectedReason?: string;
  expectedGuidanceContains?: string;
}

const testCases: TestCase[] = [
  {
    id: 'CASE-1',
    name: 'Head-and-shoulders selfie (no hips/torso visible)',
    category: 'Upper',
    poses: [
      createLandmarks({
        // Shoulders visible
        11: { x: 0.35, y: 0.65, visibility: 0.9 },
        12: { x: 0.65, y: 0.65, visibility: 0.9 },
        // Hips not in frame (visibility < 0.5)
        23: { x: 0.40, y: 1.10, visibility: 0.1 },
        24: { x: 0.60, y: 1.10, visibility: 0.1 },
        25: { x: 0.40, y: 1.30, visibility: 0.0 },
        26: { x: 0.60, y: 1.30, visibility: 0.0 },
        27: { x: 0.40, y: 1.50, visibility: 0.0 },
        28: { x: 0.60, y: 1.50, visibility: 0.0 },
      })
    ],
    expectedPassed: false,
    expectedReason: 'TORSO_HIPS_NOT_VISIBLE',
    expectedGuidanceContains: 'Step back',
  },
  {
    id: 'CASE-2',
    name: 'Phone / hand held over torso (chest occluded)',
    category: 'Upper',
    poses: [
      createLandmarks({
        // Hand / wrist held directly in front of sternum (x=0.50, y=0.38, inside torso box)
        15: { x: 0.50, y: 0.38, visibility: 0.95 },
        19: { x: 0.49, y: 0.36, visibility: 0.95 },
      })
    ],
    expectedPassed: false,
    expectedReason: 'HAND_COVERING_TORSO',
    expectedGuidanceContains: 'Lower your phone',
  },
  {
    id: 'CASE-3',
    name: 'Two persons detected in camera frame',
    category: 'Upper',
    poses: [
      createLandmarks(), // Person 1
      createLandmarks({ // Person 2 walking behind
        0: { x: 0.85, y: 0.20, visibility: 0.7 },
        11: { x: 0.80, y: 0.30, visibility: 0.6 },
        12: { x: 0.90, y: 0.30, visibility: 0.6 },
      })
    ],
    expectedPassed: false,
    expectedReason: 'MULTIPLE_PERSONS_DETECTED',
    expectedGuidanceContains: 'Only one person',
  },
  {
    id: 'CASE-4',
    name: 'Properly framed single person (Upper / Tops)',
    category: 'Upper',
    poses: [
      createLandmarks()
    ],
    expectedPassed: true,
    expectedGuidanceContains: 'Pose Verified — Ready to Capture',
  },
  {
    id: 'CASE-5',
    name: 'Saree / Full Outfit: Ankles missing (cut off at knees)',
    category: 'Saree / Full Outfit',
    poses: [
      createLandmarks({
        27: { x: 0.42, y: 1.05, visibility: 0.2 },
        28: { x: 0.58, y: 1.05, visibility: 0.2 },
      })
    ],
    expectedPassed: false,
    expectedReason: 'ANKLES_NOT_VISIBLE',
    expectedGuidanceContains: 'Step back',
  },
  {
    id: 'CASE-6',
    name: 'Saree / Full Outfit: Full length visible with ankles',
    category: 'Saree / Full Outfit',
    poses: [
      createLandmarks()
    ],
    expectedPassed: true,
    expectedGuidanceContains: 'Pose Verified — Ready to Capture',
  },
  {
    id: 'CASE-7',
    name: 'Person too small (standing too far, < 60% frame height)',
    category: 'Upper',
    poses: [
      createSmallPersonLandmarks()
    ],
    expectedPassed: false,
    expectedReason: 'PERSON_TOO_SMALL',
    expectedGuidanceContains: 'Step closer to camera',
  },
];

console.log('===============================================================');
console.log('   MEDIAPIPE POSE LANDMARKER CAPTURE GATE VERIFICATION SUITE   ');
console.log('===============================================================\n');

let passedTests = 0;
let failedTests = 0;

for (const tc of testCases) {
  const result = poseLandmarkerService.evaluateLandmarks(tc.poses, tc.category);
  
  let ok = true;
  const failureNotes: string[] = [];

  if (result.passed !== tc.expectedPassed) {
    ok = false;
    failureNotes.push(`Expected passed=${tc.expectedPassed}, got passed=${result.passed}`);
  }

  if (tc.expectedReason && !result.reasons.includes(tc.expectedReason)) {
    ok = false;
    failureNotes.push(`Expected reason [${tc.expectedReason}], got [${result.reasons.join(', ')}]`);
  }

  if (tc.expectedGuidanceContains && !result.guidance.includes(tc.expectedGuidanceContains)) {
    ok = false;
    failureNotes.push(`Expected guidance to contain "${tc.expectedGuidanceContains}", got "${result.guidance}"`);
  }

  const icon = ok ? 'PASS' : 'FAIL';
  console.log(`[${icon}] ${tc.id}: ${tc.name}`);
  console.log(`       Category: ${tc.category}`);
  console.log(`       Gate Result: passed=${result.passed} | guidance="${result.guidance}"`);
  console.log(`       Reasons: [${result.reasons.join(', ') || 'NONE'}]`);
  console.log(`       Height: ${result.metrics.bodyHeightPercent}% | Persons: ${result.allPosesCount}`);

  if (!ok) {
    failedTests++;
    console.error(`       ERRORS: ${failureNotes.join('; ')}`);
  } else {
    passedTests++;
  }
  console.log('---------------------------------------------------------------');
}

console.log(`\nSUMMARY: ${passedTests} PASSED, ${failedTests} FAILED out of ${testCases.length} tests.\n`);

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('All Capture Gate test scenarios passed successfully!');
  process.exit(0);
}
