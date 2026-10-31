import { useState } from 'react';
import { measureBodyFromPhoto, type BodyMeasurements } from './measureBody';

const API = "http://localhost:8000";

export function useBodyTryOn() {
  const [personFile, setPersonFile] = useState<File | null>(null);
  const [personPreview, setPersonPreview] = useState<string>("");
  const [resultImage, setResultImage] = useState<string>("");
  const [measurements, setMeasurements] = useState<BodyMeasurements | null>(null);
  const [loading, setLoading] = useState(false);

  const handleUpload = async (file: File) => {
    setPersonFile(file);
    const url = URL.createObjectURL(file);
    setPersonPreview(url);
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = url;
      await img.decode();
      const m = await measureBodyFromPhoto(img, 175);
      setMeasurements(m);
      return m;
    } catch (e) {
      console.warn("Measurement detection fallback:", e);
      const fallbackM: BodyMeasurements = {
        shoulder: 44,
        chest: 94,
        waist: 78,
        hip: 96,
        height: 175,
        sleeveArc: 62,
        size: "M",
      };
      setMeasurements(fallbackM);
      return fallbackM;
    }
  };

  const trySareeOnMyBody = async (garmentId: string, garmentImageUrl: string, fallbackPhotoUri?: string) => {
    let fileToUse = personFile;
    let measToUse = measurements;

    if (!fileToUse && fallbackPhotoUri) {
      try {
        const resp = await fetch(fallbackPhotoUri);
        const blob = await resp.blob();
        fileToUse = new File([blob], "person.jpg", { type: blob.type || "image/jpeg" });
        setPersonFile(fileToUse);
        if (!measToUse) {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.src = fallbackPhotoUri;
          await img.decode();
          measToUse = await measureBodyFromPhoto(img, 175);
          setMeasurements(measToUse);
        }
      } catch (err) {
        console.warn("Fallback photo conversion:", err);
      }
    }

    if (!fileToUse) {
      return alert("Upload your full-body photo first");
    }

    if (!measToUse) {
      measToUse = {
        shoulder: 44,
        chest: 94,
        waist: 78,
        hip: 96,
        height: 175,
        sleeveArc: 62,
        size: "M",
      };
      setMeasurements(measToUse);
    }

    setLoading(true);
    try {
      const form = new FormData();
      form.append("person_image", fileToUse);
      form.append("garment_id", garmentId);
      form.append("garment_url", garmentImageUrl);
      form.append("measurements", JSON.stringify(measToUse)); // <-- Body structure sent

      const res = await fetch(`${API}/api/body-fit/tryon`, { method: "POST", body: form });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const { job_id } = await res.json();

      const poll = setInterval(async () => {
        try {
          const jobRes = await fetch(`${API}/api/body-fit/jobs/${job_id}`);
          if (!jobRes.ok) return;
          const job = await jobRes.json();
          if (job.status === "completed") {
            clearInterval(poll);
            setResultImage(API + job.result_url);
            setLoading(false);
          } else if (job.status === "failed") {
            clearInterval(poll);
            alert(job.error || "Body-fit drape failed");
            setLoading(false);
          }
        } catch {
          // continue polling
        }
      }, 3000);
    } catch (err) {
      setLoading(false);
      console.warn("Body try-on API call error:", err);
      alert("Start backend: uvicorn body_fit_api:app --port 8000");
    }
  };

  return { handleUpload, trySareeOnMyBody, personPreview, resultImage, measurements, loading };
}
