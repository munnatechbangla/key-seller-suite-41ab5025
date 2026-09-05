/**
 * Browser-side image optimization for Media Library uploads.
 *
 * - Only raster images (png/jpeg/webp) are touched.
 * - SVG, GIF, PDF, video, and anything else are returned untouched.
 * - Longest side is capped at MAX_DIMENSION (aspect ratio preserved, never upscaled).
 * - Output is WebP; if WebP isn't supported or is larger than the original,
 *   the original file is returned unchanged.
 */

const MAX_DIMENSION = 1200;
const WEBP_QUALITY = 0.85;

const OPTIMIZABLE_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);

function canEncodeWebp(): boolean {
  try {
    const c = document.createElement("canvas");
    c.width = 1;
    c.height = 1;
    return c.toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    return false;
  }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image"));
    };
    img.src = url;
  });
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/webp", WEBP_QUALITY));
}

function webpName(name: string): string {
  return name.replace(/\.[^.]+$/, "") + ".webp";
}

export async function optimizeImageFile(file: File): Promise<File> {
  if (typeof document === "undefined") return file;
  if (!OPTIMIZABLE_TYPES.has(file.type)) return file;
  if (!canEncodeWebp()) return file;

  try {
    const img = await loadImage(file);
    const { naturalWidth: w, naturalHeight: h } = img;
    if (!w || !h) return file;

    const scale = Math.min(1, MAX_DIMENSION / Math.max(w, h));
    const targetW = Math.max(1, Math.round(w * scale));
    const targetH = Math.max(1, Math.round(h * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, targetW, targetH);

    const blob = await toBlob(canvas);
    if (!blob || blob.size === 0) return file;
    if (blob.size >= file.size && scale === 1) return file;

    return new File([blob], webpName(file.name), {
      type: "image/webp",
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}
