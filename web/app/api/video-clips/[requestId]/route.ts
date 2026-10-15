import { fal } from "@fal-ai/client";
import {
  configureFalClient,
  FAL_VIDEO_ENDPOINT,
} from "../../../../lib/fal-video";
import { ensureEncodedClip, hasEncodedClip } from "../../../../lib/clip-store";

export const runtime = "nodejs";

const REQUEST_ID_PATTERN = /^[\w-]{8,80}$/;
const GENERATION_ERROR = "Generazione non riuscita.";

type RouteContext = { params: Promise<{ requestId: string }> };

export async function GET(
  _request: Request,
  { params }: RouteContext,
): Promise<Response> {
  const { requestId } = await params;
  if (!REQUEST_ID_PATTERN.test(requestId)) {
    return Response.json({ error: "ID richiesta non valido." }, { status: 400 });
  }

  const videoUrl = `/api/video-clips/${encodeURIComponent(requestId)}/file`;
  try {
    if (await hasEncodedClip(requestId)) {
      return Response.json({ status: "done", videoUrl });
    }
  } catch {
    return Response.json({
      status: "error",
      error: "Conversione della clip non riuscita.",
    });
  }

  if (!configureFalClient()) {
    return Response.json({ error: "Generazione video non configurata." }, { status: 503 });
  }

  try {
    const status = await fal.queue.status(FAL_VIDEO_ENDPOINT, { requestId });
    switch (status.status as string) {
      case "IN_QUEUE":
        return Response.json({ status: "queued" });
      case "IN_PROGRESS":
        return Response.json({ status: "running" });
      case "COMPLETED": {
        const result = await fal.queue.result(FAL_VIDEO_ENDPOINT, { requestId });
        const sourceUrl = result.data.video?.url;
        if (!sourceUrl) {
          return Response.json({ status: "error", error: GENERATION_ERROR });
        }
        try {
          await ensureEncodedClip(requestId, sourceUrl);
          return Response.json({ status: "done", videoUrl });
        } catch {
          return Response.json({
            status: "error",
            error: "Conversione della clip non riuscita.",
          });
        }
      }
      case "FAILED":
      default:
        return Response.json({ status: "error", error: GENERATION_ERROR });
    }
  } catch {
    return Response.json({ error: "Impossibile verificare la generazione." }, { status: 502 });
  }
}
