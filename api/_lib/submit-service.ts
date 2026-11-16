import { Buffer } from "node:buffer";
import { inflateSync } from "node:zlib";

import type { VisualParameters } from "../../src/domain/archive.js";
import {
  decodeBase64,
  hasImageSignature,
  MAX_IMAGE_BYTES,
  type SupportedMimeType,
} from "./analyze-service.js";

const CONSENT_VERSION = "publication-v1";
const MAX_ARTIFACT_BYTES = 2 * 1024 * 1024;
const MAX_SUBMISSION_BODY_BYTES = 6 * 1024 * 1024;
const allowedRelations = new Set([
  "日常使用",
  "家人留下",
  "偶然发现",
  "收藏保存",
  "关系不确定",
]);
const allowedEmotions = new Set(["怀念", "归属", "温暖", "遗憾", "疏离", "陌生"]);
const allowedTimeRanges = new Set([
  "2020年代",
  "2010年代",
  "2000年代",
  "1990年代",
  "1980年代",
  "1970年代及以前",
  "年代不确定",
]);

export interface SubmissionAnalysis {
  id: string;
  archiveItemId: string | null;
  labels: string[];
  semanticGap: number | null;
  gapAlgorithmVersion: string | null;
  generationSeed: number | null;
  generationEngineVersion: string | null;
  visualParameters: VisualParameters | null;
}

export interface PendingArchiveRecord {
  analysisId: string;
  accessionNo: string;
  submissionToken: string;
  status: "pending_review";
  objectName: string;
  timeRange: string;
  city: string | null;
  memoryText: string;
  relation: string;
  emotionTags: string[];
  sourceVisibility: "private" | "public";
  artifactVisibility: "private" | "public_requested";
  consentVersion: typeof CONSENT_VERSION;
  sourcePath: string | null;
  artifactPath: string;
}

export interface SubmitDependencies {
  now(): Date;
  createAttemptId(): string;
  findAnalysis(analysisId: string): Promise<SubmissionAnalysis | null>;
  uploadPrivateObject(path: string, bytes: Uint8Array, contentType: string): Promise<void>;
  removePrivateObjects(paths: string[]): Promise<void>;
  findArchiveByToken(token: string): Promise<{
    id: string;
    accessionNo: string;
    analysisId: string;
    artifactPath: string;
    sourcePath: string | null;
  } | null>;
  createPendingArchive(record: PendingArchiveRecord): Promise<{
    id: string;
    accessionNo: string;
    artifactPath: string;
    sourcePath: string | null;
  }>;
}

function json(status: number, body: Record<string, unknown>) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

function textLength(value: string) {
  return Array.from(value.trim()).length;
}

function validEmotions(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= 3 &&
    new Set(value).size === value.length &&
    value.every((tag) => typeof tag === "string" && allowedEmotions.has(tag))
  );
}

function validParameters(value: VisualParameters | null): value is VisualParameters {
  if (!value) return false;
  return Object.values(value).length === 6 && Object.values(value).every(
    (entry) => typeof entry === "number" && Number.isFinite(entry) && entry >= 0 && entry <= 1,
  );
}

function dateStamp(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}${part("month")}${part("day")}`;
}

async function readRequestBody(request: Request) {
  if (!request.body) return { kind: "invalid" as const };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    byteLength += value.byteLength;
    if (byteLength > MAX_SUBMISSION_BODY_BYTES) {
      await reader.cancel();
      return { kind: "too_large" as const };
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return { kind: "invalid" as const };
    }
    return { kind: "ok" as const, value: value as Record<string, unknown> };
  } catch {
    return { kind: "invalid" as const };
  }
}

function sourceImage(value: unknown) {
  if (typeof value !== "object" || value === null) return null;
  const image = value as { mimeType?: unknown; base64?: unknown };
  if (
    image.mimeType !== "image/jpeg" &&
    image.mimeType !== "image/png" &&
    image.mimeType !== "image/webp"
  ) return null;
  if (
    typeof image.base64 !== "string" ||
    image.base64.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4
  ) return null;
  const bytes = decodeBase64(image.base64);
  if (!bytes || bytes.byteLength > MAX_IMAGE_BYTES || !hasImageSignature(bytes, image.mimeType)) {
    return null;
  }
  return { bytes, mimeType: image.mimeType as SupportedMimeType };
}

function artifactImage(value: unknown) {
  if (typeof value !== "object" || value === null) return null;
  const image = value as { mimeType?: unknown; base64?: unknown };
  if (image.mimeType !== "image/png") return null;
  if (
    typeof image.base64 !== "string" ||
    image.base64.length > Math.ceil(MAX_ARTIFACT_BYTES / 3) * 4
  ) return null;
  const bytes = decodeBase64(image.base64);
  if (!bytes || bytes.byteLength > MAX_ARTIFACT_BYTES || !validPngStructure(bytes)) {
    return null;
  }
  return { bytes, mimeType: "image/png" as const };
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function validPngStructure(bytes: Uint8Array) {
  if (!hasImageSignature(bytes, "image/png") || bytes.byteLength < 45) return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8;
  let hasHeader = false;
  let width = 0;
  let height = 0;
  let channels = 0;
  const imageData: Buffer[] = [];
  while (offset + 12 <= bytes.byteLength) {
    const length = view.getUint32(offset);
    const end = offset + 12 + length;
    if (end > bytes.byteLength) return false;
    const type = String.fromCharCode(...bytes.slice(offset + 4, offset + 8));
    const expectedCrc = view.getUint32(offset + 8 + length);
    if (crc32(bytes.slice(offset + 4, offset + 8 + length)) !== expectedCrc) return false;
    if (!hasHeader) {
      if (type !== "IHDR" || length !== 13) return false;
      width = view.getUint32(offset + 8);
      height = view.getUint32(offset + 12);
      if (width < 1 || height < 1 || width > 4096 || height > 4096) return false;
      const bitDepth = bytes[offset + 16];
      const colorType = bytes[offset + 17];
      if (
        bitDepth !== 8 ||
        bytes[offset + 18] !== 0 ||
        bytes[offset + 19] !== 0 ||
        bytes[offset + 20] !== 0
      ) return false;
      channels = colorType === 0 ? 1 : colorType === 2 ? 3 : colorType === 4 ? 2 : colorType === 6 ? 4 : 0;
      if (!channels) return false;
      hasHeader = true;
    }
    if (type === "IDAT") imageData.push(Buffer.from(bytes.slice(offset + 8, offset + 8 + length)));
    if (type === "IEND") {
      if (length !== 0 || end !== bytes.byteLength || !hasHeader || !imageData.length) return false;
      const expectedBytes = height * (1 + width * channels);
      try {
        return inflateSync(Buffer.concat(imageData), { maxOutputLength: expectedBytes }).byteLength === expectedBytes;
      } catch {
        return false;
      }
    }
    offset = end;
  }
  return false;
}

function sourceExtension(mimeType: SupportedMimeType) {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  return "webp";
}

function sameObjectPaths(
  saved: { artifactPath: string; sourcePath: string | null },
  artifactPath: string,
  sourcePath: string | null,
) {
  return saved.artifactPath === artifactPath && saved.sourcePath === sourcePath;
}

async function cleanup(deps: SubmitDependencies, paths: string[]) {
  if (!paths.length) return;
  try {
    await deps.removePrivateObjects(paths);
  } catch {
    // The original persistence failure remains the actionable response.
  }
}

export async function submitArchive(
  request: Request,
  deps: SubmitDependencies,
): Promise<Response> {
  if (request.method !== "POST") {
    return json(405, { code: "METHOD_NOT_ALLOWED", message: "仅支持 POST 请求。", retryable: false });
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_SUBMISSION_BODY_BYTES) {
    return json(413, { code: "REQUEST_TOO_LARGE", message: "投稿数据超过大小限制。", retryable: false });
  }

  const parsed = await readRequestBody(request);
  if (parsed.kind === "too_large") {
    return json(413, { code: "REQUEST_TOO_LARGE", message: "投稿数据超过大小限制。", retryable: false });
  }
  if (parsed.kind === "invalid") {
    return json(400, { code: "INVALID_REQUEST", message: "请求格式无效。", retryable: false });
  }
  const body = parsed.value;

  if (body.publicationConsent !== true || body.consentVersion !== CONSENT_VERSION) {
    return json(400, {
      code: "PUBLICATION_CONSENT_REQUIRED",
      message: "需要确认当前公开授权文本后才能投稿。",
      retryable: false,
    });
  }
  if (body.publishArtifact !== true) {
    return json(400, {
      code: "ARTIFACT_PUBLICATION_REQUIRED",
      message: "投稿需要申请公开生成作品与记忆；原始照片仍可保持私密。",
      retryable: false,
    });
  }
  if (typeof body.publishSource !== "boolean") {
    return json(400, { code: "INVALID_PUBLICATION_SCOPE", message: "原始照片公开范围无效。", retryable: false });
  }
  if (typeof body.analysisId !== "string" || !body.analysisId.trim()) {
    return json(400, { code: "INVALID_ANALYSIS_ID", message: "缺少有效的分析记录。", retryable: false });
  }
  if (
    typeof body.submissionToken !== "string" ||
    !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(body.submissionToken)
  ) {
    return json(400, { code: "INVALID_SUBMISSION_TOKEN", message: "投稿令牌无效。", retryable: false });
  }
  let existingSubmission: Awaited<ReturnType<SubmitDependencies["findArchiveByToken"]>>;
  try {
    existingSubmission = await deps.findArchiveByToken(body.submissionToken);
  } catch {
    return json(503, {
      code: "SUBMISSION_STATE_UNKNOWN",
      message: "暂时无法确认投稿令牌状态。",
      retryable: true,
    });
  }
  if (existingSubmission) {
    if (existingSubmission.analysisId !== body.analysisId) {
      return json(409, {
        code: "SUBMISSION_TOKEN_CONFLICT",
        message: "该投稿令牌已绑定其他分析记录。",
        retryable: false,
      });
    }
    return json(201, {
      submissionId: existingSubmission.id,
      accessionNo: existingSubmission.accessionNo,
      status: "pending_review",
    });
  }
  const artifact = artifactImage(body.artifact);
  if (!artifact) {
    return json(400, { code: "INVALID_ARTIFACT", message: "生成作品必须是有效的 PNG。", retryable: false });
  }
  const source = body.publishSource === true ? sourceImage(body.source) : null;
  if (body.publishSource === true && !source) {
    return json(400, { code: "INVALID_SOURCE", message: "公开原始照片需要有效的源图。", retryable: false });
  }
  if (
    typeof body.memoryText !== "string" ||
    textLength(body.memoryText) < 20 ||
    textLength(body.memoryText) > 400 ||
    typeof body.timeRange !== "string" ||
    !allowedTimeRanges.has(body.timeRange) ||
    typeof body.city !== "string" ||
    Array.from(body.city.trim()).length > 60 ||
    typeof body.relation !== "string" ||
    !allowedRelations.has(body.relation) ||
    !validEmotions(body.emotionTags)
  ) {
    return json(400, { code: "INVALID_ARCHIVE_DATA", message: "档案描述字段无效。", retryable: false });
  }

  let analysis: SubmissionAnalysis | null;
  try {
    analysis = await deps.findAnalysis(body.analysisId);
  } catch {
    return json(503, { code: "SUBMISSION_STORAGE_UNAVAILABLE", message: "暂时无法读取分析记录。", retryable: true });
  }
  if (!analysis) {
    return json(404, { code: "ANALYSIS_NOT_FOUND", message: "未找到对应的分析记录。", retryable: false });
  }
  if (analysis.archiveItemId) {
    return json(409, { code: "ALREADY_SUBMITTED", message: "这次分析已由另一项请求提交入档。", retryable: false });
  }
  if (
    analysis.semanticGap === null ||
    analysis.generationSeed === null ||
    analysis.generationEngineVersion === null ||
    analysis.visualParameters === null
  ) {
    return json(409, { code: "GAP_REQUIRED", message: "请先完成真实语义距离计算。", retryable: false });
  }
  if (
    analysis.gapAlgorithmVersion !== "gap-v1" ||
    analysis.generationEngineVersion !== "residue-v1" ||
    analysis.semanticGap < 0 ||
    analysis.semanticGap > 1 ||
    !validParameters(analysis.visualParameters)
  ) {
    return json(409, { code: "GAP_NOT_PUBLISHABLE", message: "临时生成结果不能申请入档。", retryable: false });
  }

  const token = body.submissionToken;
  const attemptId = deps.createAttemptId();
  const accessionNo = `MMA-${dateStamp(deps.now())}-${token.replaceAll("-", "").slice(0, 8).toUpperCase()}`;
  const artifactPath = `pending-artifacts/${token}/${attemptId}/artifact.png`;
  const sourcePath = source
    ? `pending-sources/${token}/${attemptId}/source.${sourceExtension(source.mimeType)}`
    : null;
  const uploaded: string[] = [];
  try {
    uploaded.push(artifactPath);
    await deps.uploadPrivateObject(artifactPath, artifact.bytes, artifact.mimeType);
    if (source && sourcePath) {
      uploaded.push(sourcePath);
      await deps.uploadPrivateObject(sourcePath, source.bytes, source.mimeType);
    }
  } catch {
    await cleanup(deps, uploaded);
    return json(503, { code: "OBJECT_STORAGE_UNAVAILABLE", message: "暂时无法保存投稿文件。", retryable: true });
  }

  try {
    const saved = await deps.createPendingArchive({
      analysisId: analysis.id,
      accessionNo,
      submissionToken: token,
      status: "pending_review",
      objectName: analysis.labels[0]?.trim() || "未命名物件",
      timeRange: body.timeRange,
      city: body.city.trim() || null,
      memoryText: body.memoryText.trim(),
      relation: body.relation,
      emotionTags: body.emotionTags,
      sourceVisibility: body.publishSource === true ? "public" : "private",
      artifactVisibility: body.publishArtifact === true ? "public_requested" : "private",
      consentVersion: CONSENT_VERSION,
      sourcePath,
      artifactPath,
    });
    if (!sameObjectPaths(saved, artifactPath, sourcePath)) {
      await cleanup(deps, uploaded);
    }
    return json(201, {
      submissionId: saved.id,
      accessionNo: saved.accessionNo,
      status: "pending_review",
    });
  } catch {
    let committed: Awaited<ReturnType<SubmitDependencies["findArchiveByToken"]>>;
    try {
      committed = await deps.findArchiveByToken(token);
    } catch {
      return json(503, {
        code: "SUBMISSION_STATE_UNKNOWN",
        message: "投稿状态暂时无法确认，请保留本页稍后查询。",
        retryable: true,
      });
    }
    if (committed) {
      if (committed.analysisId !== analysis.id) {
        await cleanup(deps, uploaded);
        return json(409, {
          code: "SUBMISSION_TOKEN_CONFLICT",
          message: "该投稿令牌已绑定其他分析记录。",
          retryable: false,
        });
      }
      if (!sameObjectPaths(committed, artifactPath, sourcePath)) {
        await cleanup(deps, uploaded);
      }
      return json(201, {
        submissionId: committed.id,
        accessionNo: committed.accessionNo,
        status: "pending_review",
      });
    }
    await cleanup(deps, uploaded);
    return json(503, { code: "SUBMISSION_STORAGE_UNAVAILABLE", message: "投稿暂时无法入库。", retryable: true });
  }
}
