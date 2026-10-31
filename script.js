const API_URL = (typeof window !== "undefined" && window.location.port === "8000")
  ? ""
  : "http://localhost:8000";
let uploadedFile = null;
let selectedSaree = "saree1.jpg"; // Default first saree selected

// 1. Capture uploaded girl image - DO NOT just preview
document.getElementById("uploadInput").addEventListener("change", (e) => {
  uploadedFile = e.target.files[0];
  if (uploadedFile) {
    const previewImg = document.getElementById("previewImage");
    previewImg.src = URL.createObjectURL(uploadedFile);
    previewImg.style.display = "block";
    const placeholder = document.getElementById("previewPlaceholder");
    if (placeholder) placeholder.style.display = "none";
  }
});

// 2. Capture selected saree
document.querySelectorAll(".saree-item").forEach(item => {
  item.addEventListener("click", () => {
    document.querySelectorAll(".saree-item").forEach(i => i.classList.remove("selected"));
    item.classList.add("selected");
    selectedSaree = item.dataset.id; // e.g., "saree1.jpg"
  });
});

// 3. Try-On Button - NOW SENDS HER PHOTO TO AI
document.getElementById("tryOnBtn").addEventListener("click", async () => {
  if (!uploadedFile) return alert("Please upload your photo first!");
  if (!selectedSaree) return alert("Please select a saree!");

  const btn = document.getElementById("tryOnBtn");
  const resultImg = document.getElementById("resultImage");
  const status = document.getElementById("statusText");
  const resultPlaceholder = document.getElementById("resultPlaceholder");

  btn.disabled = true;
  status.innerText = "AI is draping saree on your photo... 30-40 seconds ⏳";

  const formData = new FormData();
  formData.append("person_image", uploadedFile); // <-- THE FIX
  formData.append("garment_id", selectedSaree);

  try {
    const res = await fetch(`${API_URL}/api/tryon`, { method: "POST", body: formData });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `Server returned ${res.status}`);
    }
    const data = await res.json();
    const jobId = data.job_id;

    // Poll until AI finishes
    const interval = setInterval(async () => {
      try {
        const jobRes = await fetch(`${API_URL}/api/jobs/${jobId}`);
        const job = await jobRes.json();

        if (job.status === "completed") {
          clearInterval(interval);
          resultImg.src = API_URL + job.result_url; // Her result, not stock model
          resultImg.style.display = "block";
          if (resultPlaceholder) resultPlaceholder.style.display = "none";
          status.innerText = "Done! ✅ Saree draped on your photo.";
          btn.disabled = false;
        } else if (job.status === "failed") {
          clearInterval(interval);
          status.innerText = "Failed: " + (job.error || "Generation error");
          btn.disabled = false;
        } else {
          status.innerText = "AI is draping saree on your photo... ⏳ (Status: " + (job.status || "processing") + ")";
        }
      } catch (pollErr) {
        console.warn("Polling error:", pollErr);
      }
    }, 3000);

  } catch (err) {
    status.innerText = "Backend not running! Start backend first. (" + err.message + ")";
    btn.disabled = false;
  }
});

