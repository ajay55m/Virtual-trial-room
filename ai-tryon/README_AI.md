# AI Photo-Based Virtual Trial Room (IDM-VTON Saree Kiosk)

An AI-powered photo-based virtual fitting kiosk that drapes authentic Indian sarees onto full-body customer photos or pre-calibrated demo models using neural diffusion with IDM-VTON on Hugging Face.

---

## 📁 Architecture

```
ai-tryon/
├── backend/
│   ├── main.py              # FastAPI server with Gradio Client IDM-VTON integration (UNTOUCHED)
│   ├── requirements.txt     # Python dependencies
│   ├── .env.example         # Template for Hugging Face credentials
│   └── .env                 # Your configured HF Space and token
├── frontend/
│   ├── index.html           # 4-screen kiosk UI with 12 Sarees + 4 Demo Models
│   ├── style.css            # Luxury boutique store styling & animations
│   └── app.js               # Demo models, 12 sarees catalog, webcam capture, API caller
├── assets/
│   ├── clothes/             # 12 handcrafted saree images
│   │   ├── saree-01-blue-banarasi.jpg
│   │   ├── saree-02-red-banarasi.jpg
│   │   ├── saree-03-green-kanjivaram.jpg
│   │   ├── saree-04-pink-art-silk.jpg
│   │   ├── saree-05-yellow-chanderi.jpg
│   │   ├── saree-06-black-kota.jpg
│   │   ├── saree-07-grey-pink.jpg
│   │   ├── saree-08-peach-floral.jpg
│   │   ├── saree-09-maroon-silk.jpg
│   │   ├── saree-10-turquoise-silk.jpg
│   │   ├── saree-11-orange-banarasi.jpg
│   │   └── saree-12-light-blue.jpg
│   └── models/              # 4 demo models
│       ├── model-1.jpg (Aisha)
│       ├── model-2.jpg (Priya)
│       ├── model-3.jpg (Kavya)
│       └── model-4.jpg (Meera)
└── README_AI.md             # This guide
```

---

## 🚀 How to Run the Project

### Step 1: Start the FastAPI Backend
Open PowerShell or your terminal:
```powershell
cd C:\AI\ai-tryon\backend
uvicorn main:app --reload --port 8000
```
- Backend starts at **`http://localhost:8000`**
- Health check returns `{"message": "AI Backend Running", "status": "online", "token_configured": true}`

### Step 2: Open the Kiosk in Your Browser
- Navigate to **`http://localhost:8000/frontend/index.html`** in your browser, or right-click `ai-tryon/frontend/index.html` and choose **"Open with Live Server"**.

---

## 🎯 4-Screen Kiosk Customer Flow

1. **Screen 1 — 12-Saree Catalog:**
   - Displays all 12 handcrafted sarees with prices (INR 1,199 to INR 3,299) and silk details.
   - Fail-safe: If any image is missing, a stylized colored placeholder card renders automatically so the UI never breaks.
   - Clicking a saree selects it and advances to Screen 2.

2. **Screen 2 — Model or Photo:**
   - **Quick Try Demo Models:** 4 pre-calibrated demo models (Aisha, Priya, Kavya, Meera). Clicking a model fetches its image file, converts it into an image Blob, and skips the camera directly to Step 3.
   - **Live Webcam / Upload:** Web camera stream with full-body silhouette framing guide (*"Stand straight • Full body visible • Good light"*) and a 768×1024 portrait capture button, plus a file upload fallback.

3. **Screen 3 — Fit Profile & Height:**
   - Side-by-side preview of selected model/photo alongside the chosen saree.
   - Height dial in cm (default 170 cm / 5'7") with `+` / `-` buttons and quick presets.
   - Big CTA button: **"✨ Generate AI Try-On ➔"**.

4. **Screen 4 — Result & Quick Try Strip:**
   - Loading animation (30–60s) with live elapsed timer and rotating AI status steps.
   - Full-size photorealistic draped saree result.
   - Clean **"📥 Download Photo"** button.
   - **"Try Another Saree on Same Model" strip:** Bottom horizontal scroll row of all 12 sarees. Clicking any saree immediately re-runs the try-on with the same person model without having to start over!
