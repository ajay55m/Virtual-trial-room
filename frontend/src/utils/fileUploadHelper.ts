/**
 * AURA Virtual Fitting Room - Universal File & Document Processor
 * Handles standard images (JPEG, PNG, WEBP), Apple iPhone HEIC/HEIF photos,
 * and iPhone scanned documents / PDFs.
 */

const ALLOWED_EXTENSIONS = [
  'heic', 'heif', 'jpg', 'jpeg', 'png', 'webp', 'avif', 'pdf', 'bmp', 'tiff', 'gif'
];

export function isValidUploadFile(file: File): boolean {
  if (!file) return false;

  // Check MIME type
  if (file.type && (file.type.startsWith('image/') || file.type === 'application/pdf')) {
    return true;
  }

  // Check file extension (crucial for iPhone/Windows HEIC where MIME can be empty or octet-stream)
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext && ALLOWED_EXTENSIONS.includes(ext)) {
    return true;
  }

  return false;
}

export function isHeicFile(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase();
  return (
    ext === 'heic' ||
    ext === 'heif' ||
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    file.type === 'image/heif-sequence' ||
    file.type === 'image/heic-sequence'
  );
}

export function isPdfDocument(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase();
  return ext === 'pdf' || file.type === 'application/pdf';
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(blob);
  });
}

/**
 * Fallback to backend converter endpoint (/v1/tryon/convert-upload)
 * which leverages PyMuPDF and Pillow-HEIF.
 */
async function convertViaBackend(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch('/v1/tryon/convert-upload', {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `Server conversion failed with status ${res.status}`);
  }

  const data = await res.json();
  if (!data.dataUrl) {
    throw new Error('No dataUrl returned from converter');
  }
  return data.dataUrl;
}

/**
 * Universal file processor: converts any iPhone photo (HEIC/HEIF),
 * PDF document, or standard image into a browser-ready JPEG/PNG data URL.
 */
export async function processFileToDataUrl(file: File): Promise<string> {
  if (!isValidUploadFile(file)) {
    throw new Error('Please select a valid photo or document (JPEG, PNG, WEBP, Apple HEIC/HEIF, or PDF).');
  }

  // 1. If it's a PDF document (e.g. from iPhone Files or Notes document scan)
  if (isPdfDocument(file)) {
    return await convertViaBackend(file);
  }

  // 2. If it's an Apple HEIC/HEIF image
  if (isHeicFile(file)) {
    try {
      // Try fast on-device conversion with heic2any
      const heic2anyModule = await import('heic2any');
      const heic2any = heic2anyModule.default || heic2anyModule;
      const converted = await heic2any({
        blob: file,
        toType: 'image/jpeg',
        quality: 0.92,
      });
      const singleBlob = Array.isArray(converted) ? converted[0] : converted;
      return await blobToDataUrl(singleBlob);
    } catch (clientErr) {
      console.warn('Client-side HEIC conversion failed, falling back to backend converter:', clientErr);
      return await convertViaBackend(file);
    }
  }

  // 3. Standard image format (JPEG, PNG, WEBP, etc.)
  try {
    return await blobToDataUrl(file);
  } catch (readErr) {
    console.warn('Standard file reader failed, trying backend conversion:', readErr);
    return await convertViaBackend(file);
  }
}
