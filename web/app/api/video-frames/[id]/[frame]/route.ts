import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import {
  getFrameFilePath,
  isValidFrameIndex,
  isValidFrameSetId,
  readFrameManifest,
} from "../../../../../lib/frame-store";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string; frame: string }> };

export async function GET(
  _request: Request,
  { params }: RouteContext,
): Promise<Response> {
  const { id, frame } = await params;
  const frameIndex = /^\d+$/.test(frame) ? Number(frame) : Number.NaN;
  if (!isValidFrameSetId(id) || !Number.isInteger(frameIndex) || frameIndex < 1) {
    return Response.json({ error: "ID o indice del frame non valido." }, { status: 400 });
  }

  try {
    const manifest = await readFrameManifest(id);
    if (!manifest) {
      return Response.json({ error: "Frame non trovato." }, { status: 404 });
    }
    if (!isValidFrameIndex(frameIndex, manifest.count)) {
      return Response.json({ error: "Indice del frame non valido." }, { status: 400 });
    }

    const filePath = getFrameFilePath(id, frameIndex);
    const fileInfo = await stat(filePath);
    if (!fileInfo.isFile()) {
      return Response.json({ error: "Frame non trovato." }, { status: 404 });
    }

    return new Response(Readable.toWeb(createReadStream(filePath)) as unknown as BodyInit, {
      headers: {
        "content-type": "image/jpeg",
        "content-length": String(fileInfo.size),
        "cache-control": "private, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return Response.json({ error: "Frame non trovato." }, { status: 404 });
    }
    return Response.json({ error: "Impossibile leggere il frame." }, { status: 500 });
  }
}
