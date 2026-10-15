import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ensureFrames, frameSetId } from "../../../lib/frame-store";

export const runtime = "nodejs";

const MAX_VIDEO_BYTES = 300 * 1024 * 1024;

function isUploadFile(value: FormDataEntryValue | null): value is File {
  return typeof File !== "undefined" && value instanceof File;
}

export async function POST(request: Request): Promise<Response> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Dati del video non validi." }, { status: 400 });
  }

  const video = form.get("video");
  if (
    !isUploadFile(video) ||
    !video.type.toLowerCase().startsWith("video/") ||
    video.size === 0
  ) {
    return Response.json({ error: "Carica un file video valido." }, { status: 400 });
  }
  if (video.size > MAX_VIDEO_BYTES) {
    return Response.json({ error: "Il video supera la dimensione consentita." }, { status: 413 });
  }

  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "scroll-video-frames-"));
  const inputPath = path.join(temporaryDirectory, "upload");
  try {
    const buffer = Buffer.from(await video.arrayBuffer());
    const id = frameSetId(buffer);
    await writeFile(inputPath, buffer);
    const manifest = await ensureFrames(id, inputPath);
    return Response.json({ id, ...manifest });
  } catch {
    return Response.json({ error: "Impossibile elaborare il video." }, { status: 500 });
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}
