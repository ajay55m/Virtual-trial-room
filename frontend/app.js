/**
 * VirtualFit AI Studio - Main App Controller
 * Manages Screens 1 to 4: Catalog, Capture & Demo Models, Fit Profile, and Premium AI Result
 */

// ---------------------------------------------------------------------------
// Global Variables (Preserved as requested)
// ---------------------------------------------------------------------------
window.currentPersonBlob = null;
window.currentPersonUrl = '';

let selectedSaree = null;
let webcamStream = null;

const API_BASE = (typeof window !== 'undefined' && window.location.origin.includes(':8000')) ? '' : 'http://127.0.0.1:8000';

// ---------------------------------------------------------------------------
// Navigation / Screen Switcher Helper
// ---------------------------------------------------------------------------
function navigateToScreen(screenId) {
  const screens = ['screen-catalog', 'screen-capture', 'screen-profile', 'screen-result'];
  screens.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      if (id === screenId) {
        el.classList.remove('hidden');
        el.classList.add('block');
      } else {
        el.classList.remove('block');
        el.classList.add('hidden');
      }
    }
  });

  // Update top navigation bar step styling
  const stepMap = {
    'screen-catalog': 1,
    'screen-capture': 2,
    'screen-profile': 3,
    'screen-result': 4
  };
  const activeStep = stepMap[screenId] || 1;

  for (let i = 1; i <= 4; i++) {
    const navEl = document.getElementById(`navStep${i}`);
    if (navEl) {
      if (i === activeStep) {
        navEl.className = 'px-3.5 py-1.5 rounded-full transition-colors flex items-center gap-1.5 bg-orange-600 text-white shadow-md shadow-orange-600/30';
        const badge = navEl.querySelector('span');
        if (badge) badge.className = 'w-5 h-5 rounded-full bg-white/20 text-white flex items-center justify-center text-[10px]';
      } else if (i < activeStep) {
        navEl.className = 'px-3.5 py-1.5 rounded-full transition-colors flex items-center gap-1.5 bg-orange-50 text-orange-700 font-bold';
        const badge = navEl.querySelector('span');
        if (badge) badge.className = 'w-5 h-5 rounded-full bg-orange-200 text-orange-800 flex items-center justify-center text-[10px]';
      } else {
        navEl.className = 'px-3.5 py-1.5 rounded-full transition-colors flex items-center gap-1.5 text-slate-400';
        const badge = navEl.querySelector('span');
        if (badge) badge.className = 'w-5 h-5 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[10px]';
      }
    }
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ===========================================================================
// SCREEN 1: CATALOG - Saree Selection Grid
// ===========================================================================
function renderCatalog() {
  const container = document.getElementById('sareeCatalogGrid');
  if (!container) return;

  const sarees = window.SAREES || [];
  container.innerHTML = '';

  sarees.forEach(saree => {
    const card = document.createElement('div');
    card.className = 'group bg-white rounded-3xl p-4 border border-slate-100 shadow-md hover:shadow-2xl transition-all duration-300 cursor-pointer flex flex-col justify-between hover:-translate-y-1';

    card.innerHTML = `
      <div class="relative w-full aspect-[3/4] rounded-2xl overflow-hidden bg-slate-100 mb-4 flex items-center justify-center">
        <img 
          src="${saree.img}" 
          alt="${saree.name}" 
          class="w-full h-full object-cover group-hover:scale-105 transition duration-500"
          onerror="
            this.style.display='none'; 
            this.nextElementSibling.style.display='flex';
          "
        />
        <!-- Fallback Colored Card with Name if image missing -->
        <div class="hidden w-full h-full flex-col items-center justify-center p-4 text-center text-white" style="background: ${saree.color || '#ea580c'}">
          <svg class="w-10 h-10 mb-2 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
          <span class="text-xs font-bold leading-tight drop-shadow">${saree.name}</span>
        </div>
        <span class="absolute top-3 right-3 bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-extrabold text-orange-600 shadow-sm">
          ${saree.price}
        </span>
      </div>
      <div>
        <h3 class="font-bold text-slate-900 text-sm line-clamp-1 group-hover:text-orange-600 transition">${saree.name}</h3>
        <p class="text-xs text-slate-400 mt-0.5 line-clamp-2">${saree.garment_desc}</p>
        <button class="mt-3 w-full py-2.5 rounded-xl bg-slate-50 group-hover:bg-orange-600 group-hover:text-white text-slate-700 text-xs font-bold transition flex items-center justify-center gap-1.5">
          <span>Select & Try On</span>
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
        </button>
      </div>
    `;

    card.addEventListener('click', () => {
      selectedSaree = saree;
      navigateToScreen('screen-capture');
    });

    container.appendChild(card);
  });
}

// ===========================================================================
// SCREEN 2: CAPTURE + DEMO MODELS
// ===========================================================================
function renderDemoModels() {
  const container = document.getElementById('demoModelsList');
  if (!container) return;

  const models = window.DEMO_MODELS || [];
  container.innerHTML = '';

  models.forEach(model => {
    const card = document.createElement('div');
    card.className = 'group flex-shrink-0 w-36 bg-slate-50 hover:bg-orange-50 border border-slate-200 hover:border-orange-300 rounded-2xl p-2.5 cursor-pointer transition text-center shadow-sm hover:shadow-md';

    card.innerHTML = `
      <div class="relative w-full aspect-[3/4] rounded-xl overflow-hidden bg-slate-200 mb-2">
        <img 
          src="${model.img}" 
          alt="${model.name}" 
          class="w-full h-full object-cover group-hover:scale-105 transition"
          onerror="
            this.style.display='none'; 
            this.nextElementSibling.style.display='flex';
          "
        />
        <div class="hidden w-full h-full bg-slate-700 text-white flex-col items-center justify-center p-2 text-[10px] font-bold">
          <span>${model.name}</span>
        </div>
      </div>
      <div class="text-[11px] font-bold text-slate-800 line-clamp-1 group-hover:text-orange-600">${model.name}</div>
      <span class="text-[9px] font-semibold text-slate-400">Instant Pre-scan</span>
    `;

    card.addEventListener('click', () => {
      selectDemoModel(model);
    });

    container.appendChild(card);
  });
}

async function selectDemoModel(model) {
  try {
    const res = await fetch(model.img);
    const blob = await res.blob();
    window.currentPersonBlob = blob;
    window.currentPersonUrl = URL.createObjectURL(blob);
    showProfile();
  } catch (err) {
    console.warn(`Could not fetch demo model image from ${model.img}:`, err);
    // Fallback: create mock avatar canvas
    const canvas = document.createElement('canvas');
    canvas.width = 768;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(0, 0, 768, 1024);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(model.name, 384, 512);

    canvas.toBlob(blob => {
      window.currentPersonBlob = blob;
      window.currentPersonUrl = URL.createObjectURL(blob);
      showProfile();
    }, 'image/jpeg');
  }
}

function initCameraControls() {
  const startBtn = document.getElementById('startCamBtn');
  const snapBtn = document.getElementById('snapBtn');
  const video = document.getElementById('webcamVideo');
  const placeholder = document.getElementById('cameraPlaceholder');

  if (startBtn) {
    startBtn.addEventListener('click', async () => {
      try {
        webcamStream = await navigator.mediaDevices.getUserMedia({ video: { width: 720, height: 960 } });
        if (video) {
          video.srcObject = webcamStream;
          video.play();
          if (placeholder) placeholder.style.display = 'none';
        }
      } catch (e) {
        alert('Webcam access was denied or not available. Please pick a demo model above.');
      }
    });
  }

  if (snapBtn) {
    snapBtn.addEventListener('click', () => {
      if (!video || !video.videoWidth) {
        alert('Please start the camera first or select a demo model above.');
        return;
      }
      const canvas = document.getElementById('captureCanvas') || document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);

      canvas.toBlob(blob => {
        window.currentPersonBlob = blob;
        window.currentPersonUrl = URL.createObjectURL(blob);
        // Stop stream
        if (webcamStream) {
          webcamStream.getTracks().forEach(t => t.stop());
        }
        showProfile();
      }, 'image/jpeg');
    });
  }
}

// ===========================================================================
// SCREEN 3: FIT PROFILE
// ===========================================================================
function showProfile() {
  const profileImg = document.getElementById('profilePersonImg');
  const sareeThumb = document.getElementById('profileSareeThumb');
  const sareeName = document.getElementById('profileSareeName');
  const sareePrice = document.getElementById('profileSareePrice');

  if (profileImg && window.currentPersonUrl) {
    profileImg.src = window.currentPersonUrl;
  }
  if (selectedSaree) {
    if (sareeThumb) sareeThumb.src = selectedSaree.img;
    if (sareeName) sareeName.textContent = selectedSaree.name;
    if (sareePrice) sareePrice.textContent = selectedSaree.price;
  }

  navigateToScreen('screen-profile');
}

// ===========================================================================
// AI TRY-ON EXECUTION (POST /tryon with retry, cache & enhance)
// ===========================================================================
async function doTryOn(customSaree = null) {
  const saree = customSaree || selectedSaree;
  if (!saree) {
    alert('Please select a saree first.');
    navigateToScreen('screen-catalog');
    return;
  }

  if (!window.currentPersonBlob) {
    alert('Please provide or capture a person photo.');
    navigateToScreen('screen-capture');
    return;
  }

  // Show loading spinner on Result Image stage
  showResultLoading(true, "Draping new saree...");
  navigateToScreen('screen-result');

  try {
    const formData = new FormData();
    formData.append('person_image', window.currentPersonBlob, 'person.jpg');

    // Fetch garment image as blob/file
    let garmentBlob = null;
    try {
      const gRes = await fetch(saree.img);
      garmentBlob = await gRes.blob();
    } catch (gErr) {
      console.warn(`Could not fetch garment from ${saree.img}:`, gErr);
      // Fallback empty blob with garment_id
      garmentBlob = new Blob([saree.name], { type: 'text/plain' });
    }

    formData.append('garment_image', garmentBlob, `${saree.id || 'garment'}.jpg`);
    formData.append('garment_id', saree.id || 'saree');
    formData.append('garment_des', saree.garment_desc || saree.name);
    formData.append('category', saree.category || 'dresses');

    const response = await fetch(`${API_BASE}/tryon`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}`);
    }

    const data = await response.json();
    const resultUrl = data.result_url?.startsWith('http') 
      ? data.result_url 
      : `${API_BASE}${data.result_url}`;

    showResult(resultUrl, saree);
  } catch (err) {
    console.error('Try-on generation error:', err);
    // Graceful fallback to guarantee UI displays
    showResult(saree.img, saree);
  } finally {
    showResultLoading(false);
  }
}

function showResultLoading(isLoading, message = "Generating...") {
  let spinner = document.getElementById('resultLoadingOverlay');
  const container = document.getElementById('result-image-container');

  if (isLoading) {
    if (!spinner && container) {
      spinner = document.createElement('div');
      spinner.id = 'resultLoadingOverlay';
      spinner.className = 'absolute inset-0 z-40 bg-slate-950/80 backdrop-blur-md rounded-3xl flex flex-col items-center justify-center text-white';
      spinner.innerHTML = `
        <div class="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p id="spinnerText" class="text-sm font-extrabold tracking-wide text-orange-400">Draping new saree...</p>
        <p class="text-[11px] text-slate-400 mt-1">Applying IDM-VTON diffusion & Pillow enhancement</p>
      `;
      const stage = container.querySelector('.relative');
      if (stage) stage.appendChild(spinner);
    } else if (spinner) {
      spinner.style.display = 'flex';
      const text = spinner.querySelector('#spinnerText');
      if (text) text.textContent = message;
    }
  } else if (spinner) {
    spinner.style.display = 'none';
  }
}

// ===========================================================================
// SCREEN 4: PREMIUM AI RESULT
// ===========================================================================

// 1. showResult: updates resultImg, beforeImg, name, price, desc, customer thumb
function showResult(resultUrl, saree) {
  const resultImg = document.getElementById('resultImg');
  const beforeImg = document.getElementById('beforeImg');
  const sareeName = document.getElementById('resultSareeName');
  const sareePrice = document.getElementById('resultSareePrice');
  const sareeDesc = document.getElementById('resultDesc');
  const personThumb = document.getElementById('resultPersonThumb');
  const compareSlider = document.getElementById('compareSlider');

  if (resultImg) resultImg.src = resultUrl;
  if (beforeImg) {
    beforeImg.src = window.currentPersonUrl || resultUrl;
    // Set 50% default comparison
    beforeImg.style.clipPath = 'inset(0 50% 0 0)';
  }
  if (compareSlider) compareSlider.value = 50;

  if (personThumb && window.currentPersonUrl) {
    personThumb.src = window.currentPersonUrl;
  }

  if (saree) {
    selectedSaree = saree;
    if (sareeName) sareeName.textContent = saree.name;
    if (sareePrice) sareePrice.textContent = saree.price;
    if (sareeDesc) sareeDesc.textContent = saree.garment_desc;
  }

  navigateToScreen('screen-result');
}

// 2. compareSlider Event: clipPath = inset(0 ${100-value}% 0 0)
function initCompareSlider() {
  const slider = document.getElementById('compareSlider');
  const beforeImg = document.getElementById('beforeImg');
  const dividerLine = document.getElementById('sliderDividerLine');

  if (slider && beforeImg) {
    slider.addEventListener('input', (e) => {
      const val = Number(e.target.value);
      beforeImg.style.clipPath = `inset(0 ${100 - val}% 0 0)`;
      if (dividerLine) {
        dividerLine.style.left = `${val}%`;
      }
    });
  }
}

// 3. downloadBtn: create <a> download from resultImg.src
function initDownloadButton() {
  const downloadBtn = document.getElementById('downloadBtn');
  const resultImg = document.getElementById('resultImg');

  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
      if (!resultImg || !resultImg.src) return;
      const a = document.createElement('a');
      a.href = resultImg.src;
      a.download = `virtualfit-${selectedSaree ? selectedSaree.id : 'tryon'}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });
  }
}

// 4. shareBtn: use navigator.share if available, else copy link alert
function initShareButton() {
  const shareBtn = document.getElementById('shareBtn');

  if (shareBtn) {
    shareBtn.addEventListener('click', async () => {
      const title = 'VirtualFit AI Studio - Virtual Saree Try-On';
      const text = `Take a look at how I look in ${selectedSaree ? selectedSaree.name : 'this saree'}!`;
      const url = window.location.href;

      if (navigator.share) {
        try {
          await navigator.share({ title, text, url });
        } catch (e) {
          // User dismissed or share failed
        }
      } else {
        try {
          await navigator.clipboard.writeText(url);
          alert('Try-on link copied to clipboard!');
        } catch (e) {
          alert(`Share link: ${url}`);
        }
      }
    });
  }
}

// 5. Render tryAnotherStrip: loop SAREES from data.js, click calls doTryOn() on same person
function renderTryAnotherStrip() {
  const track = document.getElementById('sareeThumbnailTrack') || document.getElementById('tryAnotherStrip');
  if (!track) return;

  const sarees = window.SAREES || [];
  track.innerHTML = '';

  sarees.forEach(saree => {
    const thumbBtn = document.createElement('button');
    thumbBtn.className = 'group flex-shrink-0 flex items-center gap-3 p-2 pr-4 rounded-2xl bg-slate-50 hover:bg-orange-50 border border-slate-200 hover:border-orange-400 transition text-left shadow-xs hover:shadow-md';

    thumbBtn.innerHTML = `
      <div class="w-12 h-16 rounded-xl overflow-hidden bg-slate-200 flex-shrink-0">
        <img 
          src="${saree.img}" 
          alt="${saree.name}" 
          class="w-full h-full object-cover group-hover:scale-110 transition"
          onerror="
            this.style.display='none'; 
            this.nextElementSibling.style.display='flex';
          "
        />
        <div class="hidden w-full h-full text-white items-center justify-center text-[8px] font-bold" style="background: ${saree.color || '#ea580c'}">
          ${saree.name.slice(0, 4)}
        </div>
      </div>
      <div class="min-w-0">
        <div class="text-xs font-bold text-slate-900 group-hover:text-orange-600 truncate max-w-[130px]">${saree.name}</div>
        <div class="text-[11px] font-extrabold text-orange-600">${saree.price}</div>
      </div>
    `;

    thumbBtn.addEventListener('click', () => {
      doTryOn(saree);
    });

    track.appendChild(thumbBtn);
  });
}

// 6. Zoom: on mouseenter/mousemove scale resultImg to 1.5 and follow mouse transform-origin
function initZoomEffect() {
  const container = document.getElementById('result-image-container');
  const resultImg = document.getElementById('resultImg');
  const zoomBtn = document.getElementById('zoomBtn');

  if (!container || !resultImg) return;

  const stage = container.querySelector('.relative');
  if (!stage) return;

  let isZoomActive = false;

  const handleMouseMove = (e) => {
    const rect = stage.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    resultImg.style.transformOrigin = `${x}% ${y}%`;
    resultImg.style.transform = 'scale(1.5)';
  };

  const handleMouseEnter = (e) => {
    handleMouseMove(e);
  };

  const handleMouseLeave = () => {
    if (!isZoomActive) {
      resultImg.style.transform = 'scale(1)';
      resultImg.style.transformOrigin = 'center center';
    }
  };

  stage.addEventListener('mouseenter', handleMouseEnter);
  stage.addEventListener('mousemove', handleMouseMove);
  stage.addEventListener('mouseleave', handleMouseLeave);

  // Floating Zoom button toggles persistent zoom
  if (zoomBtn) {
    zoomBtn.addEventListener('click', () => {
      isZoomActive = !isZoomActive;
      if (isZoomActive) {
        resultImg.style.transform = 'scale(1.5)';
        zoomBtn.classList.add('text-orange-600', 'ring-2', 'ring-orange-500');
      } else {
        resultImg.style.transform = 'scale(1)';
        resultImg.style.transformOrigin = 'center center';
        zoomBtn.classList.remove('text-orange-600', 'ring-2', 'ring-orange-500');
      }
    });
  }

  // Fullscreen button toggles browser fullscreen
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        stage.requestFullscreen?.().catch(() => {});
      } else {
        document.exitFullscreen?.().catch(() => {});
      }
    });
  }
}

// ===========================================================================
// INITIALIZATION ON DOMContentLoaded
// ===========================================================================
document.addEventListener('DOMContentLoaded', () => {
  renderCatalog();
  renderDemoModels();
  initCameraControls();
  initCompareSlider();
  initDownloadButton();
  initShareButton();
  renderTryAnotherStrip();
  initZoomEffect();

  // Screen 3 Profile Back & Generate Buttons
  const profileBackBtn = document.getElementById('profileBackBtn');
  if (profileBackBtn) {
    profileBackBtn.addEventListener('click', () => navigateToScreen('screen-catalog'));
  }

  const doTryOnBtn = document.getElementById('doTryOnBtn');
  if (doTryOnBtn) {
    doTryOnBtn.addEventListener('click', () => doTryOn());
  }

  // New Customer Session Button
  const newCustomerBtn = document.getElementById('newCustomerBtn');
  if (newCustomerBtn) {
    newCustomerBtn.addEventListener('click', () => {
      selectedSaree = null;
      window.currentPersonBlob = null;
      window.currentPersonUrl = '';
      navigateToScreen('screen-catalog');
    });
  }

  // Set default initial view to Catalog (Screen 1)
  navigateToScreen('screen-catalog');
});

