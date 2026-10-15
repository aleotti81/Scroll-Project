import { fal } from "@fal-ai/client";
import {
  configureFalClient,
  DEFAULT_MOTION_PROMPT,
  FAL_VIDEO_ENDPOINT,
} from "../../../lib/fal-video";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const INVALID_CLIP_MESSAGE = "Dati della clip non validi.";
const SERVICE_ERROR_MESSAGE = "Il servizio video non ha accettato la richiesta.";

function errorResponse(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

function isUploadFile(value: FormDataEntryValue | null): value is File {
  return typeof File !== "undefined" && value instanceof File;
}

function isValidImage(value: FormDataEntryValue | null): value is File {
  return (
    isUploadFile(value) &&
    IMAGE_TYPES.has(value.type) &&
    value.size <= MAX_IMAGE_BYTES
  );
}

export async function POST(request: Request): Promise<Response> {
  if (!configureFalClient()) {
    return errorResponse("Generazione video non configurata.", 503);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return errorResponse(INVALID_CLIP_MESSAGE, 400);
  }

  const startImage = form.get("startImage");
  const endImage = form.get("endImage");
  const durationSec = form.get("durationSec");
  const rawPrompt = form.get("prompt");

  if (
    !isValidImage(startImage) ||
    !isValidImage(endImage) ||
    (durationSec !== "5" && durationSec !== "10") ||
    (rawPrompt !== null && typeof rawPrompt !== "string")
  ) {
    return errorResponse(INVALID_CLIP_MESSAGE, 400);
  }

  const prompt = rawPrompt?.trim() ?? "";
  if (prompt.length > 600) {
    return errorResponse(INVALID_CLIP_MESSAGE, 400);
  }

  try {
    const [imageUrl, endImageUrl] = await Promise.all([
      fal.storage.upload(startImage),
      fal.storage.upload(endImage),
    ]);
    const queued = await fal.queue.submit(FAL_VIDEO_ENDPOINT, {
      input: {
        prompt: prompt || DEFAULT_MOTION_PROMPT,
        image_url: imageUrl,
        end_image_url: endImageUrl,
        duration: durationSec,
        resolution: "1080p",
        aspect_ratio: "16:9",
        generate_audio: false,
        camera_fixed: false,
      },
    });

    return Response.json({ requestId: queued.request_id });
  } catch {
    return errorResponse(SERVICE_ERROR_MESSAGE, 502);
  }
}
