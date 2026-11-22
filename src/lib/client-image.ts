const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const MAX_INPUT_BYTES = 12 * 1024 * 1024;
const MAX_EDGE = 960;
const JPEG_QUALITY = 0.82;

/**
 * Compress a gallery image in the browser and return a data URL.
 * Avoids Vercel "Request Entity Too Large" by never posting large files.
 */
export async function fileToDataUrl(file: File): Promise<string> {
  if (!ALLOWED.has(file.type)) {
    throw new Error("Only JPG, PNG, WEBP, or GIF images are allowed");
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error("Image must be under 12MB");
  }

  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not process image");

    ctx.drawImage(bitmap, 0, 0, width, height);

    const preferPng = file.type === "image/png" || file.type === "image/gif";
    const mime = preferPng ? "image/png" : "image/jpeg";
    const dataUrl = preferPng
      ? canvas.toDataURL("image/png")
      : canvas.toDataURL("image/jpeg", JPEG_QUALITY);

    if (!dataUrl.startsWith("data:image/")) {
      throw new Error("Could not process image");
    }
    // ~1.4MB data URL ceiling keeps Neon payloads reasonable
    if (dataUrl.length > 1.4 * 1024 * 1024) {
      const tighter = canvas.toDataURL("image/jpeg", 0.7);
      if (tighter.length > 1.4 * 1024 * 1024) {
        throw new Error("Image is still too large after compression — try another photo");
      }
      return tighter;
    }
    return dataUrl;
  } finally {
    bitmap.close();
  }
}

export async function readJsonSafe<T = unknown>(
  res: Response,
): Promise<{ ok: boolean; data: T | null; error: string | null }> {
  const text = await res.text();
  if (!text) {
    return {
      ok: res.ok,
      data: null,
      error: res.ok ? null : `Upload failed (${res.status})`,
    };
  }
  try {
    const data = JSON.parse(text) as T & { error?: string };
    return {
      ok: res.ok,
      data,
      error: res.ok
        ? null
        : (typeof data?.error === "string" && data.error) ||
          `Upload failed (${res.status})`,
    };
  } catch {
    const trimmed = text.trim();
    if (/request entity too large/i.test(trimmed)) {
      return {
        ok: false,
        data: null,
        error: "Image is too large for the server — try a smaller photo",
      };
    }
    return {
      ok: false,
      data: null,
      error: trimmed.slice(0, 120) || `Upload failed (${res.status})`,
    };
  }
}
