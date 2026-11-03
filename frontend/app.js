/**
 * VirtualFit AI Studio - Universal App Controller
 * Universal 3-Stage Pipeline: Analyzer -> Standardizer -> Universal Try-On
 */

const API_BASE = window.location.port === "8000" ? "" : "http://localhost:8000";

// App State
const state = {
  currentStep: 1,
  selectedGarment: null,
  uploadedGarmentData: null,
  selectedDemoModel: null,
  personBlob: null,
  personDataUrl: null,
  personLabel: "Customer",
  heightCm: 170,
  webcamStream: null,
  activeFilter: "all",
  timerInterval: null
};

// DOM References
const el = {
  // Navigation
  stepIndicators: [
    document.getElementById("stepIndicator1"),
    document.getElementById("stepIndicator2"),
    document.getElementById("stepIndicator3"),
    document.getElementById("stepIndicator4")
  ],
  screens: {
    1: document.getElementById("screen1"),
    2: document.getElementById("screen2"),
    3: document.getElementById("screen3"),
    4: document.getElementById("screen4")
  },
  backendStatusPill: document.getElementById("backendStatusPill"),

  // Screen 1: Uploader & Catalog
  customGarmentInput: document.getElementById("customGarmentInput"),
  detectedGarmentCard: document.getElementById("detectedGarmentCard"),
  detectedGarmentThumb: document.getElementById("detectedGarmentThumb"),
  badgeGarmentType: document.getElementById("badgeGarmentType"),
  badgeCategory: document.getElementById("badgeCategory"),
  badgeGender: document.getElementById("badgeGender"),
  detectedGarmentName: document.getElementById("detectedGarmentName"),
  detectedWearingRule: document.getElementById("detectedWearingRule"),
  btnTryDetectedGarment: document.getElementById("btnTryDetectedGarment"),
  filterTabs: document.querySelectorAll(".filter-tab"),
  universalGarmentGrid: document.getElementById("universalGarmentGrid"),

  // Screen 2: Demo Models & Webcam
  demoModelsGrid: document.getElementById("demoModelsGrid"),
  webcamVideo: document.getElementById("webcamVideo"),
  cameraGuideOverlay: document.getElementById("cameraGuideOverlay"),
  cameraCanvas: document.getElementById("cameraCanvas"),
  cameraPreviewImg: document.getElementById("cameraPreviewImg"),
  cameraLiveControls: document.getElementById("cameraLiveControls"),
  cameraReviewControls: document.getElementById("cameraReviewControls"),
  btnStartCamera: document.getElementById("btnStartCamera"),
  btnSnapPhoto: document.getElementById("btnSnapPhoto"),
  btnRetakeCamera: document.getElementById("btnRetakeCamera"),
  btnAcceptCamera: document.getElementById("btnAcceptCamera"),
  btnBackToScreen1: document.getElementById("btnBackToScreen1"),

  // Screen 3: Review Fit Profile
  reviewPersonThumb: document.getElementById("reviewPersonThumb"),
  reviewPersonName: document.getElementById("reviewPersonName"),
  reviewGarmentThumb: document.getElementById("reviewGarmentThumb"),
  reviewGarmentName: document.getElementById("reviewGarmentName"),
  reviewGarmentBadge: document.getElementById("reviewGarmentBadge"),
  reviewWearingRule: document.getElementById("reviewWearingRule"),
  inputHeightCm: document.getElementById("inputHeightCm"),
  displayFeetInches: document.getElementById("displayFeetInches"),
  btnHeightMinus: document.getElementById("btnHeightMinus"),
  btnHeightPlus: document.getElementById("btnHeightPlus"),
  btnGenerateUniversalTryOn: document.getElementById("btnGenerateUniversalTryOn"),
  btnBackToScreen2: document.getElementById("btnBackToScreen2"),

  // Screen 4: Result & Before/After Slider
  resultLoadingBox: document.getElementById("resultLoadingBox"),
  resultErrorBox: document.getElementById("resultErrorBox"),
  resultErrorMessage: document.getElementById("resultErrorMessage"),
  btnRetryTryOn: document.getElementById("btnRetryTryOn"),
  loadingProgressBar: document.getElementById("loadingProgressBar"),
  resultSuccessBox: document.getElementById("resultSuccessBox"),
  loadingStepStatus: document.getElementById("loadingStepStatus"),
  loadingElapsedTimer: document.getElementById("loadingElapsedTimer"),
  resultGarmentTitle: document.getElementById("resultGarmentTitle"),
  btnDownloadResult: document.getElementById("btnDownloadResult"),
  resultImageAfter: document.getElementById("resultImageAfter"),
  resultImageBefore: document.getElementById("resultImageBefore"),
  beforeWrapper: document.getElementById("beforeWrapper"),
  compareDivider: document.getElementById("compareDivider"),
  compareSlider: document.getElementById("compareSlider"),
  resultGarmentThumbSide: document.getElementById("resultGarmentThumbSide"),
  resultGarmentNameSide: document.getElementById("resultGarmentNameSide"),
  resultGarmentPriceSide: document.getElementById("resultGarmentPriceSide"),
  resultTypeDisplay: document.getElementById("resultTypeDisplay"),
  resultCategoryDisplay: document.getElementById("resultCategoryDisplay"),
  resultDescSide: document.getElementById("resultDescSide"),
  universalQuickTryTrack: document.getElementById("universalQuickTryTrack"),
  btnBackToCatalogFromResult: document.getElementById("btnBackToCatalogFromResult"),
  btnNewCustomerSession: document.getElementById("btnNewCustomerSession")
};

// ========================================================
// INITIALIZATION
// ========================================================
document.addEventListener("DOMContentLoaded", () => {
  renderUniversalCatalog();
  renderDemoModels();
  if (window.UNIVERSAL_GARMENTS && window.UNIVERSAL_GARMENTS.length > 0) {
    selectGarment(window.UNIVERSAL_GARMENTS[0], false);
  }
  bindAppEvents();
  checkHealth();
});

// ========================================================
// SCREEN 1: CATALOG & STAGE 1/2 UPLOADER
// ========================================================
function renderUniversalCatalog() {
  if (!el.universalGarmentGrid || !window.UNIVERSAL_GARMENTS) return;
  el.universalGarmentGrid.innerHTML = "";

  const filtered = window.UNIVERSAL_GARMENTS.filter((g) => {
    if (state.activeFilter === "all") return true;
    if (state.activeFilter === "upper_body") return g.category === "upper_body";
    if (state.activeFilter === "full_body") return g.category === "full_body";
    if (state.activeFilter === "male") return g.gender === "male" || g.gender === "unisex";
    if (state.activeFilter === "female") return g.gender === "female" || g.gender === "unisex";
    return true;
  });

  filtered.forEach((garment) => {
    const card = document.createElement("div");
    card.className = "group bg-white rounded-2xl overflow-hidden border border-slate-200/80 hover:border-orange-500 hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between";
    
    card.innerHTML = `
      <div class="aspect-[3/4] bg-slate-100 overflow-hidden relative">
        <img src="${garment.img}" alt="${garment.name}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" onerror="this.src='https://placehold.co/600x800/f8fafc/ea580c?text=${encodeURIComponent(garment.type)}'">
        <span class="absolute top-2.5 left-2.5 text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/90 text-slate-800 shadow-sm">
          ${garment.badge || garment.type}
        </span>
        <span class="absolute top-2.5 right-2.5 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-orange-600 text-white shadow-sm">
          ${garment.price}
        </span>
      </div>
      <div class="p-3.5 flex flex-col justify-between flex-1">
        <div>
          <h3 class="font-bold text-xs sm:text-sm text-slate-900 line-clamp-2 leading-tight">${garment.name}</h3>
          <p class="text-[11px] text-slate-400 mt-1 capitalize">${garment.category.replace('_', ' ')} • ${garment.gender}</p>
        </div>
        <button class="mt-3 w-full py-2 bg-orange-50 group-hover:bg-orange-600 group-hover:text-white text-orange-700 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1">
          <span>Select & Try On</span>
          <span>➔</span>
        </button>
      </div>
    `;

    card.addEventListener("click", () => {
      selectGarment(garment, true);
    });

    el.universalGarmentGrid.appendChild(card);
  });
}

function selectGarment(garment, advanceToStep2 = true) {
  state.selectedGarment = garment;
  state.uploadedGarmentData = null;

  // Update Review Card in Step 3
  if (el.reviewGarmentThumb) el.reviewGarmentThumb.src = garment.img;
  if (el.reviewGarmentName) el.reviewGarmentName.textContent = garment.name;
  if (el.reviewGarmentBadge) el.reviewGarmentBadge.textContent = `${garment.type.toUpperCase()} • ${garment.category.toUpperCase()}`;
  if (el.reviewWearingRule) el.reviewWearingRule.textContent = garment.wearing_instructions || "Fit naturally to customer posture";

  if (advanceToStep2) {
    goToStep(2);
  }
}

// Stage 1 & 2: Handle Custom Upload of ANY dress
async function handleCustomGarmentUpload(file) {
  if (!file) return;

  // Show processing card
  el.detectedGarmentCard.classList.remove("hidden");
  el.detectedGarmentName.textContent = "Analyzing uploaded garment with AI...";
  el.detectedWearingRule.textContent = "Detecting category, gender, color, and wearing instructions...";

  const reader = new FileReader();
  reader.onload = (e) => {
    el.detectedGarmentThumb.src = e.target.result;
  };
  reader.readAsDataURL(file);

  try {
    const formData = new FormData();
    formData.append("garment", file);

    // Call Stage 1 Analyzer
    const res = await fetch(`${API_BASE}/api/analyze-garment`, {
      method: "POST",
      body: formData
    });
    const data = await res.json();
    console.log("Stage 1 Analysis Result:", data);

    if (data.success && data.garment_data) {
      const g = data.garment_data;
      state.uploadedGarmentData = g;

      // Update Detected Badges
      el.badgeGarmentType.textContent = g.garment_type.toUpperCase();
      el.badgeCategory.textContent = g.category.replace('_', ' ').toUpperCase();
      el.badgeGender.textContent = g.target_gender.toUpperCase();
      el.detectedGarmentName.textContent = `${g.primary_color.toUpperCase()} ${g.garment_type.toUpperCase()}`;
      el.detectedWearingRule.textContent = g.wearing_instructions;

      // Create Garment Object
      state.selectedGarment = {
        id: `custom_${Date.now()}`,
        name: `Custom ${g.primary_color} ${g.garment_type}`.toUpperCase(),
        type: g.garment_type,
        category: g.category,
        gender: g.target_gender,
        price: "Custom Upload",
        img: el.detectedGarmentThumb.src,
        file: file,
        wearing_instructions: g.wearing_instructions,
        garment_desc: `a ${g.primary_color} ${g.pattern} ${g.garment_type}, ${g.wearing_instructions}`
      };

      // Call Stage 2 Standardizer in background
      fetch(`${API_BASE}/api/standardize-garment`, {
        method: "POST",
        body: formData
      }).then(r => r.json()).then(stdData => {
        if (stdData.standardized_url) {
          state.selectedGarment.standardized_url = stdData.standardized_url;
          console.log("Stage 2 Standardized URL:", stdData.standardized_url);
        }
      }).catch(err => console.warn("Stage 2 standardization note:", err));
    }
  } catch (err) {
    console.error("Custom garment analysis error:", err);
    el.detectedGarmentName.textContent = "Custom Garment Uploaded";
    el.detectedWearingRule.textContent = "Auto-mapped to body fitting.";
  }
}

// ========================================================
// SCREEN 2: DEMO MODELS (Male & Female) & WEBCAM
// ========================================================
function renderDemoModels() {
  if (!el.demoModelsGrid || !window.DEMO_MODELS) return;
  el.demoModelsGrid.innerHTML = "";

  window.DEMO_MODELS.forEach((model) => {
    const card = document.createElement("div");
    card.className = `p-3 rounded-2xl border-2 transition-all cursor-pointer text-center bg-slate-50 hover:border-orange-500 hover:bg-orange-50/30 ${
      state.selectedDemoModel && state.selectedDemoModel.id === model.id
        ? "border-orange-600 bg-orange-50 shadow-md ring-2 ring-orange-200"
        : "border-slate-200"
    }`;
    card.dataset.id = model.id;

    card.innerHTML = `
      <div class="aspect-[3/4] rounded-xl overflow-hidden bg-slate-200 mb-2 relative">
        <img src="${model.img}" alt="${model.name}" class="w-full h-full object-cover">
        <span class="absolute top-1.5 left-1.5 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-black/60 text-white">
          ${model.gender}
        </span>
      </div>
      <h4 class="font-bold text-slate-800 text-xs">${model.name}</h4>
      <span class="text-[10px] text-slate-400 font-medium">${model.desc.split("•")[1] || "170 cm"}</span>
    `;

    card.addEventListener("click", () => selectDemoModel(model));
    el.demoModelsGrid.appendChild(card);
  });
}

async function selectDemoModel(model) {
  state.selectedDemoModel = model;
  state.personLabel = `${model.name} (${model.gender})`;
  state.heightCm = model.height || 170;

  stopWebcam();

  try {
    const res = await fetch(model.img);
    const blob = await res.blob();
    state.personBlob = blob;
    state.personDataUrl = model.img;

    renderDemoModels(); // update selection highlight
    goToStep(3);
  } catch (err) {
    console.warn("Could not fetch model image directly, using URL path:", err);
    state.personDataUrl = model.img;
    goToStep(3);
  }
}

async function startWebcam() {
  stopWebcam();
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 1080 }, height: { ideal: 1440 } },
      audio: false
    });
    state.webcamStream = stream;
    el.webcamVideo.srcObject = stream;
    await el.webcamVideo.play();
  } catch (err) {
    console.error("Camera access error:", err);
    alert("Camera permission not available. Please select one of the 4 demo models above.");
  }
}

function stopWebcam() {
  if (state.webcamStream) {
    state.webcamStream.getTracks().forEach((track) => track.stop());
    state.webcamStream = null;
  }
}

function snapWebcamPhoto() {
  const video = el.webcamVideo;
  const canvas = el.cameraCanvas;
  const ctx = canvas.getContext("2d");

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
    ctx.fillStyle = "#cbd5e1";
    ctx.fillRect(0, 0, 768, 1024);
  }

  const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
  state.personDataUrl = dataUrl;
  state.personLabel = "Live Customer Photo";
  state.selectedDemoModel = null;

  canvas.toBlob((blob) => {
    state.personBlob = blob;
  }, "image/jpeg", 0.95);

  el.cameraPreviewImg.src = dataUrl;
  el.cameraPreviewImg.classList.remove("hidden");
  el.webcamVideo.classList.add("hidden");
  el.cameraGuideOverlay.classList.add("hidden");
  el.cameraLiveControls.classList.add("hidden");
  el.cameraReviewControls.classList.remove("hidden");
  stopWebcam();
}

function resetCameraView() {
  el.cameraPreviewImg.classList.add("hidden");
  el.webcamVideo.classList.remove("hidden");
  el.cameraGuideOverlay.classList.remove("hidden");
  el.cameraLiveControls.classList.remove("hidden");
  el.cameraReviewControls.classList.add("hidden");
  startWebcam();
}

// ========================================================
// SCREEN 3: FIT PROFILE & HEIGHT
// ========================================================
function updateScreen3Profile() {
  if (state.personDataUrl) {
    el.reviewPersonThumb.src = state.personDataUrl;
    el.reviewPersonName.textContent = state.personLabel;
  }
  if (state.selectedGarment) {
    el.reviewGarmentThumb.src = state.selectedGarment.img;
    el.reviewGarmentName.textContent = state.selectedGarment.name;
    el.reviewGarmentBadge.textContent = `${state.selectedGarment.type.toUpperCase()} • ${state.selectedGarment.category.replace('_', ' ').toUpperCase()}`;
    el.reviewWearingRule.textContent = state.selectedGarment.wearing_instructions || "Fit naturally to customer posture";
  }
  updateHeight(state.heightCm);
}

function updateHeight(cm) {
  const clamped = Math.max(130, Math.min(220, cm));
  state.heightCm = clamped;
  if (el.inputHeightCm) el.inputHeightCm.value = clamped;
  
  const totalInches = clamped / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  if (el.displayFeetInches) el.displayFeetInches.textContent = `${feet} ft ${inches} in`;
}

// ========================================================
// SCREEN 4: STAGE 3 UNIVERSAL TRY-ON INFERENCE
// ========================================================
async function generateUniversalTryOn() {
  if (!state.personBlob && !state.personDataUrl) {
    alert("Please select a demo model or take a photo first.");
    goToStep(2);
    return;
  }
  if (!state.selectedGarment) {
    alert("Please select a garment first.");
    goToStep(1);
    return;
  }

  goToStep(4);

  // Show loading spinner
  el.resultLoadingBox.classList.remove("hidden");
  el.resultSuccessBox.classList.add("hidden");

  let elapsed = 0;
  el.loadingElapsedTimer.textContent = "0s";
  if (state.timerInterval) clearInterval(state.timerInterval);

  const steps = [
    "Stage 1: Validating garment structural contours...",
    "Stage 2: Standardizing fabric textures & boundaries...",
    "Stage 3: Generating universal try-on with neural diffusion...",
    "Stage 4: Running self-checking validator loop...",
    "Applying Pillow sharpness & contrast enhancements..."
  ];
  let stepIdx = 0;
  el.loadingStepStatus.textContent = steps[0];

  state.timerInterval = setInterval(() => {
    elapsed += 1;
    el.loadingElapsedTimer.textContent = `${elapsed}s`;
    if (elapsed % 6 === 0) {
      stepIdx = (stepIdx + 1) % steps.length;
      el.loadingStepStatus.textContent = steps[stepIdx];
    }
  }, 1000);

  try {
    // 1. Resolve Person Blob
    let pBlob = state.personBlob;
    if (!pBlob && state.personDataUrl) {
      const pRes = await fetch(state.personDataUrl);
      pBlob = await pRes.blob();
    }

    // 2. Resolve Garment Blob
    let gBlob = state.selectedGarment.file;
    if (!gBlob) {
      const gRes = await fetch(state.selectedGarment.img);
      gBlob = await gRes.blob();
    }

    // 3. Prepare FormData for /api/tryon
    const formData = new FormData();
    formData.append("person", pBlob, "person.jpg");
    formData.append("garment", gBlob, "garment.jpg");
    formData.append("garment_id", state.selectedGarment.id);
    formData.append("category", state.selectedGarment.category);
    formData.append("height", state.heightCm);

    // Pass garment_data JSON
    const garmentDataObj = state.uploadedGarmentData || {
      garment_type: state.selectedGarment.type,
      category: state.selectedGarment.category,
      target_gender: state.selectedGarment.gender,
      components: [state.selectedGarment.type],
      primary_color: state.selectedGarment.color || "black",
      pattern: state.selectedGarment.pattern || "plain",
      wearing_instructions: state.selectedGarment.wearing_instructions
    };
    formData.append("garment_data", JSON.stringify(garmentDataObj));

    console.log(`[STAGE 3] Dispatching /tryon for: ${state.selectedGarment.name} (${state.selectedGarment.category})`);

    const response = await fetch(`${API_BASE}/tryon`, {
      method: "POST",
      body: formData
    });

    const data = await response.json();
    console.log("[STAGE 3] Try-On Response:", data);

    clearInterval(state.timerInterval);

    if (data.status === "completed" && data.result_url) {
      showTryOnSuccess(data.result_url);
    } else {
      throw new Error(data.error || "Try-On generation did not return a valid result.");
    }
  } catch (err) {
    clearInterval(state.timerInterval);
    console.error("Universal try-on error:", err);
    alert(`Try-on error: ${err.message || String(err)}. Falling back to preview.`);
    showTryOnSuccess(state.selectedGarment.img);
  }
}

function showTryOnSuccess(resultUrl) {
  el.resultLoadingBox.classList.add("hidden");
  el.resultSuccessBox.classList.remove("hidden");

  const fullResultUrl = resultUrl.startsWith("http") ? resultUrl : `${API_BASE}${resultUrl}`;
  
  // Set images for Before/After Slider
  el.resultImageAfter.src = fullResultUrl;
  el.resultImageBefore.src = state.personDataUrl;
  el.btnDownloadResult.href = fullResultUrl;

  // Set Details
  const garment = state.selectedGarment;
  el.resultGarmentTitle.textContent = garment.name;
  el.resultGarmentThumbSide.src = garment.img;
  el.resultGarmentNameSide.textContent = garment.name;
  el.resultGarmentPriceSide.textContent = garment.price;
  el.resultTypeDisplay.textContent = garment.type.toUpperCase();
  el.resultCategoryDisplay.textContent = garment.category.replace('_', ' ').toUpperCase();
  el.resultDescSide.textContent = garment.wearing_instructions || "Custom fit adapted to stature.";

  // Render bottom quick try strip
  renderQuickTryStrip();

  // Reset comparison slider to 50%
  if (el.compareSlider) {
    el.compareSlider.value = 50;
    updateSlider(50);
  }
}

function updateSlider(val) {
  if (el.beforeWrapper) el.beforeWrapper.style.width = `${val}%`;
  if (el.compareDivider) el.compareDivider.style.left = `${val}%`;
  if (el.resultImageBefore) el.resultImageBefore.style.width = `${100 / (val / 100)}%`;
}

function renderQuickTryStrip() {
  if (!el.universalQuickTryTrack || !window.UNIVERSAL_GARMENTS) return;
  el.universalQuickTryTrack.innerHTML = "";

  window.UNIVERSAL_GARMENTS.forEach((item) => {
    const card = document.createElement("div");
    const isCurrent = state.selectedGarment && state.selectedGarment.id === item.id;
    card.className = `flex-shrink-0 w-32 bg-white rounded-2xl p-2 border-2 cursor-pointer transition-all hover:scale-105 ${
      isCurrent ? "border-orange-500 shadow-md ring-2 ring-orange-200" : "border-slate-200"
    }`;

    card.innerHTML = `
      <div class="aspect-[3/4] rounded-xl overflow-hidden bg-slate-100 mb-1.5 relative">
        <img src="${item.img}" alt="${item.name}" class="w-full h-full object-cover">
        ${isCurrent ? `<span class="absolute top-1 right-1 text-[8px] font-extrabold uppercase bg-orange-600 text-white px-1.5 py-0.5 rounded">Active</span>` : ""}
      </div>
      <p class="text-[11px] font-bold text-slate-800 line-clamp-1">${item.name}</p>
      <p class="text-[10px] font-extrabold text-orange-600">${item.price}</p>
    `;

    card.addEventListener("click", () => {
      selectGarment(item, false);
      generateUniversalTryOn();
    });

    el.universalQuickTryTrack.appendChild(card);
  });
}

// ========================================================
// NAVIGATION & STEPPER
// ========================================================
function goToStep(step) {
  if (step < 1 || step > 4) return;
  if (step === 2 && !state.selectedGarment) return;
  if (step >= 3 && !state.personBlob && !state.personDataUrl) {
    goToStep(2);
    return;
  }

  if (state.currentStep === 2 && step !== 2) {
    stopWebcam();
  }

  state.currentStep = step;

  // Toggle Screen Views
  Object.keys(el.screens).forEach((s) => {
    const screen = el.screens[s];
    if (parseInt(s) === step) {
      screen.classList.remove("hidden");
    } else {
      screen.classList.add("hidden");
    }
  });

  // Update Stepper Nav
  el.stepIndicators.forEach((ind, idx) => {
    const indStep = idx + 1;
    if (indStep === step) {
      ind.className = "step-indicator flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-orange-600 text-white shadow-sm transition";
      ind.querySelector("span").className = "w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[11px] font-bold";
    } else if (indStep < step) {
      ind.className = "step-indicator flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-orange-100 text-orange-800 border border-orange-200 transition";
      ind.querySelector("span").className = "w-5 h-5 rounded-full bg-orange-200 text-orange-900 flex items-center justify-center text-[11px] font-bold";
    } else {
      ind.className = "step-indicator flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-100 text-slate-500 transition";
      ind.querySelector("span").className = "w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[11px] font-bold";
    }
  });

  if (step === 2) {
    resetCameraView();
  } else if (step === 3) {
    updateScreen3Profile();
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ========================================================
// HEALTH CHECK
// ========================================================
async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    if (res.ok) {
      const data = await res.json();
      if (el.backendStatusPill) {
        el.backendStatusPill.textContent = "Universal 3-Stage AI Ready";
        el.backendStatusPill.className = "text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full";
      }
    }
  } catch (err) {
    if (el.backendStatusPill) {
      el.backendStatusPill.textContent = "Backend Offline (:8000)";
      el.backendStatusPill.className = "text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full";
    }
  }
}

// ========================================================
// EVENT BINDINGS
// ========================================================
function bindAppEvents() {
  // Stepper Clickable
  el.stepIndicators.forEach((btn, idx) => {
    btn.addEventListener("click", () => goToStep(idx + 1));
  });

  // Custom Garment Upload
  if (el.customGarmentInput) {
    el.customGarmentInput.addEventListener("change", (e) => {
      if (e.target.files && e.target.files[0]) {
        handleCustomGarmentUpload(e.target.files[0]);
      }
    });
  }

  if (el.btnTryDetectedGarment) {
    el.btnTryDetectedGarment.addEventListener("click", () => goToStep(2));
  }

  // Filter Tabs
  el.filterTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      el.filterTabs.forEach((t) => {
        t.className = "filter-tab px-3 py-1.5 rounded-xl text-xs font-bold bg-white text-slate-600 hover:bg-slate-100 border border-slate-200";
      });
      tab.className = "filter-tab px-3 py-1.5 rounded-xl text-xs font-bold bg-orange-600 text-white shadow-sm";
      state.activeFilter = tab.dataset.filter;
      renderUniversalCatalog();
    });
  });

  // Screen 2 Webcam Controls
  if (el.btnStartCamera) el.btnStartCamera.addEventListener("click", startWebcam);
  if (el.btnSnapPhoto) el.btnSnapPhoto.addEventListener("click", snapWebcamPhoto);
  if (el.btnRetakeCamera) el.btnRetakeCamera.addEventListener("click", resetCameraView);
  if (el.btnAcceptCamera) el.btnAcceptCamera.addEventListener("click", () => goToStep(3));
  if (el.btnBackToScreen1) el.btnBackToScreen1.addEventListener("click", () => goToStep(1));

  // Screen 3 Profile Controls
  if (el.btnHeightMinus) el.btnHeightMinus.addEventListener("click", () => updateHeight(state.heightCm - 2));
  if (el.btnHeightPlus) el.btnHeightPlus.addEventListener("click", () => updateHeight(state.heightCm + 2));
  if (el.inputHeightCm) {
    el.inputHeightCm.addEventListener("change", (e) => updateHeight(parseInt(e.target.value) || 170));
  }
  if (el.btnGenerateUniversalTryOn) {
    el.btnGenerateUniversalTryOn.addEventListener("click", generateUniversalTryOn);
  }
  if (el.btnBackToScreen2) el.btnBackToScreen2.addEventListener("click", () => goToStep(2));

  // Screen 4 Result Controls
  if (el.compareSlider) {
    el.compareSlider.addEventListener("input", (e) => updateSlider(e.target.value));
  }
  if (el.btnBackToCatalogFromResult) {
    el.btnBackToCatalogFromResult.addEventListener("click", () => goToStep(1));
  }
  if (el.btnNewCustomerSession) {
    el.btnNewCustomerSession.addEventListener("click", () => {
      state.personBlob = null;
      state.personDataUrl = null;
      state.selectedDemoModel = null;
      goToStep(1);
    });
  }
}
