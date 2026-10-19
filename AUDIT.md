# AUDIT: Detailed Codebase & Architecture Audit
**Repository:** `github.com/ajay55m/Virtual-trial-room`  
**Audit Date:** October 19, 2026  
**Auditor:** Senior Full-Stack & Computer-Vision Engineer  

---

## 1. How the Garment is Positioned Today

### A. Active Components
- **`frontend/src/services/api.ts`** &rarr; `createClientSideTryonComposite()` (Lines 578–644)
- **`backend/app/services/tryon_synthesizer.py`** &rarr; `_drape_garment_onto_person()` (Lines 352–427)
- **`frontend/src/components/ResultView.tsx`** (Lines 89–150, 440–590)
- **`frontend/src/components/PositioningCamera.tsx`** (Lines 336–356)

### B. Exact Coordinate & Sizing Math
In both `api.ts` (client canvas) and `tryon_synthesizer.py` (server PIL), the garment overlay is calculated using **pure fixed percentages of the raw image resolution**, with **zero landmark anchoring**:

```javascript
// From frontend/src/services/api.ts (lines 606-633)
const isPortrait = uH > uW;
let baseW = uW * 0.58;
let posY = uH * 0.20;

if (cat.includes('pant') || cat.includes('lower') || cat.includes('short')) {
  baseW = isPortrait ? uW * 0.50 : uW * 0.38;
  posY = (isPortrait ? uH * 0.50 : uH * 0.52) + deltaY;
} else if (cat.includes('foot') || cat.includes('shoe')) {
  baseW = isPortrait ? uW * 0.42 : uW * 0.34;
  posY = (isPortrait ? uH * 0.82 : uH * 0.76) + deltaY;
} else if (cat.includes('saree') || cat.includes('dress') || cat.includes('full')) {
  baseW = isPortrait ? uW * 0.64 : uW * 0.48;
  posY = (isPortrait ? uH * 0.20 : uH * 0.25) + deltaY;
} else {
  // Standard tops: t-shirts, sweaters, shirts, blazers, jackets
  baseW = isPortrait ? uW * 0.56 : uW * 0.44;
  posY = (isPortrait ? uH * 0.21 : uH * 0.32) + deltaY;
}

const targetW = baseW * totalScale;
const aspect = gH / gW;
const targetH = targetW * aspect;
const posX = (uW - targetW) / 2 + deltaX;
```

### C. Why the Garment Landed Over the Nose & Mouth in the Screenshot
1. **Vertical Offset (`posY = uH * 0.21`):** In portrait mode, the top edge of the garment flatlay is always placed at exactly **21% down from the top edge of the photo**. When a user takes a selfie or stands too close to the camera (showing only head, neck, and upper chest), the 21% mark falls directly across the shopper's chin, mouth, and nose.
2. **Horizontal Centering (`posX = (uW - targetW) / 2`):** The garment is horizontally centered on the image canvas itself, rather than centered between the user's shoulders.
3. **Absence of Landmark Anchoring:** There is no calculation of shoulder midpoint, neckline, or torso height.
4. **Folded Garment Asset (`garment_basic_sweater.png`):** The asset in `frontend/public/assets/garment_basic_sweater.png` is an image of a folded sweater with its sleeves crossed over the chest. Because the sleeves are not extended into an open-arm pose, rendering it on top of a body naturally looks like a folded bundle stuck onto the user's neck.
5. **Live Camera Overlay in `PositioningCamera.tsx`:** While the camera is running, there is **zero AR garment overlay**. The screen only shows an empty, static CSS oval outline (`w-72 h-[75%] border-2 rounded-full`, lines 345–355).

---

## 2. Audit of Hardcoded Values, Mock Sizing & Fake Claims

| Metric / Claim | File & Line Number | Exact Code Content | Status | Reality |
| :--- | :--- | :--- | :--- | :--- |
| **"SIZE M, 96% MATCH"** | `frontend/src/components/ResultView.tsx:172, 184, 641, 645` | `const recommendedSize = isSaree ? 'Free Size' : 'M';`<br>`confidence: currentSize === recommendedSize ? 0.96 : 0.88`<br>`{Math.round(recommendation.confidence * 100)}% MATCH` | **MOCK** | Static rule returning `M` and `0.96` (96%) whenever size `M` is selected. |
| **"Derived from SMPL 3D human body shape estimation"** | `frontend/src/components/ResultView.tsx:648`<br>`backend/app/services/sizing_engine.py:6` | `<div className="text-xs text-slate-500 font-medium">Derived from SMPL 3D human body shape estimation</div>` | **MOCK** | No SMPL, SMPL-X, or 3D mesh model exists in the codebase. Purely a decorative UI caption. |
| **Chest 96 cm, Waist 78 cm, Hips 98 cm, Height 175 cm** | `frontend/src/components/ResultView.tsx:190-196` | `measurementBreakdown: { chestCm: currentSize === 'M' ? 96 : ..., waistCm: currentSize === 'M' ? 78 : ..., hipCm: currentSize === 'M' ? 98 : ..., shoulderCm: 44, heightCm: 175 }` | **MOCK** | Hardcoded lookup table switching exact numbers (`96`, `78`, `98`) based solely on the active size button (`XS`, `S`, `M`, `L`, `XL`). |
| **Linear Scale Proxy** | `backend/app/services/sizing_engine.py:20, 28-31` | `scale = height_cm / 175.0`<br>`chest = round(96.0 * scale, 1)`<br>`waist = round(79.0 * scale, 1)`<br>`hip = round(96.0 * scale, 1)` | **MOCK** | Elementary arithmetic proxy multiplying fixed baseline values by `height / 175.0`. No body shape extraction. |
| **"mTLS ENCRYPTED" Badge** | `frontend/src/components/Header.tsx:67` | `<span className="tracking-wide">mTLS ENCRYPTED</span>` | **MOCK** | Static decorative text. No client certificates, mTLS handshake, or certificate authorities exist. |
| **mTLS Telemetry Logs** | `frontend/src/components/AdminModal.tsx:34`<br>`backend/app/api/v1/endpoints/telemetry.py:17` | `message: 'FASTAPI_GATEWAY: mTLS device certificate verified for Kiosk #04.'` | **MOCK** | Hardcoded string literal inside mock telemetry arrays. |
| **"Llama Style & Sizing Advisor" Card** | `frontend/src/components/ResultView.tsx:608-634`<br>`frontend/src/components/StyleAssistant.tsx:160-200`<br>`backend/app/services/style_assistant.py:274-298` | UI cards and slide-over consultation drawer. | **PARTIAL** | Backend has `AsyncInferenceClient` scaffolded, but defaults to static canned strings when token is unauthorized or quota is exceeded. |
| **Pose Quality Metrics (99.4%, Height 84%, Yaw 2°)** | `frontend/src/components/PositioningCamera.tsx:45-53`<br>`frontend/src/components/ReviewScreen.tsx:50-80` | `const metrics: PoseQualityMetrics = { sharpnessVariance: useWebcam ? 480 : 420, bodyHeightPercent: 84, horizontalCenterOffset: 1, shoulderYawDegrees: 2, personCount: 1, aPoseCompliant: true, stabilityTimeSec: stabilityTime };` | **MOCK** | `@mediapipe/tasks-vision` is never imported. All values are hardcoded constants. Stability timer is a fake `setInterval` tick. |
| **Fleet Diagnostics (14.2 / 24 GB VRAM, L40S, 58°C)** | `frontend/src/components/AdminModal.tsx:80-100`<br>`backend/app/api/v1/endpoints/telemetry.py:54-65` | `14.2 / 24 GB NVIDIA L40S Datacenter GPU (58°C)`<br>`0 Active / 2 Batch Redis Broker`<br>`100% PURGED Hard TTL 15-min Lifecycle Rule` | **MOCK** | Entire diagnostic panel is hardcoded text and numbers. |

---

## 3. Places Where Try-On Results are Static Images

The application returns or references static pre-rendered studio images in **8 distinct locations**:

1. **`backend/app/services/tryon_synthesizer.py` (lines 62–79, `FALLBACK_RESULT_MAP`):**
   - Maps 16 garments to static pre-generated images:
     - `garm_vf_tshirt` &rarr; `/assets/virtualfit_model_tshirt.jpg`
     - `garm_vf_sweater` &rarr; `/assets/virtualfit_model_sweater.jpg`
     - `garm_vf_shirt` &rarr; `/assets/virtualfit_model_shirt.jpg`
     - `garm_001` (Blazer) &rarr; `/assets/tryon_blazer.jpg`
     - `garm_002` (Dress) &rarr; `/assets/tryon_dress.jpg`
     - `garm_003` (Jacket) &rarr; `/assets/tryon_jacket.jpg`
     - `garm_saree_01` &rarr; `/assets/tryon_saree_kanjeevaram.jpg`
     - `garm_saree_02` &rarr; `/assets/tryon_saree_banarasi.jpg`
     - `garm_saree_03` &rarr; `/assets/tryon_saree_emerald.jpg`
     - `garm_men_01` &rarr; `/assets/tryon_men_sherwani.jpg`
     - `garm_men_02` &rarr; `/assets/tryon_men_tuxedo.jpg`
     - `garm_men_03` &rarr; `/assets/tryon_men_bandhgala.jpg`
2. **`backend/app/services/tryon_synthesizer.py` (lines 82–98, `SAREE_MODEL_TARGETS`):**
   - References static studio photos (`tryon_saree_kanjeevaram.jpg`, etc.) onto which a cropped oval of the user's face is pasted.
3. **`backend/app/api/v1/endpoints/catalog.py` (lines 25, 46, 67, 90, 115, 137, 157, 177, 197):**
   - Every catalog garment object includes hardcoded `tryonResultImage` and `virtualModelImage` properties pointing to `/assets/tryon_*.jpg`.
4. **`frontend/src/data/mockGarments.ts` (lines 21, 56, 89, 121, 152, 176, 200, 224, 244, 264, 284, 304):**
   - Every frontend garment definition hardcodes `tryonResultImage` to `/assets/virtualfit_model_*.jpg` or `/assets/tryon_*.jpg`.
5. **`frontend/src/components/GeneratingPipeline.tsx` (lines 79, 142):**
   - Defaults directly to `garment.virtualModelImage || garment.tryonResultImage` upon timer completion.
6. **`frontend/src/components/ResultView.tsx` (line 83):**
   - Initializes `defaultModelUri = garment.virtualModelImage || garment.tryonResultImage || '/assets/virtualfit_model_tshirt.jpg'`.
7. **`frontend/src/services/api.ts` (lines 206–250, `blendUserFaceOntoModel`):**
   - Loads static `modelImg` from `/assets/` and paints it onto the canvas, pasting user's face over it.
8. **`frontend/src/App.tsx` (line 21):**
   - `capturedPhotoUri` state is initialized with the static image `/assets/virtualfit_model_tshirt.jpg`.

---

## 4. Execution Report: `npm install && npm run dev`

### A. Execution in Workspace Root (`C:\AI`)
- **Command:** `npm install && npm run dev`
- **Result:** **FAILS IMMEDIATELY (Exit Code 1)**
- **Console Error:**
  ```text
  npm error code ENOENT
  npm error syscall open
  npm error path C:\AI\package.json
  npm error errno -4058
  npm error enoent Could not read package.json: Error: ENOENT: no such file or directory, open 'C:\AI\package.json'
  npm error enoent This is related to npm not being able to find a file.
  ```
- **Cause:** The root folder `C:\AI` has no `package.json`. The frontend project is isolated inside the `frontend/` directory.

### B. Execution in `frontend/` Directory (`C:\AI\frontend`)
- **Command:** `cd frontend && npm install && npm run dev`
- **Result:** **SUCCEEDS**. Vite v8.3.4 dev server boots on `http://localhost:5173/`.
- **Runtime Deficiencies:**
  - The UI runs, but there is zero live computer vision.
  - `@mediapipe/tasks-vision` is in `package.json` but is never imported.
  - Positioning is entirely uncalibrated (fixed 21% Y offset).
  - Background removal is non-existent.
  - The try-on output is a 2D canvas paste or a pre-made JPEG.

---

## 5. False & Unimplemented README Claims

1. **Monorepo Structure Misrepresentation:**
   - *Claim:* README says the root contains `public/assets/`, `src/components/`, `package.json`.
   - *Reality:* The repository is partitioned into `backend/` and `frontend/`. Root has no `package.json` or `src/`.
2. **Quickstart Instructions Fail:**
   - *Claim:* Running `npm install && npm run dev` in the repository root starts the kiosk.
   - *Reality:* Crashes immediately with `ENOENT: package.json missing`.
3. **MediaPipe Tasks Vision Pose Evaluation:**
   - *Claim:* README claims a MediaPipe Tasks Vision Web Worker evaluates 33 landmarks, A-pose compliance, 70–90% bounding height, yaw < 10°, single person detection, and Laplacian sharpness variance.
   - *Reality:* Completely unimplemented. `@mediapipe/tasks-vision` is never imported. All pose numbers are hardcoded dummy constants.
4. **PyTorch CatVTON / IDM-VTON Worker Pool:**
   - *Claim:* README claims a GPU worker pool executing FP16 UNet inference, DensePose mapping, and an identity preservation quality gate.
   - *Reality:* Unimplemented. `tryon_worker.py` contains dummy `time.sleep()`. Backend endpoint uses `asyncio.sleep()`. No PyTorch models run locally.
5. **SMPL 3D Body Shape Regression:**
   - *Claim:* README claims SMPL body shape regression estimating physical circumferences.
   - *Reality:* Unimplemented. `sizing_engine.py` is a simple linear multiplication proxy (`height_cm / 175.0`).
6. **15-Minute Ephemeral Privacy Purge / MinIO:**
   - *Claim:* README claims GDPR/BIPA compliant ephemeral storage with MinIO encrypted storage and automated 15-minute purge.
   - *Reality:* MinIO is disabled by default. User captures are saved directly to unencrypted public disk (`frontend/public/assets/captures/`). Purge daemon is an unexecuted Celery stub.
7. **PostgreSQL Database & Redis Queue:**
   - *Claim:* README claims PostgreSQL catalog DB and Redis broker.
   - *Reality:* Unimplemented in the runtime path. Sessions are stored in a transient in-memory Python dictionary (`ACTIVE_SESSIONS`). Catalog is an in-memory Python list. Redis is disconnected.
8. **Fleet Diagnostics & GPU Telemetry:**
   - *Claim:* README claims live GPU VRAM memory monitoring (NVIDIA L40S, 14.2 / 24 GB, 58°C) and Celery queue depth.
   - *Reality:* All values in `AdminModal.tsx` and `telemetry.py` are static hardcoded strings.
