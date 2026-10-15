import { lookup } from "node:dns/promises";
import {
  request as httpRequest,
  type IncomingMessage,
  type RequestOptions,
} from "node:http";
import { request as httpsRequest } from "node:https";
import { isPrivateAddress, parseSiteChrome } from "@/lib/site-import";

export const runtime = "nodejs";

const MAX_REDIRECTS = 3;
const MAX_HTML_BYTES = 3 * 1024 * 1024;
const TIMEOUT_MS = 8_000;
const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

type ResolvedAddress = { address: string; family: number };

class BodyTooLargeError extends Error {}

function errorResponse(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

function parseHttpUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username !== "" ||
      url.password !== "" ||
      !url.hostname
    ) {
      return null;
    }

    return url;
  } catch {
    return null;
  }
}

function hasAllowedPort(url: URL): boolean {
  return url.port === "" || url.port === "80" || url.port === "443";
}

function raceWithAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(signal.reason);

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener("abort", onAbort);
      reject(signal.reason ?? new DOMException("Request timed out", "TimeoutError"));
    };

    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

async function resolvePublicAddresses(
  url: URL,
  signal: AbortSignal,
): Promise<ResolvedAddress[] | null> {
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = await raceWithAbort(lookup(hostname, { all: true }), signal);

  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    return null;
  }

  return addresses.sort((left, right) => Number(right.family === 4) - Number(left.family === 4));
}

function createPinnedLookup(
  addresses: ResolvedAddress[],
): NonNullable<RequestOptions["lookup"]> {
  return (_hostname, options, callback) => {
    const family = typeof options === "number" ? options : options.family;
    const matchingAddresses = family
      ? addresses.filter((address) => address.family === family)
      : addresses;
    const candidates = matchingAddresses.length ? matchingAddresses : addresses;

    if (typeof options !== "number" && options.all) {
      callback(null, candidates);
    } else {
      callback(null, candidates[0].address, candidates[0].family);
    }
  };
}

function requestPage(
  url: URL,
  addresses: ResolvedAddress[],
  signal: AbortSignal,
): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const options: RequestOptions = {
      headers: { "User-Agent": USER_AGENT },
      lookup: createPinnedLookup(addresses),
      signal,
    };
    const onResponse = (response: IncomingMessage) => resolve(response);
    const request =
      url.protocol === "https:"
        ? httpsRequest(url, options, onResponse)
        : httpRequest(url, options, onResponse);

    request.on("error", reject);
    request.end();
  });
}

async function readHtmlBody(response: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  try {
    for await (const chunk of response) {
      totalBytes += chunk.byteLength;
      if (totalBytes > MAX_HTML_BYTES) {
        response.destroy();
        throw new BodyTooLargeError();
      }

      chunks.push(chunk);
    }
  } catch (error) {
    response.destroy();
    throw error;
  }

  return Buffer.concat(chunks, totalBytes).toString("utf8");
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("URL non valido.", 400);
  }

  if (!body || typeof body !== "object" || !("url" in body) || typeof body.url !== "string") {
    return errorResponse("URL non valido.", 400);
  }

  let currentUrl = parseHttpUrl(body.url);
  if (!currentUrl) return errorResponse("URL non valido.", 400);

  const timeoutSignal = AbortSignal.timeout(TIMEOUT_MS);

  try {
    for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
      currentUrl = parseHttpUrl(currentUrl.href);
      if (!currentUrl) return errorResponse("Impossibile leggere il sito.", 422);

      const addresses = await resolvePublicAddresses(currentUrl, timeoutSignal);
      if (!addresses) {
        return errorResponse("Impossibile leggere il sito.", 422);
      }

      if (!hasAllowedPort(currentUrl)) {
        return redirectCount === 0
          ? errorResponse("URL non valido.", 400)
          : errorResponse("Impossibile leggere il sito.", 422);
      }

      const response = await requestPage(currentUrl, addresses, timeoutSignal);
      const statusCode = response.statusCode ?? 0;

      if (REDIRECT_STATUSES.has(statusCode)) {
        const locationHeader = response.headers.location;
        const location = Array.isArray(locationHeader) ? locationHeader[0] : locationHeader;
        if (!location || redirectCount === MAX_REDIRECTS) {
          response.destroy();
          return errorResponse("Impossibile leggere il sito.", 422);
        }

        try {
          currentUrl = new URL(location, currentUrl);
        } catch {
          response.destroy();
          return errorResponse("Impossibile leggere il sito.", 422);
        }

        response.destroy();
        if (!parseHttpUrl(currentUrl.href)) {
          return errorResponse("Impossibile leggere il sito.", 422);
        }
        continue;
      }

      if (statusCode < 200 || statusCode >= 300) {
        response.destroy();
        return errorResponse("Impossibile leggere il sito.", 422);
      }

      const contentTypeHeader = response.headers["content-type"];
      const contentType = Array.isArray(contentTypeHeader)
        ? contentTypeHeader[0]
        : contentTypeHeader ?? "";
      if (!/^text\/html(?:\s*;|$)/i.test(contentType)) {
        response.destroy();
        return errorResponse("Impossibile leggere il sito.", 422);
      }

      const contentLengthHeader = response.headers["content-length"];
      const contentLength = Number(
        Array.isArray(contentLengthHeader) ? contentLengthHeader[0] : contentLengthHeader,
      );
      if (Number.isFinite(contentLength) && contentLength > MAX_HTML_BYTES) {
        response.destroy();
        return errorResponse("Impossibile leggere il sito.", 422);
      }

      const html = await readHtmlBody(response);
      return Response.json(parseSiteChrome(html, currentUrl.href));
    }

    return errorResponse("Impossibile leggere il sito.", 422);
  } catch {
    if (timeoutSignal.aborted) {
      return errorResponse("Il sito non ha risposto in tempo.", 504);
    }
    return errorResponse("Impossibile leggere il sito.", 422);
  }
}
