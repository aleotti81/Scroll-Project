import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const FFMPEG_PATH = "/usr/bin/ffmpeg";
const FFPROBE_PATH = "/usr/bin/ffprobe";
const FRAME_SET_ID_PATTERN = /^[a-f0-9]{24}$/;
const pendingExtractions = new Map<string, Promise<FrameManifest>>();

export type FrameManifest = {
  count: number;
  width: number;
  height: number;
};

function runFile(
  executable: string,
  args: string[],
  encoding: BufferEncoding = "utf8",
): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      executable,
      args,
      { encoding, maxBuffer: 20 * 1024 * 1024 },
      (error, stdout) => {
        if (error) reject(error);
        else resolve(stdout as string);
      },
    );
  });
}

export function frameSetId(buffer: Buffer | Uint8Array): string {
  return createHash("sha256").update(buffer).digest("hex").slice(0, 24);
}

export function extractionFps(durationSec: number): number {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return 30;
  return Math.min(30, 150 / durationSec);
}

export function isValidFrameSetId(id: string): boolean {
  return FRAME_SET_ID_PATTERN.test(id);
}

export function isValidFrameIndex(index: number, count: number): boolean {
  return Number.isInteger(index) && index >= 1 && index <= count;
}

export function getFrameSetDirectory(id: string): string {
  if (!isValidFrameSetId(id)) throw new Error("ID del set di frame non valido.");
  return path.join(process.cwd(), ".generated-frames", id);
}

export function getFrameFilePath(id: string, index: number): string {
  if (!isValidFrameSetId(id)) throw new Error("ID del set di frame non valido.");
  if (!Number.isInteger(index) || index < 1) throw new Error("Indice del frame non valido.");
  return path.join(getFrameSetDirectory(id), `${String(index).padStart(4, "0")}.jpg`);
}

export async function readFrameManifest(id: string): Promise<FrameManifest | null> {
  const manifestPath = path.join(getFrameSetDirectory(id), "manifest.json");
  try {
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as FrameManifest;
    if (
      !Number.isInteger(manifest.count) || manifest.count < 1 ||
      !Number.isInteger(manifest.width) || manifest.width < 1 ||
      !Number.isInteger(manifest.height) || manifest.height < 1
    ) {
      throw new Error("Manifest dei frame non valido.");
    }
    return manifest;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function probeDuration(inputPath: string): Promise<number> {
  const output = await runFile(FFPROBE_PATH, [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    inputPath,
  ]);
  return Number.parseFloat(output);
}

async function probeDimensions(imagePath: string): Promise<{ width: number; height: number }> {
  const output = await runFile(FFPROBE_PATH, [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height",
    "-of",
    "json",
    imagePath,
  ]);
  const info = JSON.parse(output) as { streams?: Array<{ width?: number; height?: number }> };
  const width = info.streams?.[0]?.width;
  const height = info.streams?.[0]?.height;
  if (!width || !height) throw new Error("Dimensioni dei frame non disponibili.");
  return { width, height };
}

export function ensureFrames(id: string, inputPath: string): Promise<FrameManifest> {
  const outputDirectory = getFrameSetDirectory(id);
  const existing = pendingExtractions.get(id);
  if (existing) return existing;

  const extractionPromise = (async () => {
    const rootDirectory = path.dirname(outputDirectory);
    await mkdir(rootDirectory, { recursive: true });
    const cachedManifest = await readFrameManifest(id);
    if (cachedManifest) return cachedManifest;

    const temporaryDirectory = path.join(rootDirectory, `${id}.tmp-${randomUUID()}`);
    await mkdir(temporaryDirectory, { recursive: true });
    try {
      const fps = extractionFps(await probeDuration(inputPath));
      await runFile(FFMPEG_PATH, [
        "-y",
        "-i",
        inputPath,
        "-an",
        "-vf",
        `fps=${fps},scale='min(1600,iw)':-2`,
        "-q:v",
        "3",
        path.join(temporaryDirectory, "%04d.jpg"),
      ]);

      const frames = (await readdir(temporaryDirectory))
        .filter((name) => /^\d{4}\.jpg$/.test(name))
        .sort();
      if (!frames.length) throw new Error("FFmpeg non ha estratto frame.");
      const dimensions = await probeDimensions(path.join(temporaryDirectory, frames[0]));
      const manifest = { count: frames.length, ...dimensions };
      await writeFile(
        path.join(temporaryDirectory, "manifest.json"),
        `${JSON.stringify(manifest)}\n`,
      );
      await rename(temporaryDirectory, outputDirectory);
      return manifest;
    } catch (error) {
      await rm(temporaryDirectory, { recursive: true, force: true });
      const completedManifest = await readFrameManifest(id).catch(() => null);
      if (completedManifest) return completedManifest;
      throw error;
    }
  })();
  const trackedPromise = extractionPromise.finally(() => {
    if (pendingExtractions.get(id) === trackedPromise) {
      pendingExtractions.delete(id);
    }
  });
  pendingExtractions.set(id, trackedPromise);
  return trackedPromise;
}
