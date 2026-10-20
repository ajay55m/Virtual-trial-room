# AURA | AI Virtual Fitting Room Kiosk System
> Next-Generation Photorealistic AI Virtual Fitting Studio for Textile & Luxury Clothing Brands.

[![React](https://img.shields.io/badge/React-19.0-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.3-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4.0-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## 🌟 System Overview

The **AURA Virtual Fitting Room Kiosk System** is an in-store hardware-software solution enabling shoppers to visually try on garments photorealistically via GPU-accelerated Virtual Try-On (VTON) diffusion models and receive data-backed size recommendations—without changing rooms or pre-existing 3D garment assets from brands.

```
[ Touch Kiosk UI ] ➔ [ MediaPipe Edge Vision ] ➔ [ FastAPI Gateway ] ➔ [ Cloud VTON Inference ]
         │                        │                     │                      │
   (Touch State)           (Pose Validation)      (Session Auth & WS)    (IDM-VTON / Fal / FASHN)
```

---

## 🚀 Key Features

* **Guided Edge Vision Capture:** MediaPipe Tasks Vision (`@mediapipe/tasks-vision`) client evaluating pose compliance (33 landmarks, A-pose, distance bounding, alignment tilt, single person check, and contrast).
* **Mode A: Live AR Drape Engine:** Hardware-accelerated affine landmark clothing drape running at 30–60 fps with Exponential Moving Average (EMA) temporal smoothing filter.
* **Mode B: Photoreal Generative VTON:** Real diffusion try-on pipeline with garment-agnostic semantic masking and automated face identity preservation verification gate.
* **Proportional Measurement & Sizing Ranges:** Estimates realistic body circumference ranges (chest, waist, hips) from detected 2D landmarks and user height, enforcing honest uncertainty ranges rather than unbacked SMPL claims.
* **100% Ephemeral Privacy Compliance:** Ephemeral storage lifecycle with a **hard 15-minute TTL purge** (GDPR compliant). Relational database stores zero user imagery.
* **Luxury Kiosk UI & Web Audio Feedback:** Dark glassmorphism interface tailored for touch displays with procedural audio feedback powered by Web Audio API.

* **Fleet Diagnostics Dashboard:** Integrated telemetry modal monitoring GPU VRAM memory, Celery Redis queue depth, OpenAPI contract validation, and data purge reconciliation logs.

---

## 🛠️ Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Kiosk Shell** | Electron / Browser + Next.js / React 19 + TypeScript |
| **Styling** | TailwindCSS v4 + Dark Glassmorphism Design System |
| **Edge Vision** | MediaPipe Tasks Vision Web Worker (`@mediapipe/tasks-vision`) |
| **API Gateway** | FastAPI (Python 3.11+) + Pydantic v2 + WebSockets |
| **Message Queue** | Redis Broker + Celery Worker Pool |
| **AI Inference** | PyTorch + Hugging Face Diffusers (CatVTON / IDM-VTON) |
| **Storage & DB** | PostgreSQL + MinIO Encrypted Ephemeral Object Storage |

---

## 📂 Project Structure

```
Virtual-trial-room/
├── frontend/                    # Interactive Kiosk Frontend (React 19 + TypeScript + Vite)
│   ├── public/
│   │   ├── models/              # Local MediaPipe task models (pose_landmarker_lite.task)
│   │   ├── wasm/                # MediaPipe WebAssembly binaries
│   │   └── assets/              # Garment catalog assets & test images
│   ├── src/
│   │   ├── components/          # Kiosk UI Components
│   │   │   ├── Header.tsx           # Kiosk header & state bar
│   │   │   ├── IdleScreen.tsx       # Touch-to-enter standby view
│   │   │   ├── ConsentModal.tsx     # Biometric privacy consent modal
│   │   │   ├── PositioningCamera.tsx# Live MediaPipe Pose Gate & guidance HUD
│   │   │   ├── ReviewScreen.tsx     # Capture inspection & upload replacement
│   │   │   ├── CatalogView.tsx      # Garment catalog browsing & selection
│   │   │   ├── GeneratingPipeline.tsx# Try-on progress screen
│   │   │   └── ResultView.tsx       # Dual-mode try-on inspection view
│   │   ├── services/
│   │   │   ├── api.ts               # Backend HTTP/WS API client
│   │   │   └── poseLandmarker.ts    # MediaPipe Tasks Vision Pose Landmarker service
│   │   ├── types/kiosk.ts           # TypeScript domain definitions
│   │   └── App.tsx                  # Kiosk State Router
│   ├── package.json
│   └── vite.config.ts
├── backend/                     # Retail API Gateway (FastAPI + Python 3.11+)
│   ├── app/
│   │   ├── api/v1/endpoints/    # REST endpoints (catalog, sessions, tryon)
│   │   └── services/            # Try-on synthesis, SAM segmenter, sizing engine
│   └── requirements.txt
├── launch_kiosk.bat             # Enterprise Kiosk Launcher (Chrome App Window)
├── AUDIT.md                     # Comprehensive Codebase & Architecture Audit
└── README.md
```

---

## ⚡ Quickstart & Local Setup

### Prerequisites
* **Node.js**: v18.0.0 or higher
* **Python**: v3.10+ (for backend)

### Running the Frontend

```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173/` in your browser.

### Running the Backend

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### Full Kiosk Launcher

Double-click or run `.\launch_kiosk.bat` from PowerShell/CMD in the repository root.

---

## 🛡️ Capture Gate (Phase 1 Implemented)

The live camera feed evaluates every frame using `@mediapipe/tasks-vision` (`pose_landmarker_lite.task` running on GPU Wasm):
- **Tops Requirement:** Shoulders (11, 12) and hips (23, 24) must have visibility > 0.5.
- **Full Outfits / Sarees Requirement:** Ankles (27, 28) also required with visibility > 0.5.
- **Single Person Gate:** Multiple detected persons immediately reject the frame with `"Only one person"`.
- **Torso Occlusion Check:** Detects wrists and hand keypoints (15–22) inside the torso region to prevent selfies holding phones over the chest (`"Lower your phone"`).
- **Framing Gate:** Requires shopper to fill at least 60% of frame height (`"Step closer to camera"` or `"Step back"`).
- **1.0s Stability Hold:** The shopper must hold the valid pose continuously for at least 1.0 second before capture can be triggered.
- **Enforced Capture Button:** The capture button remains strictly disabled until all criteria pass continuously for 1.0 second.
- **Automated Verification Suite:** Run `npx tsx scripts/test_pose_gate.ts` inside `frontend/` to execute the automated gate verification suite (covering head-and-shoulders, hand-on-chest phone occlusion, multi-person presence, framing height, ankle visibility, and valid pose).

---

## 👗 Garment Asset Standard (Phase 2 Implemented)

Every garment in the catalog must adhere to the physical try-on standard:
- **Format:** Isolated transparent PNG (`RGBA`) with transparent outer border pixels ($alpha < 10$). Rejects solid rectangles or renamed JPEGs.
- **Draping Geometry:** Garments must be photographed flat-lay or ghost-mannequin with sleeves extended outwards in an A-pose (no crossed sleeves, no folded arms).
- **Companion Metadata (`<garment_name>.json`):**
  - `category`: `"upper"` | `"lower"` | `"overall"`
  - `aspect_ratio`: Float matching image width / height within 2%.
  - Normalized anchor keypoints `[x, y]` in `[0, 1]`:
    - `neckline_center`: Upper collar/neckline midpoint.
    - `left_shoulder` / `right_shoulder`: Shoulder seam endpoints.
    - `hem_center`: Bottom hem midpoint.
    - `left_cuff` / `right_cuff`: Sleeve wrist endpoints (sleeves extended).
    - `waist_center` / `left_hip` / `right_hip` (for pants / lower body).
- **Automated Catalog Validator:** Run `python scripts/validate_garment_assets.py` to validate all catalog PNGs and metadata JSONs.
- **Defects Fixed:**
  - Folded sweater defect replaced with flat-lay cashmere sweater with extended sleeves.
  - Saree catalog assets (`kanjeevaram`, `banarasi`, `emerald`) converted from solid JPEGs to transparent ghost-mannequin PNGs.
  - White t-shirt recentered with clean alpha margins.
  - 100% of catalog assets (16/16) have companion JSON anchors and pass automated validation.

---

## ⚡ Mode A: Live AR Drape (Phase 3 Implemented)

A real-time, hardware-accelerated AR clothing drape pipeline running at **~30–60 fps** in the browser:
- **Landmark Anchoring Math:**
  - Garment neckline center maps to the midpoint between shoulders (`11`, `12`).
  - Garment shoulder width scales to match the shopper's shoulder distance ($W_{\text{sh}} \times 1.15$ relaxed ease factor).
  - Garment rotation tracks the shoulder slope angle $\theta = \text{atan2}(y_{12} - y_{11}, x_{12} - x_{11})$.
  - Garment hem tracks the hip midpoint (`23`, `24`) for tops, or ankles (`27`, `28`) for sarees/gowns.
- **Exponential Moving Average (EMA) Smoothing:**
  - An EMA filter with $\alpha = 0.35$ eliminates high-frequency landmark jitter, providing fluid motion without lag.
  - Automatic discontinuity reset triggers if subject jumps $> 20\%$ of frame width.
- **Live Kiosk UI:**
  - Labeled with the prominent badge: `Mode A: Live AR Drape (30 fps)`.
  - Real-time telemetry counter: `Tracking: XX ms | FPS: YY`.
  - Interactive on-screen garment selector carousel allowing shoppers to switch garments while looking in the camera.
  - View toggle between `👗 AR Drape` and `🦴 Skeleton Guide`.
- **Verification Commands:**
  - Run `npx tsx scripts/test_ar_drape.ts` in `frontend/` (verifies 11 mathematical tracking checks).
  - Run `python scripts/test_ar_drape_sequence.py` (generates 10-frame visual tracking proof and animated WebP at `frontend/public/assets/test_ar_drape_output/live_ar_drape_sequence.webp`).

---

## 🎨 Mode B: Photoreal Virtual Try-On (Phase 4 Implemented)

A photoreal virtual try-on engine for captured stills, replacing pre-rendered static mockups with real generative diffusion and automated identity preservation:

### 1. 4-Stage Production Pipeline
1. **Validated Still Input:** Verifies capture resolution and single-person framing from Phase 1.
2. **Garment-Agnostic Masking:** Generates semantic body masks preserving face, neck, arms, and lower body while erasing target clothing regions.
3. **Real VTON Model Dispatch:** Routes through the uniform `TryOnProvider` interface (`try_on(person_image_bytes, garment_image_bytes, category) -> TryOnResult`).
4. **Face Identity Verification Gate:** Extracts face patches and computes SSIM luminance + multi-channel histogram correlation. Automatically rejects outputs with `FaceIdentityMismatchError` if identity similarity falls below the configurable threshold (`FACE_SIMILARITY_THRESHOLD = 0.55`).

### 2. Available Providers & Commercial Licensing Assessment
| Provider | Underlying Model | License | Commercial Retail Use? | Hardware Required |
| :--- | :--- | :--- | :--- | :--- |
| **FASHN.ai** | MMDiT Pixel-Space | **Apache-2.0** | **YES &mdash; Fully Allowed** | Cloud REST API / ~8-12 GB VRAM |
| **Hugging Face IDM-VTON** | SDXL + TryonNet | **CC BY-NC-SA 4.0** | **NO &mdash; Non-Commercial** | Cloud ZeroGPU / 16–24 GB VRAM |
| **Fal.ai CatVTON** | Concatenation SD 1.5 | **CC BY-NC-SA 4.0** | **NO &mdash; Non-Commercial** | Cloud API / ~8–12 GB VRAM |

### 3. GPU Hardware & Environment Requirements
- **Local Self-Hosted Inference:** Requires an NVIDIA GPU with at least **16 GB to 24 GB of VRAM** (e.g., NVIDIA RTX 3090, 4090, A10G, or L4) running CUDA 12+.
- **Edge Kiosks & Laptops (e.g. 4 GB RTX 2050):** Offload VTON inference to cloud APIs (Hugging Face ZeroGPU, Fal.ai, or FASHN.ai) to prevent CUDA Out-of-Memory (OOM) failures.
- **Environment Configuration (`backend/.env`):**
  ```env
  TRYON_PROVIDER=huggingface    # Options: huggingface, fal, fashn
  HF_TOKEN=hf_...               # Hugging Face User Access Token
  FAL_KEY=fal_sk_...            # Optional: Fal.ai API Key
  FASHN_API_KEY=...             # Optional: FASHN Commercial API Key
  FACE_SIMILARITY_THRESHOLD=0.55
  DEMO_MODE=false               # Strict Anti-Mock: false returns real errors on failure
  ```

### 4. Asynchronous REST Endpoints
- **`POST /v1/tryon`**: Accepts `person_image` (multipart upload) and `garment_id` (or custom `garment_image`). Enqueues background job and returns HTTP `202 Accepted` with `job_id` and `poll_url`.
- **`GET /v1/tryon/{job_id}`**: Returns real-time status (`QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED`), current stage, live worker logs, face similarity metrics, and signed `result_url`.
- **Anti-Mock Guarantee:** Zero silent fallbacks to static images. If an inference fails or face identity drifts, the API and kiosk UI present a transparent error screen with failure details and a retry action.

### 5. Automated Verification
Run the comprehensive Phase 4 verification suite:
```bash
python scripts/test_tryon_pipeline.py
```
*Verifies provider interfaces, mask generation, face identity gate, anti-mock error handling, sleeve placement, and asynchronous FastAPI polling endpoints (6/6 tests passing).*

---

## 🔒 Security & Ephemeral Privacy

All captured user stills, intermediate keypoint arrays, and segmentation masks are held temporarily in encrypted object storage (MinIO) with a **hard 15-minute TTL limit**. 

Relational PostgreSQL databases store **zero personal photos or biometric templates**, capturing only session UUIDs, timestamps, and audit event logs.

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.

