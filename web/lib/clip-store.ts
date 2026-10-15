import { execFile } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import { Readable, Transform } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { pipeline } from "node:stream/promises";
import path from "node:path";

const MAX_DOWNLOAD_BYTES = 200 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 60_000;
const MAX_REDIRECTS = 3;
const REQUEST_ID_PATTERN = /^[\w-]{8,80}$/;
const FFMPEG_PATH = "/usr/bin/ffmpeg";

const pendingEncodes = new Map<string, Promise<string>>();

function validateRequestId(requestId: string): void {
  if (!REQUEST_ID_PATTERN.test(requestId)) {
    throw new Error("ID richiesta non valido.");
  }
}

function parseFalUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("URL della clip non valido.");
  }

  if (
    url.protocol !== "https:" ||
    url.hostname.toLowerCase() === ".fal.media" ||
    !url.hostname.toLowerCase().endsWith(".fal.media") ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443")
  ) {
    throw new Error("Host della clip non consentito.");
  }

  return url;
}

async function downloadClip(sourceUrl: string, destination: string): Promise<void> {
  let currentUrl = parseFalUrl(sourceUrl);
  const signal = AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS);

  try {
    for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
      const response = await fetch(currentUrl, { redirect: "manual", signal });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location || redirectCount === MAX_REDIRECTS) {
          await response.body?.cancel();
          throw new Error("Redirect della clip non valido.");
        }
        currentUrl = parseFalUrl(new URL(location, currentUrl).href);
        await response.body?.cancel();
        continue;
      }

      if (!response.ok) {
        await response.body?.cancel();
        throw new Error("Download della clip non riuscito.");
      }

      const contentLength = Number(response.headers.get("content-length"));
      if (Number.isFinite(contentLength) && contentLength > MAX_DOWNLOAD_BYTES) {
        await response.body?.cancel();
        throw new Error("La clip supera la dimensione consentita.");
      }
      if (!response.body) throw new Error("Risposta della clip vuota.");

      let downloadedBytes = 0;
      const sizeLimit = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          downloadedBytes += chunk.length;
          if (downloadedBytes > MAX_DOWNLOAD_BYTES) {
            callback(new Error("La clip supera la dimensione consentita."));
            return;
          }
          callback(null, chunk);
        },
      });

      await pipeline(
        Readable.fromWeb(response.body as unknown as NodeReadableStream<Uint8Array>),
        sizeLimit,
        createWriteStream(destination, { flags: "wx" }),
      );
      return;
    }

    throw new Error("Troppi redirect per la clip.");
  } catch (error) {
    await rm(destination, { force: true }).catch(() => undefined);
    throw error;
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    return (await stat(filePath)).isFile();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function removePartialFiles(...paths: string[]): Promise<void> {
  await Promise.all(paths.map((filePath) => rm(filePath, { force: true }).catch(() => undefined)));
}

export function getClipFilePath(requestId: string): string {
  validateRequestId(requestId);
  return path.join(process.cwd(), ".generated-clips", `${requestId}.mp4`);
}

export async function hasEncodedClip(requestId: string): Promise<boolean> {
  return fileExists(getClipFilePath(requestId));
}

export function encodeClip(inputPath: string, outputPath: string): Promise<void> {
  const args = [
    "-y",
    "-i",
    inputPath,
    "-an",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "23",
    "-g",
    "1",
    "-keyint_min",
    "1",
    "-sc_threshold",
    "0",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    outputPath,
  ];

  return new Promise((resolve, reject) => {
    execFile(FFMPEG_PATH, args, { maxBuffer: 20 * 1024 * 1024 }, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

export function ensureEncodedClip(requestId: string, sourceUrl: string): Promise<string> {
  const outputPath = getClipFilePath(requestId);
  const existing = pendingEncodes.get(requestId);
  if (existing) return existing;

  const encodePromise = (async () => {
    const directory = path.dirname(outputPath);
    const sourcePath = path.join(directory, `${requestId}.src.mp4`);
    const temporaryPath = path.join(directory, `${requestId}.tmp.mp4`);

    await mkdir(directory, { recursive: true });
    if (await fileExists(outputPath)) return outputPath;

    try {
      await downloadClip(sourceUrl, sourcePath);
      await encodeClip(sourcePath, temporaryPath);
      await rename(temporaryPath, outputPath);
      return outputPath;
    } catch (error) {
      await removePartialFiles(sourcePath, temporaryPath);
      throw error;
    } finally {
      await removePartialFiles(sourcePath, temporaryPath);
    }
  })();
  const trackedPromise = encodePromise.finally(() => {
    if (pendingEncodes.get(requestId) === trackedPromise) {
      pendingEncodes.delete(requestId);
    }
  });

  pendingEncodes.set(requestId, trackedPromise);
  return trackedPromise;
}
