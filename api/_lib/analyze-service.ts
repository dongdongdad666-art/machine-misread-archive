import { Buffer } from "node:buffer";

import type { MachineReading } from "../../src/domain/archive.js";
import { validateMachineReading } from "../../src/domain/validation.js";

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const QUOTA_TIME_ZONE = "Asia/Shanghai";

export type SupportedMimeType = "image/jpeg" | "image/png" | "image/webp";

export interface ProviderAnalysis {
  labels: string[];
  caption: string;
  materials: string[];
  visibleText: string[];
  uncertainties: string[];
  confidence?: unknown;
  modelId: string;
  modelSnapshot: string;
  promptVersion: string;
  rawResponseHash: string;
}

export interface ModelRunRecord {
  modelId: string;
  modelSnapshot: string;
  promptVersion: string;
  rawResponseHash: string;
  reading: MachineReading;
  createdAt: string;
}

export interface AnalyzeDependencies {
  now(): Date;
  hashVisitor(identifier: string): Promise<string>;
  incrementQuota(visitorHash: string, quotaDate: string): Promise<number>;
  analyzeWithModel(image: { mimeType: SupportedMimeType; base64: string }): Promise<ProviderAnalysis>;
  saveRun(record: ModelRunRecord): Promise<{ id: string }>;
}

export class ProviderTimeoutError extends Error {
  constructor() {
    super("Provider request timed out");
    this.name = "ProviderTimeoutError";
  }
}

export class ProviderResponseError extends Error {
  constructor(
    message = "Provider returned an invalid response",
    readonly providerStatus?: number,
    readonly providerCode?: string,
  ) {
    super(message);
    this.name = "ProviderResponseError";
  }
}

function json(status: number, body: Record<string, unknown>) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

function dateInShanghai(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: QUOTA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function nextQuotaDate(date: Date) {
  return dateInShanghai(new Date(date.getTime() + 24 * 60 * 60 * 1000));
}

function visitorIdentifier(request: Request) {
  const forwarded = (
    request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-forwarded-for")
  )?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "local-anonymous";
}

export function decodeBase64(value: unknown) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(value)
  ) {
    return null;
  }

  return new Uint8Array(Buffer.from(value, "base64"));
}

export function hasImageSignature(bytes: Uint8Array, mimeType: SupportedMimeType) {
  if (mimeType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mimeType === "image/png") {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return bytes.length >= signature.length && signature.every((byte, index) => bytes[index] === byte);
  }
  return (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  );
}

function threeByteLittleEndian(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function imageDimensions(bytes: Uint8Array, mimeType: SupportedMimeType) {
  if (mimeType === "image/png") {
    if (bytes.length < 24 || String.fromCharCode(...bytes.slice(12, 16)) !== "IHDR") return null;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }

  if (mimeType === "image/jpeg") {
    const startOfFrameMarkers = new Set([
      0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
    ]);
    let offset = 2;
    while (offset + 8 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = bytes[offset + 1];
      if (startOfFrameMarkers.has(marker)) {
        return {
          height: (bytes[offset + 5] << 8) | bytes[offset + 6],
          width: (bytes[offset + 7] << 8) | bytes[offset + 8],
        };
      }
      if (marker === 0xd8 || marker === 0xd9) {
        offset += 2;
        continue;
      }
      const segmentLength = (bytes[offset + 2] << 8) | bytes[offset + 3];
      if (segmentLength < 2) return null;
      offset += segmentLength + 2;
    }
    return null;
  }

  const chunk = String.fromCharCode(...bytes.slice(12, 16));
  if (chunk === "VP8X" && bytes.length >= 30) {
    return {
      width: threeByteLittleEndian(bytes, 24) + 1,
      height: threeByteLittleEndian(bytes, 27) + 1,
    };
  }
  if (chunk === "VP8L" && bytes.length >= 25 && bytes[20] === 0x2f) {
    const bits = (
      bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24)
    ) >>> 0;
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (
    chunk === "VP8 " && bytes.length >= 30 &&
    bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a
  ) {
    return {
      width: (bytes[26] | (bytes[27] << 8)) & 0x3fff,
      height: (bytes[28] | (bytes[29] << 8)) & 0x3fff,
    };
  }
  return null;
}

function cleanString(value: unknown, maximumLength: number) {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maximumLength) return null;
  return cleaned;
}

function cleanStringArray(
  value: unknown,
  options: { maximumItems: number; maximumLength: number; allowEmpty?: boolean },
) {
  if (!Array.isArray(value) || value.length > options.maximumItems) return null;
  const cleaned = value.map((item) => cleanString(item, options.maximumLength));
  if (cleaned.some((item) => item === null)) return null;
  if (!options.allowEmpty && cleaned.length === 0) return null;
  return cleaned as string[];
}

function approvedReading(result: ProviderAnalysis): MachineReading {
  const labels = cleanStringArray(result.labels, { maximumItems: 3, maximumLength: 60 });
  const caption = cleanString(result.caption, 320);
  const materials = cleanStringArray(result.materials, {
    maximumItems: 8,
    maximumLength: 60,
    allowEmpty: true,
  });
  const visibleText = cleanStringArray(result.visibleText, {
    maximumItems: 8,
    maximumLength: 120,
    allowEmpty: true,
  });
  const uncertainties = cleanStringArray(result.uncertainties, {
    maximumItems: 6,
    maximumLength: 180,
    allowEmpty: true,
  });
  const modelId = cleanString(result.modelId, 120);
  const modelSnapshot = cleanString(result.modelSnapshot, 120);
  const promptVersion = cleanString(result.promptVersion, 80);

  if (
    !labels ||
    !caption ||
    !materials ||
    !visibleText ||
    !uncertainties ||
    !modelId ||
    !modelSnapshot ||
    !promptVersion
  ) {
    throw new ProviderResponseError();
  }

  const reading: MachineReading = {
    labels,
    caption,
    materials,
    visibleText,
    uncertainties,
    runMode: "single_live",
    modelId,
    modelSnapshot,
    promptVersion,
  };
  if (!validateMachineReading(reading).ok) throw new ProviderResponseError();
  return reading;
}

export async function analyzeImage(request: Request, deps: AnalyzeDependencies): Promise<Response> {
  if (request.method !== "POST") {
    return json(405, { code: "METHOD_NOT_ALLOWED", message: "仅支持 POST 请求。", retryable: false });
  }

  try {
    const body = await request.json() as {
      consent?: unknown;
      image?: { mimeType?: unknown; base64?: unknown };
    };

    if (body.consent !== true) {
      return json(403, {
        code: "CONSENT_REQUIRED",
        message: "需要明确同意后才能进行本次 AI 分析。",
        retryable: false,
      });
    }

    const mimeType = body.image?.mimeType;
    if (mimeType !== "image/jpeg" && mimeType !== "image/png" && mimeType !== "image/webp") {
      return json(415, {
        code: "UNSUPPORTED_IMAGE_TYPE",
        message: "仅支持 JPEG、PNG 或 WebP 图片。",
        retryable: false,
      });
    }

    const encodedImage = body.image?.base64;
    const bytes = decodeBase64(encodedImage);
    if (!bytes) {
      return json(400, { code: "INVALID_REQUEST", message: "图片数据无效。", retryable: false });
    }
    if (bytes.byteLength > MAX_IMAGE_BYTES) {
      return json(413, {
        code: "IMAGE_TOO_LARGE",
        message: "图片处理后仍超过 2MB，请换一张图片。",
        retryable: false,
      });
    }
    if (!hasImageSignature(bytes, mimeType)) {
      return json(415, {
        code: "INVALID_IMAGE_SIGNATURE",
        message: "图片内容与文件类型不匹配。",
        retryable: false,
      });
    }
    const dimensions = imageDimensions(bytes, mimeType);
    if (!dimensions || dimensions.width < 1 || dimensions.height < 1) {
      return json(415, {
        code: "INVALID_IMAGE",
        message: "无法读取图片尺寸，图片可能已损坏。",
        retryable: false,
      });
    }
    if (dimensions.width > 1600 || dimensions.height > 1600) {
      return json(413, {
        code: "IMAGE_DIMENSIONS_TOO_LARGE",
        message: "图片边长不能超过 1600 像素。",
        retryable: false,
      });
    }

    const now = deps.now();
    const quotaDate = dateInShanghai(now);
    const visitorHash = await deps.hashVisitor(visitorIdentifier(request));
    const quotaCount = await deps.incrementQuota(visitorHash, quotaDate);
    if (quotaCount > 3) {
      return json(429, {
        code: "DAILY_LIMIT",
        message: "今日的三次实时分析额度已用完。你仍可使用种子档案体验。",
        retryable: false,
        resetDate: nextQuotaDate(now),
      });
    }

    const result = await deps.analyzeWithModel({ mimeType, base64: encodedImage as string });
    const reading = approvedReading(result);
    const saved = await deps.saveRun({
      modelId: reading.modelId,
      modelSnapshot: reading.modelSnapshot,
      promptVersion: reading.promptVersion,
      rawResponseHash: result.rawResponseHash,
      reading,
      createdAt: now.toISOString(),
    });

    return json(200, { analysisId: saved.id, reading });
  } catch (error) {
    if (error instanceof ProviderTimeoutError) {
      return json(504, {
        code: "PROVIDER_TIMEOUT",
        message: "视觉模型响应超时，请稍后重试。",
        retryable: true,
      });
    }
    if (error instanceof ProviderResponseError) {
      return json(502, {
        code: "INVALID_PROVIDER_RESPONSE",
        message: "视觉模型返回了无法读取的结果，请稍后重试。",
        retryable: true,
        ...(error.providerStatus ? { providerStatus: error.providerStatus } : {}),
        ...(error.providerCode ? { providerCode: error.providerCode } : {}),
      });
    }
    if (error instanceof SyntaxError) {
      return json(400, { code: "INVALID_REQUEST", message: "请求格式无效。", retryable: false });
    }

    return json(500, {
      code: "ANALYSIS_UNAVAILABLE",
      message: "机器解读暂时不可用，请稍后重试。",
      retryable: true,
    });
  }
}
