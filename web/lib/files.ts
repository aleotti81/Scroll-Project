import type { FileRef } from "./schema";

export const IMAGE_MAX_BYTES = 15 * 1024 * 1024;
export const VIDEO_MAX_BYTES = 200 * 1024 * 1024;
export const VIDEO_MAX_SECONDS = 30;
export const RECOMMENDED_IMAGE_SIDE = 1600;

const imageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const videoTypes = new Set(["video/mp4", "video/quicktime", "video/webm"]);

export type FileCheck = { error?: string; warning?: string };

export function validateImageFile(file: Pick<File, "name" | "type" | "size">): FileCheck {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const accepted = imageTypes.has(file.type) || ["jpg", "jpeg", "png", "webp", "heic", "heif"].includes(extension ?? "");
  if (!accepted) return { error: "Formato non supportato. Usa JPG, PNG, WebP, HEIC o HEIF." };
  if (file.size > IMAGE_MAX_BYTES) return { error: "La foto deve pesare al massimo 15 MB." };
  return {};
}

export function validateVideoFile(file: Pick<File, "name" | "type" | "size">): FileCheck {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const accepted = videoTypes.has(file.type) || ["mp4", "mov", "webm"].includes(extension ?? "");
  if (!accepted) return { error: "Formato non supportato. Usa MP4, MOV o WebM." };
  if (file.size > VIDEO_MAX_BYTES) return { error: "Il video deve pesare al massimo 200 MB." };
  return {};
}

export function validateVideoDuration(durationSec: number): FileCheck {
  if (durationSec > VIDEO_MAX_SECONDS) return { error: "Il video deve durare al massimo 30 secondi." };
  return {};
}

export function imageResolutionWarning(width?: number, height?: number) {
  return width && height && Math.max(width, height) < RECOMMENDED_IMAGE_SIDE
    ? "La foto è sotto i 1600 px sul lato lungo: la qualità potrebbe risentirne."
    : undefined;
}

export function readImageDimensions(file: File): Promise<{ width?: number; height?: number }> {
  if (/\.hei[cf]$/i.test(file.name) || /image\/hei[cf]/i.test(file.type)) {
    return Promise.resolve({});
  }
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
      URL.revokeObjectURL(url);
    };
    image.onerror = () => {
      resolve({});
      URL.revokeObjectURL(url);
    };
    image.src = url;
  });
}

export function readVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const duration = video.duration;
      URL.revokeObjectURL(url);
      if (!Number.isFinite(duration)) reject(new Error("Durata video non leggibile."));
      else resolve(duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Impossibile leggere i metadati del video."));
    };
    video.src = url;
  });
}

export function toFileRef(file: File, dimensions: { width?: number; height?: number } = {}, durationSec?: number): FileRef {
  return {
    id: crypto.randomUUID(),
    name: file.name,
    type: file.type || "application/octet-stream",
    size: file.size,
    ...dimensions,
    ...(durationSec === undefined ? {} : { durationSec }),
  };
}
