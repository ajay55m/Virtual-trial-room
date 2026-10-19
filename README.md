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
[ Touch Kiosk UI ] ➔ [ MediaPipe Edge Vision ] ➔ [ FastAPI Gateway ] ➔ [ PyTorch VTON Worker ]
         │                        │                     │                      │
   (Touch State)           (Pose Validation)       (mTLS Auth & WS)         (CatVTON / IDM-VTON)
```

---

## 🚀 Key Features

* **Guided Edge Vision Capture:** MediaPipe Tasks Vision (`@mediapipe/tasks-vision`) Web Worker evaluating pose compliance (33 landmarks, A-pose, bounding height 70-90%, yaw < 10°, single person check, Laplacian sharpness variance).
* **Photorealistic AI VTON Pipeline:** PyTorch CatVTON / IDM-VTON model adapters with FP16 UNet inference pass, DensePose surface mapping, and identity preservation quality gate.
* **Precision Measurement & Sizing Engine:** SMPL body shape regression estimating chest, waist, hips, shoulder, and height circumferences matched against brand size charts, enforcing an **Honesty Rule alert** if fit differs from visual render.
* **100% Ephemeral Privacy Compliance:** Ephemeral storage lifecycle with a **hard 15-minute TTL purge** (GDPR / BIPA compliant). Relational database stores zero user imagery.
* **Luxury Kiosk UI & Web Audio Feedback:** Dark glassmorphism interface tailored for touch displays with procedural sci-fi audio feedback powered by Web Audio API.
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

## 🔒 Security & Ephemeral Privacy

All captured user stills, intermediate keypoint arrays, and segmentation masks are held temporarily in encrypted object storage (MinIO) with a **hard 15-minute TTL limit**. 

Relational PostgreSQL databases store **zero personal photos or biometric templates**, capturing only session UUIDs, timestamps, and audit event logs.

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.
