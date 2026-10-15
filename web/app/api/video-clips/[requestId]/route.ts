import { fal } from "@fal-ai/client";
import {
  configureFalClient,
  FAL_VIDEO_ENDPOINT,
} from "../../../../lib/fal-video";

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
        const videoUrl = result.data.video?.url;
        return videoUrl
          ? Response.json({ status: "done", videoUrl })
          : Response.json({ status: "error", error: GENERATION_ERROR });
      }
      case "FAILED":
      default:
        return Response.json({ status: "error", error: GENERATION_ERROR });
    }
  } catch {
    return Response.json({ error: "Impossibile verificare la generazione." }, { status: 502 });
  }
}
