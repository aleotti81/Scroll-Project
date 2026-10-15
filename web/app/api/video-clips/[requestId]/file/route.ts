import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { getClipFilePath } from "../../../../../lib/clip-store";

export const runtime = "nodejs";

const REQUEST_ID_PATTERN = /^[\w-]{8,80}$/;

type RouteContext = { params: Promise<{ requestId: string }> };

export async function GET(
  _request: Request,
  { params }: RouteContext,
): Promise<Response> {
  const { requestId } = await params;
  if (!REQUEST_ID_PATTERN.test(requestId)) {
    return Response.json({ error: "ID richiesta non valido." }, { status: 400 });
  }

  try {
    const filePath = getClipFilePath(requestId);
    const fileInfo = await stat(filePath);
    if (!fileInfo.isFile()) {
      return Response.json({ error: "Clip non trovata." }, { status: 404 });
    }

    return new Response(Readable.toWeb(createReadStream(filePath)) as unknown as BodyInit, {
      headers: {
        "content-type": "video/mp4",
        "content-length": String(fileInfo.size),
        "cache-control": "private, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return Response.json({ error: "Clip non trovata." }, { status: 404 });
    }
    return Response.json({ error: "Impossibile leggere la clip." }, { status: 500 });
  }
}
