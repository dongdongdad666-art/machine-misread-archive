import type { VisualParameters } from "../../src/domain/archive.js";
import { deriveVisualParameters } from "../../src/generation/derive-parameters.js";
import { seedFromParts } from "../../src/generation/seeded-random.js";

const ALGORITHM_VERSION = "gap-v1";
const TEMPORARY_ALGORITHM_VERSION = "temporary-fixed-v1";
const GENERATION_ENGINE_VERSION = "residue-v1";
const TEMPORARY_GAP = 0.5;

const allowedRelations = new Set([
  "日常使用",
  "家人留下",
  "偶然发现",
  "收藏保存",
  "关系不确定",
]);
const allowedEmotions = new Set(["怀念", "归属", "温暖", "遗憾", "疏离", "陌生"]);
const ageByTimeRange: Record<string, number> = {
  "2020年代": 3,
  "2010年代": 12,
  "2000年代": 22,
  "1990年代": 32,
  "1980年代": 42,
  "1970年代及以前": 55,
  "年代不确定": 30,
};

export interface StoredAnalysis {
  id: string;
  machineCaption: string;
  uncertaintyCount: number;
}

export interface SavedGap {
  analysisId: string;
  semanticGap: number;
  algorithmVersion: typeof ALGORITHM_VERSION;
  generationSeed: number;
  generationEngineVersion: typeof GENERATION_ENGINE_VERSION;
  visualParameters: VisualParameters;
}

export interface GapDependencies {
  findAnalysis(analysisId: string): Promise<StoredAnalysis | null>;
  embedTexts(texts: string[], dimensions: 256): Promise<number[][]>;
  saveGap(record: SavedGap): Promise<void>;
}

export class EmbeddingProviderError extends Error {
  constructor(
    message = "Embedding provider unavailable",
    readonly providerStatus?: number,
    readonly providerCode?: string,
  ) {
    super(message);
    this.name = "EmbeddingProviderError";
  }
}

function json(status: number, body: Record<string, unknown>) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function cosineDistance(left: number[], right: number[]) {
  if (!left.length || left.length !== right.length) throw new EmbeddingProviderError();
  let dot = 0;
  let leftSquared = 0;
  let rightSquared = 0;
  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index];
    const rightValue = right[index];
    if (!Number.isFinite(leftValue) || !Number.isFinite(rightValue)) {
      throw new EmbeddingProviderError();
    }
    dot += leftValue * rightValue;
    leftSquared += leftValue * leftValue;
    rightSquared += rightValue * rightValue;
  }
  if (leftSquared === 0 || rightSquared === 0) throw new EmbeddingProviderError();
  return clamp01(1 - dot / (Math.sqrt(leftSquared) * Math.sqrt(rightSquared)));
}

function textLength(value: string) {
  return Array.from(value.trim()).length;
}

function validEmotionTags(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= 3 &&
    new Set(value).size === value.length &&
    value.every((tag) => typeof tag === "string" && allowedEmotions.has(tag))
  );
}

function parametersFor(
  semanticGap: number,
  analysis: StoredAnalysis,
  timeRange: string,
  emotionTags: string[],
) {
  const captionLength = Array.from(analysis.machineCaption).length;
  return deriveVisualParameters({
    semanticGap,
    uncertaintyCount: analysis.uncertaintyCount,
    ageYears: ageByTimeRange[timeRange] ?? ageByTimeRange["年代不确定"],
    emotionTags,
    contourComplexity: clamp01(0.35 + Math.min(0.35, captionLength / 240) + analysis.uncertaintyCount / 20),
    keywordConflict: semanticGap,
  });
}

function resultFor(
  mode: "measured" | "temporary",
  semanticGap: number,
  analysis: StoredAnalysis,
  input: { memoryText: string; timeRange: string; emotionTags: string[] },
) {
  const algorithmVersion = mode === "measured" ? ALGORITHM_VERSION : TEMPORARY_ALGORITHM_VERSION;
  return {
    mode,
    publishable: mode === "measured",
    semanticGap,
    algorithmVersion,
    generationSeed: seedFromParts([analysis.id, input.memoryText, algorithmVersion]),
    generationEngineVersion: GENERATION_ENGINE_VERSION,
    visualParameters: parametersFor(semanticGap, analysis, input.timeRange, input.emotionTags),
  };
}

export async function calculateGap(request: Request, deps: GapDependencies): Promise<Response> {
  if (request.method !== "POST") {
    return json(405, { code: "METHOD_NOT_ALLOWED", message: "仅支持 POST 请求。", retryable: false });
  }

  let body: {
    analysisId?: unknown;
    memoryText?: unknown;
    timeRange?: unknown;
    relation?: unknown;
    emotionTags?: unknown;
  };
  try {
    body = await request.json() as typeof body;
  } catch {
    return json(400, { code: "INVALID_REQUEST", message: "请求格式无效。", retryable: false });
  }

  if (typeof body.analysisId !== "string" || !body.analysisId.trim()) {
    return json(400, { code: "INVALID_ANALYSIS_ID", message: "缺少有效的分析记录。", retryable: false });
  }
  if (
    typeof body.memoryText !== "string" ||
    textLength(body.memoryText) < 20 ||
    textLength(body.memoryText) > 400
  ) {
    return json(400, {
      code: "INVALID_MEMORY",
      message: "记忆文本需要包含 20–400 个字符。",
      retryable: false,
    });
  }
  if (typeof body.relation !== "string" || !allowedRelations.has(body.relation)) {
    return json(400, { code: "INVALID_RELATION", message: "请选择有效的物件关系。", retryable: false });
  }
  if (!validEmotionTags(body.emotionTags)) {
    return json(400, {
      code: "INVALID_EMOTIONS",
      message: "最多选择三个不重复的有效情绪标签。",
      retryable: false,
    });
  }

  let analysis: StoredAnalysis | null;
  try {
    analysis = await deps.findAnalysis(body.analysisId);
  } catch {
    return json(503, {
      code: "GAP_STORAGE_UNAVAILABLE",
      message: "暂时无法读取机器解读，请稍后重试。",
      retryable: true,
    });
  }
  if (!analysis) {
    return json(404, {
      code: "ANALYSIS_NOT_FOUND",
      message: "没有找到对应的机器解读，请重新分析图片。",
      retryable: false,
    });
  }

  const input = {
    memoryText: body.memoryText.trim(),
    timeRange: typeof body.timeRange === "string" ? body.timeRange : "年代不确定",
    emotionTags: body.emotionTags,
  };

  let semanticGap: number;
  try {
    const embeddings = await deps.embedTexts([analysis.machineCaption, input.memoryText], 256);
    if (embeddings.length !== 2) throw new EmbeddingProviderError();
    semanticGap = Number(cosineDistance(embeddings[0], embeddings[1]).toFixed(12));
  } catch (error) {
    return json(503, {
      code: "EMBEDDING_UNAVAILABLE",
      message: "语义距离服务暂时不可用，已使用明确标注的临时参数。",
      retryable: true,
      ...(error instanceof EmbeddingProviderError && error.providerStatus
        ? { providerStatus: error.providerStatus }
        : {}),
      ...(error instanceof EmbeddingProviderError && error.providerCode
        ? { providerCode: error.providerCode }
        : {}),
      ...resultFor("temporary", TEMPORARY_GAP, analysis, input),
    });
  }

  const result = resultFor("measured", semanticGap, analysis, input);
  try {
    await deps.saveGap({
      analysisId: analysis.id,
      semanticGap,
      algorithmVersion: ALGORITHM_VERSION,
      generationSeed: result.generationSeed,
      generationEngineVersion: GENERATION_ENGINE_VERSION,
      visualParameters: result.visualParameters,
    });
  } catch {
    return json(503, {
      code: "GAP_STORAGE_UNAVAILABLE",
      message: "语义距离已计算，但暂时无法保存，请稍后重试。",
      retryable: true,
    });
  }

  return json(200, result);
}
