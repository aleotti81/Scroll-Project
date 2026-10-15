import { randomUUID } from "node:crypto";
import { access, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ensureEncodedClip,
  getClipFilePath,
} from "../lib/clip-store";

const execFileMock = vi.hoisted(() => vi.fn());

vi.mock("node:child_process", () => ({ execFile: execFileMock }));

let requestId: string;
let fetchMock: ReturnType<typeof vi.fn>;

function sourcePathFor(id: string): string {
  return path.join(path.dirname(getClipFilePath(id)), `${id}.src.mp4`);
}

function temporaryPathFor(id: string): string {
  return path.join(path.dirname(getClipFilePath(id)), `${id}.tmp.mp4`);
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function mockSuccessfulFfmpeg(): void {
  execFileMock.mockImplementation((
    _command: string,
    args: string[],
    _options: unknown,
    callback: (error: Error | null) => void,
  ) => {
    void writeFile(args.at(-1)!, "encoded clip").then(() => callback(null));
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  requestId = `req-${randomUUID()}`;
  fetchMock = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3])));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all([
    rm(getClipFilePath(requestId), { force: true }),
    rm(sourcePathFor(requestId), { force: true }),
    rm(temporaryPathFor(requestId), { force: true }),
  ]);
});

describe("ensureEncodedClip", () => {
  it("returns an existing clip without downloading or encoding", async () => {
    const outputPath = getClipFilePath(requestId);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, "cached clip");

    await expect(
      ensureEncodedClip(requestId, "https://video.fal.media/clip.mp4"),
    ).resolves.toBe(outputPath);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(execFileMock).not.toHaveBeenCalled();
  });

  it.each([
    "http://video.fal.media/clip.mp4",
    "https://fal.media/clip.mp4",
    "https://video.fal.media.attacker.example/clip.mp4",
  ])("rejects a source outside the fal.media HTTPS allow-list: %s", async (sourceUrl) => {
    await expect(ensureEncodedClip(requestId, sourceUrl)).rejects.toThrow();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(execFileMock).not.toHaveBeenCalled();
  });

  it("downloads and encodes using all-intra video arguments", async () => {
    mockSuccessfulFfmpeg();

    const outputPath = await ensureEncodedClip(
      requestId,
      "https://video.fal.media/clip.mp4",
    );

    expect(await fileExists(outputPath)).toBe(true);
    expect(await fileExists(sourcePathFor(requestId))).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [sourceUrl, requestOptions] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(sourceUrl.href).toBe("https://video.fal.media/clip.mp4");
    expect(requestOptions.redirect).toBe("manual");
    expect(requestOptions.signal).toBeInstanceOf(AbortSignal);
    const [command, args] = execFileMock.mock.calls[0] as [string, string[]];
    expect(command).toBe("/usr/bin/ffmpeg");
    expect(args).toEqual(expect.arrayContaining(["-an", "-g", "1", "-keyint_min", "1"]));
    expect(args.at(-1)).toBe(temporaryPathFor(requestId));
  });

  it("removes partial files when ffmpeg fails", async () => {
    execFileMock.mockImplementation((
      _command: string,
      args: string[],
      _options: unknown,
      callback: (error: Error | null) => void,
    ) => {
      void writeFile(args.at(-1)!, "partial output").then(() => {
        callback(new Error("mocked ffmpeg failure"));
      });
    });

    await expect(
      ensureEncodedClip(requestId, "https://video.fal.media/clip.mp4"),
    ).rejects.toThrow("mocked ffmpeg failure");

    expect(await fileExists(sourcePathFor(requestId))).toBe(false);
    expect(await fileExists(temporaryPathFor(requestId))).toBe(false);
  });

  it("deduplicates concurrent encodes for the same request", async () => {
    mockSuccessfulFfmpeg();
    let resolveFetch: ((response: Response) => void) | undefined;
    fetchMock.mockImplementation(
      () => new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      }),
    );

    const first = ensureEncodedClip(requestId, "https://video.fal.media/clip.mp4");
    const second = ensureEncodedClip(requestId, "https://video.fal.media/clip.mp4");
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    resolveFetch?.(new Response(new Uint8Array([1, 2, 3])));

    await expect(Promise.all([first, second])).resolves.toEqual([
      getClipFilePath(requestId),
      getClipFilePath(requestId),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(execFileMock).toHaveBeenCalledTimes(1);
  });

});
