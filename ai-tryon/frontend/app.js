/**
 * VirtualFit AI Studio — Saree Boutique Trial Kiosk
 * Standalone Vanilla JS + Tailwind Kiosk
 */

// API Base URL Detection
const API_BASE = window.location.port === "8000" ? "" : "http://localhost:8000";

// ==========================================
// 1. DEMO MODELS DATA (4 Items)
// ==========================================
const DEMO_MODELS = [
  { id: 1, name: "Demo Model 1 - Aisha", img: "../assets/models/model-1.jpg" },
  { id: 2, name: "Demo Model 2 - Priya", img: "../assets/models/model-2.jpg" },
  { id: 3, name: "Demo Model 3 - Kavya", img: "../assets/models/model-3.jpg" },
  { id: 4, name: "Demo Model 4 - Meera", img: "../assets/models/model-4.jpg" }
];

// ==========================================
// 2. SAREES CATALOG DATA (12 Items)
// ==========================================
const SAREES = [
  {
    id: 1,
    name: "Royal Sapphire Blue Banarasi Silk Saree",
    price: "INR 2499",
    img: "../assets/clothes/saree-01-blue-banarasi.jpg",
    category: "dresses",
    garment_desc: "a royal sapphire blue banarasi silk saree with silver brocade work and silver border, traditional indian draping with pleats"
  },
  {
    id: 2,
    name: "Crimson Red Banarasi Silk Saree",
    price: "INR 2799",
    img: "../assets/clothes/saree-02-red-banarasi.jpg",
    category: "dresses",
    garment_desc: "a crimson red banarasi silk saree with golden zari border, traditional indian draping"
  },
  {
    id: 3,
    name: "Emerald Green Kanjivaram Silk Saree",
    price: "INR 3299",
    img: "../assets/clothes/saree-03-green-kanjivaram.jpg",
    category: "dresses",
    garment_desc: "an emerald green kanjivaram silk saree with golden border, traditional south indian draping"
  },
  {
    id: 4,
    name: "Pink Art Silk Saree with Teal Border",
    price: "INR 1599",
    img: "../assets/clothes/saree-04-pink-art-silk.jpg",
    category: "dresses",
    garment_desc: "a women pink art silk saree with teal blue border, traditional draping"
  },
  {
    id: 5,
    name: "Golden Yellow Chanderi Saree",
    price: "INR 1899",
    img: "../assets/clothes/saree-05-yellow-chanderi.jpg",
    category: "dresses",
    garment_desc: "a golden yellow chanderi embroidered saree, traditional indian draping"
  },
  {
    id: 6,
    name: "Black Kota Cotton Saree",
    price: "INR 1399",
    img: "../assets/clothes/saree-06-black-kota.jpg",
    category: "dresses",
    garment_desc: "a women black kota cotton saree with silver motifs and green blouse, traditional draping"
  },
  {
    id: 7,
    name: "Grey with Pink Art Silk Saree",
    price: "INR 1499",
    img: "../assets/clothes/saree-07-grey-pink.jpg",
    category: "dresses",
    garment_desc: "a women grey saree with pink art silk border, traditional draping"
  },
  {
    id: 8,
    name: "Peach Floral Cotton Saree",
    price: "INR 1199",
    img: "../assets/clothes/saree-08-peach-floral.jpg",
    category: "dresses",
    garment_desc: "a peach floral cotton saree for women, traditional draping"
  },
  {
    id: 9,
    name: "Maroon Silk Saree with Gold Border",
    price: "INR 2699",
    img: "../assets/clothes/saree-09-maroon-silk.jpg",
    category: "dresses",
    garment_desc: "a maroon silk saree with heavy gold border, traditional indian draping"
  },
  {
    id: 10,
    name: "Turquoise Blue Silk Saree",
    price: "INR 2299",
    img: "../assets/clothes/saree-10-turquoise-silk.jpg",
    category: "dresses",
    garment_desc: "a turquoise blue silk saree with silver border, traditional draping"
  },
  {
    id: 11,
    name: "Orange Banarasi Saree",
    price: "INR 2599",
    img: "../assets/clothes/saree-11-orange-banarasi.jpg",
    category: "dresses",
    garment_desc: "an orange banarasi silk saree with gold zari work, traditional draping"
  },
  {
    id: 12,
    name: "Light Blue Art Silk Saree",
    price: "INR 1699",
    img: "../assets/clothes/saree-12-light-blue.jpg",
    category: "dresses",
    garment_desc: "a light blue art silk saree with pink border, traditional draping"
  }
];

// App State
const state = {
  currentStep: 1,
  selectedSareeIndex: 0,
  selectedSaree: SAREES[0],
  selectedDemoModelId: null,
  personBlob: null,
  personDataUrl: null,
  personLabel: "Customer Photo",
  heightCm: 170,
  webcamStream: null,
  facingMode: "user",
  isGenerating: false,
  timerInterval: null
};

// SVG Placeholder generator if image file is missing
function getSareePlaceholderSvg(name, index) {
  const gradients = [
    ["#1e3a8a", "#3b82f6"],
    ["#991b1b", "#ef4444"],
    ["#065f46", "#10b981"],
    ["#831843", "#ec4899"],
    ["#854d0e", "#eab308"],
    ["#18181b", "#52525b"],
    ["#374151", "#f43f5e"],
    ["#c2410c", "#fb923c"],
    ["#701a75", "#d946ef"],
    ["#155e75", "#06b6d4"],
    ["#ea580c", "#fde047"],
    ["#0284c7", "#f472b6"]
  ];
  const [c1, c2] = gradients[index % gradients.length];
  const safeName = name.replace(/[<>&"]/g, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800">
    <defs>
      <linearGradient id="g${index}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${c1}"/>
        <stop offset="100%" stop-color="${c2}"/>
      </linearGradient>
    </defs>
    <rect width="600" height="800" fill="url(#g${index})"/>
    <rect y="710" width="600" height="90" fill="#fbbf24" opacity="0.85"/>
    <text x="50%" y="45%" text-anchor="middle" fill="#ffffff" font-family="Georgia, serif" font-size="28" font-weight="bold">${safeName}</text>
    <text x="50%" y="52%" text-anchor="middle" fill="#fef08a" font-family="sans-serif" font-size="18" font-weight="600">Pure Handloom Silk</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// Model fallback placeholder
function getModelPlaceholderSvg(name, index) {
  const colors = ["#b45309", "#4338ca", "#047857", "#be185d"];
  const color = colors[index % colors.length];
  const safeName = name.replace(/[<>&"]/g, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800">
    <rect width="600" height="800" fill="#f3f4f6"/>
    <circle cx="300" cy="300" r="140" fill="${color}" opacity="0.2"/>
    <circle cx="300" cy="270" r="80" fill="${color}" opacity="0.5"/>
    <path d="M180,480 Q300,380 420,480 L420,800 L180,800 Z" fill="${color}" opacity="0.4"/>
    <text x="50%" y="650" text-anchor="middle" fill="#1f2937" font-family="sans-serif" font-size="28" font-weight="bold">${safeName}</text>
    <text x="50%" y="700" text-anchor="middle" fill="#6b7280" font-family="sans-serif" font-size="18">Demo Fashion Model</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// DOM Elements
const elements = {
  // Navigation
  stepNavButtons: [
    document.getElementById("step-nav-1"),
    document.getElementById("step-nav-2"),
    document.getElementById("step-nav-3"),
    document.getElementById("step-nav-4")
  ],
  screens: {
    1: document.getElementById("screen-catalog"),
    2: document.getElementById("screen-capture"),
    3: document.getElementById("screen-profile"),
    4: document.getElementById("screen-result")
  },
  backendStatusDot: document.getElementById("backend-status-dot"),
  backendStatusText: document.getElementById("backend-status-text"),

  // Screen 1: Catalog
  sareeGrid: document.getElementById("saree-grid"),
  catalogActionBar: document.getElementById("catalog-action-bar"),
  selectedSareeThumb: document.getElementById("selected-saree-thumb"),
  selectedSareeName: document.getElementById("selected-saree-name"),
  selectedSareePrice: document.getElementById("selected-saree-price"),
  btnCatalogContinue: document.getElementById("btn-catalog-continue"),

  // Screen 2: Capture & Demo Models
  demoModelsRow: document.getElementById("demo-models-row"),
  webcamVideo: document.getElementById("webcam-video"),
  captureCanvas: document.getElementById("capture-canvas"),
  capturePreviewImg: document.getElementById("capture-preview-img"),
  cameraOverlay: document.getElementById("camera-overlay"),
  cameraLiveControls: document.getElementById("camera-live-controls"),
  cameraReviewControls: document.getElementById("camera-review-controls"),
  btnSnapPhoto: document.getElementById("btn-snap-photo"),
  btnSwitchCamera: document.getElementById("btn-switch-camera"),
  fileUploadInput: document.getElementById("file-upload-input"),
  btnRetakePhoto: document.getElementById("btn-retake-photo"),
  btnAcceptPhoto: document.getElementById("btn-accept-photo"),
  btnBackToCatalog: document.getElementById("btn-back-to-catalog"),

  // Screen 3: Profile
  profilePersonThumb: document.getElementById("profile-person-thumb"),
  profilePersonLabel: document.getElementById("profile-person-label"),
  btnChangePersonMini: document.getElementById("btn-change-person-mini"),
  profileGarmentThumb: document.getElementById("profile-garment-thumb"),
  profileGarmentName: document.getElementById("profile-garment-name"),
  profileGarmentPrice: document.getElementById("profile-garment-price"),
  heightInput: document.getElementById("height-input"),
  heightFeetDisplay: document.getElementById("height-feet-display"),
  btnHeightMinus: document.getElementById("btn-height-minus"),
  btnHeightPlus: document.getElementById("btn-height-plus"),
  btnHeightPresets: document.querySelectorAll(".btn-height-preset"),
  profileDescPreview: document.getElementById("profile-desc-preview"),
  btnGenerateTryon: document.getElementById("btn-generate-tryon"),
  btnBackToCapture: document.getElementById("btn-back-to-capture"),

  // Screen 4: Result
  resultLoadingState: document.getElementById("result-loading-state"),
  resultSuccessState: document.getElementById("result-success-state"),
  resultErrorState: document.getElementById("result-error-state"),
  loadingTimer: document.getElementById("loading-timer"),
  loadingStepMsg: document.getElementById("loading-step-msg"),
  resultOutfitTitle: document.getElementById("result-outfit-title"),
  resultMainImage: document.getElementById("result-main-image"),
  btnDownloadResult: document.getElementById("btn-download-result"),
  resultGarmentThumb: document.getElementById("result-garment-thumb"),
  resultGarmentNameSide: document.getElementById("result-garment-name-side"),
  resultGarmentPriceSide: document.getElementById("result-garment-price-side"),
  resultGarmentDescSide: document.getElementById("result-garment-desc-side"),
  resultModelDisplay: document.getElementById("result-model-display"),
  resultHeightDisplay: document.getElementById("result-height-display"),
  quickTryStrip: document.getElementById("quick-try-strip"),
  btnBackToCatalogFromResult: document.getElementById("btn-back-to-catalog-from-result"),
  btnChangeModelFromResult: document.getElementById("btn-change-model-from-result"),
  errorMessageText: document.getElementById("error-message-text"),
  btnRetryTryon: document.getElementById("btn-retry-tryon"),
  btnBackFromError: document.getElementById("btn-back-from-error")
};

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  renderSareesCatalog();
  renderDemoModels();
  selectSaree(0);
  bindEvents();
  checkBackendHealth();
});

// ==========================================
// 1. RENDER 12 SAREES CATALOG
// ==========================================
function renderSareesCatalog() {
  elements.sareeGrid.innerHTML = "";

  SAREES.forEach((saree, index) => {
    const card = document.createElement("div");
    card.className = `boutique-card rounded-2xl overflow-hidden cursor-pointer relative group border-2 ${
      index === state.selectedSareeIndex ? "boutique-card-selected" : "border-transparent"
    }`;
    card.dataset.index = index;

    card.innerHTML = `
      <div class="aspect-[3/4] bg-amber-50 relative overflow-hidden">
        <img src="${saree.img}" alt="${saree.name}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" onerror="this.src='${getSareePlaceholderSvg(saree.name, index)}'">
        <span class="absolute top-2 left-2 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-white/90 text-amber-800 shadow-sm backdrop-blur-sm">
          ${saree.price}
        </span>
        ${
          index === state.selectedSareeIndex
            ? `<div class="selection-check absolute top-2 right-2 w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-sm shadow-md">✓</div>`
            : ""
        }
      </div>
      <div class="p-3 bg-white">
        <h3 class="font-bold text-gray-900 text-xs sm:text-sm line-clamp-2 leading-tight">${saree.name}</h3>
        <p class="text-xs text-amber-700 font-bold mt-1">${saree.price}</p>
      </div>
    `;

    card.addEventListener("click", () => {
      selectSaree(index);
      // Automatically advance to Screen 2 on saree select
      goToStep(2);
    });

    elements.sareeGrid.appendChild(card);
  });
}

function selectSaree(index) {
  state.selectedSareeIndex = index;
  state.selectedSaree = SAREES[index];

  // Highlight selected card
  document.querySelectorAll("#saree-grid > div").forEach((card, i) => {
    if (i === index) {
      card.classList.add("boutique-card-selected");
      if (!card.querySelector(".selection-check")) {
        const check = document.createElement("div");
        check.className = "selection-check absolute top-2 right-2 w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-sm shadow-md";
        check.innerHTML = "✓";
        card.querySelector(".aspect-\\[3\\/4\\]").appendChild(check);
      }
    } else {
      card.classList.remove("boutique-card-selected");
      const check = card.querySelector(".selection-check");
      if (check) check.remove();
    }
  });

  // Update Bottom Action Bar
  elements.selectedSareeThumb.src = state.selectedSaree.img;
  elements.selectedSareeThumb.onerror = () => {
    elements.selectedSareeThumb.src = getSareePlaceholderSvg(state.selectedSaree.name, index);
  };
  elements.selectedSareeName.textContent = state.selectedSaree.name;
  elements.selectedSareePrice.textContent = state.selectedSaree.price;
  elements.catalogActionBar.classList.remove("hidden");

  // Update Profile screen saree card
  elements.profileGarmentThumb.src = state.selectedSaree.img;
  elements.profileGarmentThumb.onerror = () => {
    elements.profileGarmentThumb.src = getSareePlaceholderSvg(state.selectedSaree.name, index);
  };
  elements.profileGarmentName.textContent = state.selectedSaree.name;
  elements.profileGarmentPrice.textContent = state.selectedSaree.price;
  elements.profileDescPreview.textContent = `Target prompt: "${state.selectedSaree.garment_desc}"`;
}

// ==========================================
// 2. RENDER 4 DEMO MODELS
// ==========================================
function renderDemoModels() {
  elements.demoModelsRow.innerHTML = "";

  DEMO_MODELS.forEach((model, index) => {
    const card = document.createElement("div");
    card.className = `boutique-card rounded-2xl p-2 cursor-pointer transition-all duration-200 transform hover:-translate-y-1 text-center relative border-2 ${
      state.selectedDemoModelId === model.id ? "boutique-card-selected" : "border-gray-200"
    }`;
    card.dataset.id = model.id;

    card.innerHTML = `
      <div class="aspect-[3/4] rounded-xl overflow-hidden bg-gray-100 mb-2 relative">
        <img src="${model.img}" alt="${model.name}" class="w-full h-full object-cover" onerror="this.src='${getModelPlaceholderSvg(model.name, index)}'">
        ${
          state.selectedDemoModelId === model.id
            ? `<div class="model-check absolute top-1 right-1 w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-xs shadow-md">✓</div>`
            : ""
        }
      </div>
      <h4 class="font-bold text-gray-800 text-xs truncate">${model.name.replace("Demo Model ", "")}</h4>
      <span class="text-[10px] text-amber-700 font-semibold block mt-0.5">Demo Model</span>
    `;

    card.addEventListener("click", () => {
      selectDemoModel(model);
    });

    elements.demoModelsRow.appendChild(card);
  });
}

async function selectDemoModel(model) {
  state.selectedDemoModelId = model.id;
  state.personLabel = model.name;

  // Highlight selected model card
  document.querySelectorAll("#demo-models-row > div").forEach((card) => {
    if (parseInt(card.dataset.id) === model.id) {
      card.classList.add("boutique-card-selected");
      if (!card.querySelector(".model-check")) {
        const check = document.createElement("div");
        check.className = "model-check absolute top-1 right-1 w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-xs shadow-md";
        check.innerHTML = "✓";
        card.querySelector(".aspect-\\[3\\/4\\]").appendChild(check);
      }
    } else {
      card.classList.remove("boutique-card-selected");
      const check = card.querySelector(".model-check");
      if (check) check.remove();
    }
  });

  // Stop camera when using demo model
  stopCamera();

  try {
    // Fetch image file and convert to Blob exactly like captured photo
    const response = await fetch(model.img);
    if (!response.ok) throw new Error("Could not load model image");
    const blob = await response.blob();
    state.personBlob = blob;
    state.personDataUrl = model.img;

    // Show preview in camera box and enable continue
    elements.capturePreviewImg.src = model.img;
    elements.capturePreviewImg.classList.remove("hidden");
    elements.webcamVideo.classList.add("hidden");
    elements.cameraOverlay.classList.add("hidden");
    elements.cameraLiveControls.classList.add("hidden");
    elements.cameraReviewControls.classList.remove("hidden");

    // Automatically navigate to Screen 3 (Fit Profile)
    goToStep(3);
  } catch (e) {
    console.warn("Could not fetch model image directly, generating fallback blob:", e);
    // Draw placeholder on canvas and export as blob
    const canvas = elements.captureCanvas;
    const ctx = canvas.getContext("2d");
    canvas.width = 768;
    canvas.height = 1024;
    ctx.fillStyle = "#fef3c7";
    ctx.fillRect(0, 0, 768, 1024);
    ctx.fillStyle = "#b45309";
    ctx.font = "bold 36px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(model.name, 384, 512);

    canvas.toBlob((b) => {
      state.personBlob = b;
      state.personDataUrl = canvas.toDataURL("image/jpeg");
      elements.capturePreviewImg.src = state.personDataUrl;
      elements.capturePreviewImg.classList.remove("hidden");
      elements.webcamVideo.classList.add("hidden");
      elements.cameraOverlay.classList.add("hidden");
      elements.cameraLiveControls.classList.add("hidden");
      elements.cameraReviewControls.classList.remove("hidden");
      goToStep(3);
    }, "image/jpeg", 0.95);
  }
}

// ==========================================
// NAVIGATION & STEP MACHINE
// ==========================================
function goToStep(step) {
  if (step < 1 || step > 4) return;
  if (step === 2 && !state.selectedSaree) return;
  if (step >= 3 && !state.personBlob) {
    goToStep(2);
    return;
  }

  // Camera stream lifecycle
  if (state.currentStep === 2 && step !== 2) {
    stopCamera();
  }

  state.currentStep = step;

  // Toggle active screen
  Object.keys(elements.screens).forEach((s) => {
    const screenEl = elements.screens[s];
    if (parseInt(s) === step) {
      screenEl.classList.remove("hidden");
    } else {
      screenEl.classList.add("hidden");
    }
  });

  // Update Stepper Navigation buttons
  elements.stepNavButtons.forEach((btn, idx) => {
    const btnStep = idx + 1;
    if (btnStep === step) {
      btn.className = "step-nav-btn flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500 text-white shadow-sm transition-all";
      btn.querySelector("span:first-child").className = "w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px]";
    } else if (btnStep < step) {
      btn.className = "step-nav-btn flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 transition-all";
      btn.querySelector("span:first-child").className = "w-5 h-5 rounded-full bg-amber-200 text-amber-900 flex items-center justify-center text-[10px]";
    } else {
      btn.className = "step-nav-btn flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gray-100 text-gray-500 transition-all";
      btn.querySelector("span:first-child").className = "w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-[10px]";
    }
  });

  // Screen specific hooks
  if (step === 2) {
    if (!state.personBlob) {
      resetCameraView();
      startCamera();
    }
  } else if (step === 3) {
    updateProfileThumbnails();
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ==========================================
// SCREEN 2: WEBCAM & PHOTO CAPTURE
// ==========================================
async function startCamera() {
  stopCamera();
  try {
    const constraints = {
      video: {
        facingMode: state.facingMode,
        width: { ideal: 1080 },
        height: { ideal: 1440 }
      },
      audio: false
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    state.webcamStream = stream;
    elements.webcamVideo.srcObject = stream;
    await elements.webcamVideo.play();
  } catch (err) {
    console.warn("Could not start camera with ideal constraints, trying basic video:", err);
    try {
      const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      state.webcamStream = fallbackStream;
      elements.webcamVideo.srcObject = fallbackStream;
      await elements.webcamVideo.play();
    } catch (fbErr) {
      console.error("Camera access not available:", fbErr);
    }
  }
}

function stopCamera() {
  if (state.webcamStream) {
    state.webcamStream.getTracks().forEach((track) => track.stop());
    state.webcamStream = null;
  }
}

function resetCameraView() {
  elements.webcamVideo.classList.remove("hidden");
  elements.cameraOverlay.classList.remove("hidden");
  elements.capturePreviewImg.classList.add("hidden");
  elements.captureCanvas.classList.add("hidden");
  elements.cameraLiveControls.classList.remove("hidden");
  elements.cameraReviewControls.classList.add("hidden");
}

function snapPhoto() {
  const video = elements.webcamVideo;
  const canvas = elements.captureCanvas;
  const ctx = canvas.getContext("2d");

  // Exact 768x1024 kiosk portrait canvas
  canvas.width = 768;
  canvas.height = 1024;

  if (video.videoWidth > 0 && video.videoHeight > 0) {
    const videoAspect = video.videoWidth / video.videoHeight;
    const targetAspect = 768 / 1024;
    let sx = 0, sy = 0, sWidth = video.videoWidth, sHeight = video.videoHeight;

    if (videoAspect > targetAspect) {
      sWidth = video.videoHeight * targetAspect;
      sx = (video.videoWidth - sWidth) / 2;
    } else {
      sHeight = video.videoWidth / targetAspect;
      sy = (video.videoHeight - sHeight) / 2;
    }

    ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, 768, 1024);
  } else {
    ctx.fillStyle = "#e5e7eb";
    ctx.fillRect(0, 0, 768, 1024);
  }

  const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
  state.personDataUrl = dataUrl;
  state.personLabel = "Captured Live Photo";
  state.selectedDemoModelId = null;

  // Uncheck demo model cards
  document.querySelectorAll("#demo-models-row > div").forEach((c) => {
    c.classList.remove("boutique-card-selected");
    const check = c.querySelector(".model-check");
    if (check) check.remove();
  });

  canvas.toBlob((blob) => {
    state.personBlob = blob;
  }, "image/jpeg", 0.95);

  elements.capturePreviewImg.src = dataUrl;
  elements.capturePreviewImg.classList.remove("hidden");
  elements.webcamVideo.classList.add("hidden");
  elements.cameraOverlay.classList.add("hidden");
  elements.cameraLiveControls.classList.add("hidden");
  elements.cameraReviewControls.classList.remove("hidden");
  stopCamera();
}

function handleFileUpload(file) {
  if (!file || !file.type.startsWith("image/")) {
    alert("Please upload a valid image file.");
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = elements.captureCanvas;
      const ctx = canvas.getContext("2d");
      canvas.width = 768;
      canvas.height = 1024;

      const imgAspect = img.width / img.height;
      const targetAspect = 768 / 1024;
      let sx = 0, sy = 0, sWidth = img.width, sHeight = img.height;

      if (imgAspect > targetAspect) {
        sWidth = img.height * targetAspect;
        sx = (img.width - sWidth) / 2;
      } else {
        sHeight = img.width / targetAspect;
        sy = (img.height - sHeight) / 2;
      }

      ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, 768, 1024);

      const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
      state.personDataUrl = dataUrl;
      state.personLabel = "Uploaded Customer Photo";
      state.selectedDemoModelId = null;

      document.querySelectorAll("#demo-models-row > div").forEach((c) => {
        c.classList.remove("boutique-card-selected");
        const check = c.querySelector(".model-check");
        if (check) check.remove();
      });

      canvas.toBlob((blob) => {
        state.personBlob = blob;
      }, "image/jpeg", 0.95);

      elements.capturePreviewImg.src = dataUrl;
      elements.capturePreviewImg.classList.remove("hidden");
      elements.webcamVideo.classList.add("hidden");
      elements.cameraOverlay.classList.add("hidden");
      elements.cameraLiveControls.classList.add("hidden");
      elements.cameraReviewControls.classList.remove("hidden");
      stopCamera();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// ==========================================
// SCREEN 3: PROFILE & HEIGHT HELPERS
// ==========================================
function updateProfileThumbnails() {
  if (state.personDataUrl) {
    elements.profilePersonThumb.src = state.personDataUrl;
    elements.profilePersonLabel.textContent = state.personLabel;
  }
  if (state.selectedSaree) {
    elements.profileGarmentThumb.src = state.selectedSaree.img;
    elements.profileGarmentThumb.onerror = () => {
      elements.profileGarmentThumb.src = getSareePlaceholderSvg(state.selectedSaree.name, state.selectedSareeIndex);
    };
    elements.profileGarmentName.textContent = state.selectedSaree.name;
    elements.profileGarmentPrice.textContent = state.selectedSaree.price;
    elements.profileDescPreview.textContent = `Target prompt: "${state.selectedSaree.garment_desc}"`;
  }
}

function updateHeight(newCm) {
  const cm = Math.max(130, Math.min(220, newCm));
  state.heightCm = cm;
  elements.heightInput.value = cm;

  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  elements.heightFeetDisplay.textContent = `${feet} ft ${inches} in`;

  elements.btnHeightPresets.forEach((btn) => {
    if (parseInt(btn.dataset.height) === cm) {
      btn.className = "btn-height-preset text-xs px-3 py-1 bg-amber-50 rounded-lg border border-amber-500 font-bold text-amber-800";
    } else {
      btn.className = "btn-height-preset text-xs px-3 py-1 bg-white rounded-lg border border-gray-200 text-gray-600 hover:border-amber-400";
    }
  });
}

// ==========================================
// SCREEN 4: GENERATE TRY-ON (API CALL)
// ==========================================
async function generateTryOn() {
  if (!state.personBlob) {
    alert("Please select a demo model or take a photo first.");
    goToStep(2);
    return;
  }

  goToStep(4);

  // Show loading state
  elements.resultLoadingState.classList.remove("hidden");
  elements.resultSuccessState.classList.add("hidden");
  elements.resultErrorState.classList.add("hidden");

  state.isGenerating = true;

  // Start timer & rotating status messages
  let elapsed = 0;
  elements.loadingTimer.textContent = "0s";
  if (state.timerInterval) clearInterval(state.timerInterval);

  const loadingMessages = [
    "Analyzing posture & anatomical landmarks...",
    "Segmenting clothing in model photo...",
    "Extracting high-res saree zari borders & pallu...",
    "Synthesizing photorealistic drape & pleats...",
    "Harmonizing studio lighting and shadows...",
    "Finalizing neural saree render with IDM-VTON..."
  ];
  let msgIdx = 0;
  elements.loadingStepMsg.textContent = loadingMessages[0];

  state.timerInterval = setInterval(() => {
    elapsed += 1;
    elements.loadingTimer.textContent = `${elapsed}s`;
    if (elapsed % 7 === 0) {
      msgIdx = (msgIdx + 1) % loadingMessages.length;
      elements.loadingStepMsg.textContent = loadingMessages[msgIdx];
    }
  }, 1000);

  try {
    // 1. Fetch the selected saree image file as a Blob
    let garmentBlob;
    try {
      const garmentResp = await fetch(state.selectedSaree.img);
      if (!garmentResp.ok) throw new Error("Local file fetch returned status " + garmentResp.status);
      garmentBlob = await garmentResp.blob();
    } catch (gFetchErr) {
      console.warn("Could not fetch saree image file directly, generating image blob from canvas:", gFetchErr);
      // Fallback: draw placeholder on canvas to create valid image blob
      const gCanvas = document.createElement("canvas");
      gCanvas.width = 768;
      gCanvas.height = 1024;
      const gCtx = gCanvas.getContext("2d");
      gCtx.fillStyle = "#991b1b";
      gCtx.fillRect(0, 0, 768, 1024);
      gCtx.fillStyle = "#fef08a";
      gCtx.font = "bold 32px serif";
      gCtx.textAlign = "center";
      gCtx.fillText(state.selectedSaree.name, 384, 512);
      garmentBlob = await new Promise((res) => gCanvas.toBlob(res, "image/jpeg", 0.95));
    }

    // 2. Prepare FormData exactly for /tryon endpoint
    const formData = new FormData();
    formData.append("person", state.personBlob, "person.jpg");
    formData.append("garment", garmentBlob, "garment.jpg");
    formData.append("category", "dresses");
    formData.append("garment_desc", state.selectedSaree.garment_desc);

    console.log(`Submitting /tryon for saree: ${state.selectedSaree.name}`);

    // 3. POST to FastAPI backend
    const response = await fetch(`${API_BASE}/tryon`, {
      method: "POST",
      body: formData
    });

    const data = await response.json();
    console.log("Try-on response:", data);

    clearInterval(state.timerInterval);
    state.isGenerating = false;

    if (data.success && data.result_url) {
      showResultSuccess(data.result_url);
    } else {
      throw new Error(data.error || "Generation returned failure status without result.");
    }
  } catch (err) {
    clearInterval(state.timerInterval);
    state.isGenerating = false;
    console.error("Try-on generation error:", err);
    showResultError(err.message || String(err));
  }
}

function showResultSuccess(resultUrl) {
  elements.resultLoadingState.classList.add("hidden");
  elements.resultErrorState.classList.add("hidden");
  elements.resultSuccessState.classList.remove("hidden");

  const fullUrl = resultUrl.startsWith("http") ? resultUrl : `${API_BASE}${resultUrl}`;
  elements.resultMainImage.src = fullUrl;
  elements.btnDownloadResult.href = fullUrl;

  const saree = state.selectedSaree;
  elements.resultOutfitTitle.textContent = saree.name;
  elements.resultGarmentThumb.src = saree.img;
  elements.resultGarmentThumb.onerror = () => {
    elements.resultGarmentThumb.src = getSareePlaceholderSvg(saree.name, state.selectedSareeIndex);
  };
  elements.resultGarmentNameSide.textContent = saree.name;
  elements.resultGarmentPriceSide.textContent = saree.price;
  elements.resultGarmentDescSide.textContent = saree.garment_desc;
  elements.resultModelDisplay.textContent = state.personLabel;
  elements.resultHeightDisplay.textContent = `${state.heightCm} cm`;

  // Render bottom quick try-on strip of all 12 sarees
  renderQuickTryStrip();
}

function renderQuickTryStrip() {
  elements.quickTryStrip.innerHTML = "";

  SAREES.forEach((saree, index) => {
    const item = document.createElement("div");
    const isCurrent = index === state.selectedSareeIndex;
    item.className = `flex-shrink-0 w-28 bg-white rounded-xl p-1.5 border-2 cursor-pointer transition-all hover:scale-105 ${
      isCurrent ? "border-amber-500 shadow-md ring-2 ring-amber-300" : "border-gray-200"
    }`;
    item.innerHTML = `
      <div class="aspect-[3/4] rounded-lg overflow-hidden bg-amber-50 mb-1 relative">
        <img src="${saree.img}" alt="${saree.name}" class="w-full h-full object-cover" onerror="this.src='${getSareePlaceholderSvg(saree.name, index)}'">
        ${isCurrent ? `<span class="absolute top-1 right-1 text-[9px] bg-amber-500 text-white font-bold px-1 rounded">Active</span>` : ""}
      </div>
      <p class="text-[10px] font-bold text-gray-800 truncate">${saree.name}</p>
      <p class="text-[9px] text-amber-700 font-bold">${saree.price}</p>
    `;

    item.addEventListener("click", () => {
      selectSaree(index);
      // Instantly re-run try-on with the same person model
      generateTryOn();
    });

    elements.quickTryStrip.appendChild(item);
  });
}

function showResultError(errMsg) {
  elements.resultLoadingState.classList.add("hidden");
  elements.resultSuccessState.classList.add("hidden");
  elements.resultErrorState.classList.remove("hidden");
  elements.errorMessageText.textContent = errMsg;
}

// ==========================================
// BACKEND STATUS CHECK
// ==========================================
async function checkBackendHealth() {
  try {
    const res = await fetch(`${API_BASE}/`, { method: "GET" });
    if (res.ok) {
      const data = await res.json();
      elements.backendStatusDot.className = "w-2.5 h-2.5 rounded-full bg-emerald-500";
      elements.backendStatusText.textContent = data.message || "AI Server Connected";
      elements.backendStatusText.className = "text-xs font-semibold text-emerald-700";
    } else {
      throw new Error("Status " + res.status);
    }
  } catch (e) {
    elements.backendStatusDot.className = "w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse";
    elements.backendStatusText.textContent = "AI Server Offline (port 8000)";
    elements.backendStatusText.className = "text-xs font-medium text-amber-700";
  }
}

// ==========================================
// EVENT BINDINGS
// ==========================================
function bindEvents() {
  // Stepper Header Buttons
  elements.stepNavButtons.forEach((btn, idx) => {
    btn.addEventListener("click", () => goToStep(idx + 1));
  });

  // Screen 1: Catalog
  elements.btnCatalogContinue.addEventListener("click", () => goToStep(2));

  // Screen 2: Capture
  elements.btnSnapPhoto.addEventListener("click", snapPhoto);

  elements.btnSwitchCamera.addEventListener("click", () => {
    state.facingMode = state.facingMode === "user" ? "environment" : "user";
    startCamera();
  });

  elements.fileUploadInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  });

  elements.btnRetakePhoto.addEventListener("click", () => {
    resetCameraView();
    startCamera();
  });

  elements.btnAcceptPhoto.addEventListener("click", () => goToStep(3));
  elements.btnBackToCatalog.addEventListener("click", () => goToStep(1));

  // Screen 3: Profile
  elements.btnHeightMinus.addEventListener("click", () => updateHeight(state.heightCm - 2));
  elements.btnHeightPlus.addEventListener("click", () => updateHeight(state.heightCm + 2));

  elements.heightInput.addEventListener("change", (e) => {
    updateHeight(parseInt(e.target.value) || 170);
  });

  elements.btnHeightPresets.forEach((btn) => {
    btn.addEventListener("click", () => {
      updateHeight(parseInt(btn.dataset.height));
    });
  });

  elements.btnChangePersonMini.addEventListener("click", () => goToStep(2));
  elements.btnBackToCapture.addEventListener("click", () => goToStep(2));
  elements.btnGenerateTryon.addEventListener("click", generateTryOn);

  // Screen 4: Result Actions
  elements.btnBackToCatalogFromResult.addEventListener("click", () => goToStep(1));
  elements.btnChangeModelFromResult.addEventListener("click", () => goToStep(2));

  elements.btnRetryTryon.addEventListener("click", () => {
    generateTryOn();
  });

  elements.btnBackFromError.addEventListener("click", () => goToStep(3));
}
