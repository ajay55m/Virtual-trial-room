import { useState, useRef } from 'react';
import { type FlexibleBodyProfile, analyzeAnyBody } from './bodyProfile';

const API = "http://localhost:8000";

export function useBodyTryOn() {
  const [personFile, setPersonFile] = useState<File | null>(null);
  const [personPreview, setPersonPreview] = useState<string>("");
  const [bodyFitResult, setBodyFitResult] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [bodyProfile, setBodyProfile] = useState<FlexibleBodyProfile | null>(null);
  const fileRef = useRef<File | null>(null);

  const handleUpload = (file: File) => {
    fileRef.current = file; // Ref prevents stale state bug
    setPersonFile(file);
    const url = URL.createObjectURL(file);
    setPersonPreview(url);
    setBodyFitResult(""); // Clear old model result on new upload

    // Auto-analyze body profile from uploaded photo
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = url;
    img.onload = () => {
      const detected = analyzeAnyBody([], img.width, img.height);
      setBodyProfile(detected);
    };
  };

  const wearOnMyBody = async (saree: any, profile?: any, fallbackPhotoUri?: string) => {
    // If user hasn't explicitly uploaded a new file in result view, convert fallbackPhotoUri from Step 2
    if (!fileRef.current && fallbackPhotoUri) {
      try {
        const resp = await fetch(fallbackPhotoUri);
        const blob = await resp.blob();
        const f = new File([blob], "person.jpg", { type: blob.type || "image/jpeg" });
        fileRef.current = f;
        setPersonFile(f);
        setPersonPreview(fallbackPhotoUri);
      } catch (e) {
        console.warn("Could not convert fallback photo uri:", e);
      }
    }

    if (!fileRef.current) return alert("Upload your photo first!");

    const activeProfile = profile || bodyProfile || analyzeAnyBody([], 1000, 1000);
    if (activeProfile.confidence < 0.5) {
      return alert("Photo unclear. Upload front-facing, full-body photo in good light.");
    }

    setIsGenerating(true);
    try {
      const form = new FormData();
      form.append("person_image", fileRef.current); // HER photo, not stock model
      form.append("garment_id", saree?.id || "garment_active");
      form.append(
        "garment_image_url",
        saree?.image || saree?.fabricCloseupImage || saree?.flatlayImage || saree?.tryonResultImage || ""
      );
      form.append("garment_name", saree?.name || "Traditional Saree");
      form.append("body_profile", JSON.stringify(activeProfile));

      const res = await fetch(`${API}/api/body-fit/tryon`, { method: "POST", body: form });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { job_id } = await res.json();

      const poll = setInterval(async () => {
        try {
          const jobRes = await fetch(`${API}/api/body-fit/jobs/${job_id}`);
          if (!jobRes.ok) return;
          const job = await jobRes.json();
          if (job.status === "completed") {
            clearInterval(poll);
            setBodyFitResult(API + job.result_url);
            setIsGenerating(false);
          } else if (job.status === "failed") {
            clearInterval(poll);
            alert(job.error || "Try-on failed");
            setIsGenerating(false);
          }
        } catch {
          // continue polling
        }
      }, 3000);
    } catch (err) {
      setIsGenerating(false);
      console.warn("Body try-on API call error:", err);
      alert("Start backend: uvicorn body_fit_api:app --port 8000");
    }
  };

  return {
    handleUpload,
    wearOnMyBody,
    trySareeOnMyBody: wearOnMyBody, // backwards compatibility alias
    personFile,
    personPreview,
    bodyFitResult,
    resultImage: bodyFitResult, // backwards compatibility alias
    isGenerating,
    loading: isGenerating, // backwards compatibility alias
    bodyProfile,
    setBodyProfile,
  };
}
