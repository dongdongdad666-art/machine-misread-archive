import type { MachineReading, VisualParameters } from "../domain/archive";
import { validateMachineReading } from "../domain/validation";
import type { ProcessedImage } from "./image-processing";

export type ApiErrorKind = "validation" | "quota" | "provider" | "unknown";

export class ApiError extends Error {
  readonly name = "ApiError";

  constructor(
    message: string,
    readonly kind: ApiErrorKind,
    readonly code: string,
    readonly retryable: boolean,
    readonly resetDate?: string,
  ) {
    super(message);
  }
}

interface ErrorBody {
  code?: unknown;
  message?: unknown;
  retryable?: unknown;
  resetDate?: unknown;
}

export interface GapRequest {
  analysisId: string;
  memoryText: string;
  timeRange: string;
  relation: string;
  emotionTags: string[];
}

export interface GapResult {
  mode: "measured" | "temporary";
  publishable: boolean;
  semanticGap: number;
  algorithmVersion: string;
  generationSeed: number;
  generationEngineVersion: "residue-v1";
  visualParameters: VisualParameters;
}

export interface SubmitArchiveRequest {
  submissionToken: string;
  analysisId: string;
  memoryText: string;
  timeRange: string;
  city: string;
  relation: string;
  emotionTags: string[];
  artifact: Blob;
  source?: Blob;
  publicationConsent: true;
  consentVersion: "publication-v1";
  publishArtifact: boolean;
  publishSource: boolean;
}

export interface SubmitArchiveResult {
  submissionId: string;
  accessionNo: string;
  status: "pending_review";
}

function kindForResponse(status: number, code: string): ApiErrorKind {
  if (status === 429) return "quota";
  if (status >= 400 && status < 500) return "validation";
  if (
    status === 502 || status === 504 ||
    code === "PROVIDER_TIMEOUT" || code === "INVALID_PROVIDER_RESPONSE"
  ) return "provider";
  return "unknown";
}

function toBase64(blob: Blob) {
  return blob.arrayBuffer().then((buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return btoa(binary);
  });
}

async function errorFromResponse(response: Response) {
  let body: ErrorBody = {};
  try {
    body = await response.json() as ErrorBody;
  } catch {
    // A non-JSON proxy error still becomes a useful typed error.
  }
  return errorFromBody(response.status, body);
}

function errorFromBody(status: number, body: ErrorBody) {
  const code = typeof body.code === "string" ? body.code : "UNKNOWN_ERROR";
  return new ApiError(
    typeof body.message === "string" ? body.message : "请求暂时无法完成。",
    kindForResponse(status, code),
    code,
    body.retryable === true,
    typeof body.resetDate === "string" ? body.resetDate : undefined,
  );
}

function validUnitNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function validVisualParameters(value: unknown): value is VisualParameters {
  if (typeof value !== "object" || value === null) return false;
  const parameters = value as Record<string, unknown>;
  return [
    "layerOffset",
    "fragmentation",
    "motionSpeed",
    "colorTemperature",
    "lineDensity",
    "textCollision",
  ].every((key) => validUnitNumber(parameters[key]));
}

function validGapResult(value: unknown): value is GapResult {
  if (typeof value !== "object" || value === null) return false;
  const result = value as Record<string, unknown>;
  return (
    (result.mode === "measured" || result.mode === "temporary") &&
    typeof result.publishable === "boolean" &&
    result.publishable === (result.mode === "measured") &&
    validUnitNumber(result.semanticGap) &&
    result.algorithmVersion === (
      result.mode === "measured" ? "gap-v1" : "temporary-fixed-v1"
    ) &&
    typeof result.generationSeed === "number" && Number.isInteger(result.generationSeed) &&
    result.generationSeed > 0 &&
    result.generationEngineVersion === "residue-v1" &&
    validVisualParameters(result.visualParameters)
  );
}

function validSubmitResult(value: unknown): value is SubmitArchiveResult {
  if (typeof value !== "object" || value === null) return false;
  const result = value as Record<string, unknown>;
  return (
    typeof result.submissionId === "string" && result.submissionId.length > 0 &&
    typeof result.accessionNo === "string" && /^MMA-\d{8}-[A-Z0-9]{8}$/.test(result.accessionNo) &&
    result.status === "pending_review"
  );
}

async function responseBody(response: Response) {
  try {
    return await response.json() as unknown;
  } catch {
    throw new ApiError("服务返回了无法读取的结果。", "unknown", "INVALID_RESPONSE", true);
  }
}

export const clientApi = {
  async analyze(
    image: ProcessedImage,
    consent: true,
    fetcher: typeof fetch = fetch,
  ): Promise<{ analysisId: string; reading: MachineReading }> {
    let response: Response;
    try {
      response = await fetcher("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          consent,
          image: {
            mimeType: image.mimeType,
            base64: await toBase64(image.blob),
          },
        }),
      });
    } catch {
      throw new ApiError("无法连接实时分析服务。", "unknown", "NETWORK_ERROR", true);
    }

    if (!response.ok) throw await errorFromResponse(response);

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new ApiError("分析服务返回了无法读取的结果。", "unknown", "INVALID_RESPONSE", true);
    }
    if (
      typeof body !== "object" || body === null ||
      !("analysisId" in body) || typeof body.analysisId !== "string" ||
      !("reading" in body) || !validateMachineReading(body.reading).ok
    ) {
      throw new ApiError("分析服务返回了无法读取的结果。", "unknown", "INVALID_RESPONSE", true);
    }
    return body as { analysisId: string; reading: MachineReading };
  },

  async calculateGap(
    input: GapRequest,
    fetcher: typeof fetch = fetch,
  ): Promise<GapResult> {
    let response: Response;
    try {
      response = await fetcher("/api/gap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          analysisId: input.analysisId,
          memoryText: input.memoryText,
          timeRange: input.timeRange,
          relation: input.relation,
          emotionTags: input.emotionTags,
        }),
      });
    } catch {
      throw new ApiError("无法连接语义距离服务。", "unknown", "NETWORK_ERROR", true);
    }

    const body = await responseBody(response);
    if (response.status === 503 && validGapResult(body) && body.mode === "temporary") {
      return body;
    }
    if (!response.ok) {
      throw errorFromBody(
        response.status,
        typeof body === "object" && body !== null ? body as ErrorBody : {},
      );
    }
    if (!validGapResult(body) || body.mode !== "measured") {
      throw new ApiError("语义距离服务返回了无法读取的结果。", "unknown", "INVALID_RESPONSE", true);
    }
    return body;
  },

  async submitArchive(
    input: SubmitArchiveRequest,
    fetcher: typeof fetch = fetch,
  ): Promise<SubmitArchiveResult> {
    let response: Response;
    try {
      const source = input.publishSource && input.source
        ? {
            mimeType: input.source.type,
            base64: await toBase64(input.source),
          }
        : undefined;
      response = await fetcher("/api/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          submissionToken: input.submissionToken,
          analysisId: input.analysisId,
          memoryText: input.memoryText,
          timeRange: input.timeRange,
          city: input.city,
          relation: input.relation,
          emotionTags: input.emotionTags,
          artifact: {
            mimeType: input.artifact.type,
            base64: await toBase64(input.artifact),
          },
          ...(source ? { source } : {}),
          publicationConsent: input.publicationConsent,
          consentVersion: input.consentVersion,
          publishArtifact: input.publishArtifact,
          publishSource: input.publishSource,
        }),
      });
    } catch {
      throw new ApiError("无法连接投稿服务。", "unknown", "NETWORK_ERROR", true);
    }

    if (!response.ok) throw await errorFromResponse(response);
    const body = await responseBody(response);
    if (!validSubmitResult(body)) {
      throw new ApiError("投稿服务返回了无法读取的结果。", "unknown", "INVALID_RESPONSE", true);
    }
    return body;
  },
};
