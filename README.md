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
virtual-room/
├── public/
│   └── assets/                  # Generated demo photos & try-on renders
│       ├── demo_person.jpg      # Base A-pose studio photo
│       ├── garment_blazer.jpg   # Tailored Silk Blazer flatlay
│       ├── tryon_blazer.jpg     # Photorealistic VTON result
│       ├── garment_dress.jpg    # Emerald Evening Gown flatlay
│       ├── tryon_dress.jpg      # Photorealistic VTON result
│       ├── garment_jacket.jpg   # Cybernetic Techwear Jacket flatlay
│       └── tryon_jacket.jpg     # Photorealistic VTON result
├── src/
│   ├── components/              # Interactive UI Kiosk Modules
│   │   ├── Header.tsx           # Kiosk status bar, time & audio controls
│   │   ├── IdleScreen.tsx       # Ambient touch-to-start standby view
│   │   ├── ConsentModal.tsx     # BIPA/GDPR privacy agreement modal
│   │   ├── PositioningCamera.tsx# MediaPipe pose guidance & webcam/demo capture
│   │   ├── ReviewScreen.tsx     # Capture EXIF verification & quality checks
│   │   ├── CatalogView.tsx      # Garment catalog browsing & size selection
│   │   ├── GeneratingPipeline.tsx# VTON progress pass & WS log inspector
│   │   ├── ResultView.tsx       # VTON render toggle, sizing card & QR export
│   │   └── AdminModal.tsx       # Kiosk telemetry & data purge audit
│   ├── data/
│   │   └── mockGarments.ts      # Luxury clothing catalog dataset
│   ├── types/
│   │   └── kiosk.ts             # Domain TypeScript interfaces
│   ├── utils/
│   │   └── audio.ts             # Web Audio feedback synthesizer
│   ├── App.tsx                  # Kiosk State Machine Router
│   ├── main.tsx                 # React Root entrypoint
│   └── index.css                # Custom glassmorphism styles & animations
├── Virtual Fitting Room Kiosk System Design Document.docx
├── system_design_analysis.md    # Complete Architecture Analysis Report
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## ⚡ Quickstart & Local Setup

### Prerequisites
* **Node.js**: v18.0.0 or higher
* **NPM**: v9.0.0 or higher

### Installation

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/ajay55m/Virtual-trial-room.git
   cd Virtual-trial-room
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Start Development Server:**
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173/` in your browser.

4. **Build Production Bundle:**
   ```bash
   npm run build
   ```

---

## 🔒 Security & Ephemeral Privacy

All captured user stills, intermediate keypoint arrays, and segmentation masks are held temporarily in encrypted object storage (MinIO) with a **hard 15-minute TTL limit**. 

Relational PostgreSQL databases store **zero personal photos or biometric templates**, capturing only session UUIDs, timestamps, and audit event logs.

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.
