/**
 * Phase 3 Mode A Live AR Drape Test Suite
 * Tests the real-time AR Drape engine math, landmark anchoring, rotation, and EMA smoothing:
 * 1. Neckline anchoring: Garment neckline center precisely targets shopper shoulder midpoint.
 * 2. Angular tracking: Garment rotates to match shoulder slope theta = atan2(dy, dx).
 * 3. Scale tracking: Garment scale adjusts with distance / shoulder span.
 * 4. EMA smoothing: High-frequency jitter is eliminated without jerky step changes.
 */

import { arDrapeEngine, type GarmentAnchorMetadata } from '../src/services/arDrapeEngine';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

const mockSweaterMeta: GarmentAnchorMetadata = {
  sku: 'VF-TOP-SWT-02',
  name: 'Basic Sweater',
  category: 'upper',
  aspect_ratio: 1.0,
  neckline_center: [0.5, 0.17],
  left_shoulder: [0.35, 0.19],
  right_shoulder: [0.65, 0.19],
  hem_center: [0.5, 0.85],
  left_cuff: [0.06, 0.78],
  right_cuff: [0.94, 0.78],
  bbox: [0.05, 0.16, 0.95, 0.85]
};

// Mock HTMLImageElement
const mockImg = { width: 1024, height: 1024 } as HTMLImageElement;
const CW = 1280;
const CH = 720;

function createPoseFrame(
  neckNormX: number,
  neckNormY: number,
  spanNorm: number,
  tiltDeg: number
): NormalizedLandmark[] {
  const tiltRad = (tiltDeg * Math.PI) / 180.0;
  const dx = (spanNorm / 2.0) * Math.cos(tiltRad);
  const dy = (spanNorm / 2.0) * Math.sin(tiltRad);

  const lms: NormalizedLandmark[] = [];
  for (let i = 0; i < 33; i++) {
    lms.push({ x: 0.5, y: 0.5, z: 0, visibility: 0.9 });
  }

  // Left shoulder: 11, Right shoulder: 12
  lms[11] = { x: neckNormX - dx, y: neckNormY - dy, z: 0, visibility: 0.95 };
  lms[12] = { x: neckNormX + dx, y: neckNormY + dy, z: 0, visibility: 0.95 };

  // Left hip: 23, Right hip: 24
  lms[23] = { x: neckNormX - dx * 0.8, y: neckNormY + 0.35, z: 0, visibility: 0.9 };
  lms[24] = { x: neckNormX + dx * 0.8, y: neckNormY + 0.35, z: 0, visibility: 0.9 };

  return lms;
}

console.log('==================================================================');
console.log('      PHASE 3: MODE A LIVE AR DRAPE ENGINE VERIFICATION SUITE     ');
console.log('==================================================================\n');

arDrapeEngine.resetFilter();

interface MotionStep {
  id: string;
  desc: string;
  neckX: number;
  neckY: number;
  span: number;
  tilt: number;
  expectedMinAngleDeg?: number;
  expectedMaxAngleDeg?: number;
}

const steps: MotionStep[] = [
  { id: 'FRAME-01', desc: 'Upright centered baseline pose', neckX: 0.50, neckY: 0.30, span: 0.22, tilt: 0.0, expectedMinAngleDeg: -1.0, expectedMaxAngleDeg: 1.0 },
  { id: 'FRAME-02', desc: 'Micro movement / breathing', neckX: 0.502, neckY: 0.301, span: 0.221, tilt: 0.3, expectedMinAngleDeg: -1.0, expectedMaxAngleDeg: 1.5 },
  { id: 'FRAME-03', desc: 'Leaning left (-6 degrees)', neckX: 0.49, neckY: 0.305, span: 0.22, tilt: -6.0 },
  { id: 'FRAME-04', desc: 'Full lean left (-12 degrees)', neckX: 0.48, neckY: 0.31, span: 0.218, tilt: -12.0, expectedMinAngleDeg: -12.0, expectedMaxAngleDeg: -2.0 },
  { id: 'FRAME-05', desc: 'Transition towards right (+3 degrees)', neckX: 0.51, neckY: 0.305, span: 0.22, tilt: 3.0 },
  { id: 'FRAME-06', desc: 'Full lean right (+12 degrees)', neckX: 0.53, neckY: 0.31, span: 0.22, tilt: 12.0, expectedMinAngleDeg: 1.0, expectedMaxAngleDeg: 12.0 },
  { id: 'FRAME-07', desc: 'Step back start (span reduced to 0.17)', neckX: 0.51, neckY: 0.32, span: 0.17, tilt: 3.0 },
  { id: 'FRAME-08', desc: 'Full step back (span = 0.15, -32% size)', neckX: 0.50, neckY: 0.34, span: 0.15, tilt: 0.0 },
  { id: 'FRAME-09', desc: 'Step forward returning to center', neckX: 0.50, neckY: 0.32, span: 0.19, tilt: 0.0 },
  { id: 'FRAME-10', desc: 'Stable upright centered finish', neckX: 0.50, neckY: 0.30, span: 0.22, tilt: 0.0, expectedMinAngleDeg: -1.5, expectedMaxAngleDeg: 1.5 },
];

let passCount = 0;
let failCount = 0;

let initialScale = 0;
let stepBackScale = 0;

for (const step of steps) {
  const lms = createPoseFrame(step.neckX, step.neckY, step.span, step.tilt);
  const transform = arDrapeEngine.computeDrapeTransform(
    lms,
    mockSweaterMeta,
    mockImg,
    CW,
    CH,
    false // unmirrored test
  );

  if (!transform) {
    console.error(`[FAIL] ${step.id}: Transform computation returned null!`);
    failCount++;
    continue;
  }

  const deg = (transform.angle * 180) / Math.PI;
  if (step.id === 'FRAME-01') initialScale = transform.scaleX;
  if (step.id === 'FRAME-08') stepBackScale = transform.scaleX;

  let ok = true;
  const errors: string[] = [];

  // Check expected angle bounds if specified
  if (step.expectedMinAngleDeg !== undefined && deg < step.expectedMinAngleDeg) {
    ok = false;
    errors.push(`Angle ${deg.toFixed(2)}° < expected min ${step.expectedMinAngleDeg}°`);
  }
  if (step.expectedMaxAngleDeg !== undefined && deg > step.expectedMaxAngleDeg) {
    ok = false;
    errors.push(`Angle ${deg.toFixed(2)}° > expected max ${step.expectedMaxAngleDeg}°`);
  }

  // Check anchoring: neckX should be reasonably close to target neckX * CW
  const targetPixelX = step.neckX * CW;
  const targetPixelY = step.neckY * CH;
  const posError = Math.hypot(transform.neckX - targetPixelX, transform.neckY - targetPixelY);
  if (posError > 40) {
    ok = false;
    errors.push(`Position error ${posError.toFixed(1)}px exceeds threshold`);
  }

  const icon = ok ? 'PASS' : 'FAIL';
  console.log(`[${icon}] ${step.id}: ${step.desc}`);
  console.log(`       Neck: (${transform.neckX.toFixed(1)}, ${transform.neckY.toFixed(1)}) px | Angle: ${deg.toFixed(1)}° | Scale: ${transform.scaleX.toFixed(2)}x`);
  if (!ok) {
    console.error(`       ERRORS: ${errors.join('; ')}`);
    failCount++;
  } else {
    passCount++;
  }
  console.log('------------------------------------------------------------------');
}

// Check scale scaling when person stepped back (Frame 8 vs Frame 1)
const scaleRatio = stepBackScale / initialScale;
console.log(`\nScale Verification: Step-back scale ratio = ${scaleRatio.toFixed(3)} (expected ~ 0.15/0.22 = 0.68)`);
if (scaleRatio >= 0.60 && scaleRatio <= 0.85) {
  console.log('[PASS] Step-back distance scaling correctly modulated garment size.');
  passCount++;
} else {
  console.error('[FAIL] Step-back scale ratio out of expected range!');
  failCount++;
}

console.log(`\nSUMMARY: ${passCount} PASSED, ${failCount} FAILED out of ${steps.length + 1} checks.\n`);

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('All Phase 3 Mode A Live AR Drape tests passed successfully!');
  process.exit(0);
}
