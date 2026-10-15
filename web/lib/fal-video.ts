import { fal } from "@fal-ai/client";

export const FAL_VIDEO_ENDPOINT = "fal-ai/bytedance/seedance/v1.5/pro/image-to-video";
export const DEFAULT_MOTION_PROMPT =
  "Smooth, slow cinematic gimbal dolly shot moving from the first frame to the last frame, constant speed, steady camera, no cuts, realistic, natural light, architecture and objects stay rigid and stable.";

export function configureFalClient(): boolean {
  if (!process.env.FAL_KEY) return false;
  fal.config({ credentials: process.env.FAL_KEY });
  return true;
}
