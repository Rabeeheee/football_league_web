const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

/**
 * Server-side fallback. Prefer client compression via fileToDataUrl —
 * large multipart posts hit Vercel body limits ("Request Entity Too Large").
 */
export async function saveUploadedImage(file: File): Promise<string> {
  if (!ALLOWED.has(file.type)) {
    throw new Error("Only JPG, PNG, WEBP, or GIF images are allowed");
  }
  if (file.size > 1.5 * 1024 * 1024) {
    throw new Error("Image must be under 1.5MB — compress on device first");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  return `data:${file.type};base64,${buffer.toString("base64")}`;
}
