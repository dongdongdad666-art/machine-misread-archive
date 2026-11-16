import { createHash } from "node:crypto";

import {
  ProviderResponseError,
  ProviderTimeoutError,
  type ProviderAnalysis,
} from "./analyze-service.js";
import { EmbeddingProviderError } from "./gap-service.js";

const PROMPT_VERSION = "object-reading-v1";
const DEFAULT_SNAPSHOT = "qwen3-vl-flash-2026-01-22";
const DEFAULT_MODEL = DEFAULT_SNAPSHOT;
const DEFAULT_BASE_URL = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";

const SYSTEM_PROMPT = `你是“机器误读档案馆”的视觉观察员。只记录图像中可见或可谨慎推断的内容，不编造物件历史，不根据照片推断人物身份或敏感属性。请只输出一个 JSON 对象，不要 Markdown，不要解释，字段严格如下：
{"labels":["最多3个简短中文标签"],"caption":"一条客观中文描述","materials":["可见材质"],"visibleText":["确实能辨认的文字"],"uncertainties":["无法确认或容易误读之处"]}
labels 必须为 1 至 3 项。看不清的文字不要猜测，写入 uncertainties。materials、visibleText、uncertainties 可以是空数组。`;

interface QwenClientOptions {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  modelSnapshot?: string;
  timeoutMs?: number;
  fetcher?: typeof fetch;
}

interface QwenPayload {
  labels?: unknown;
  caption?: unknown;
  materials?: unknown;
  visibleText?: unknown;
  uncertainties?: unknown;
  confidence?: unknown;
}

function contentText(content: unknown) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return null;
  const text = content
    .filter((part): part is { type: string; text: string } => (
      typeof part === "object" && part !== null &&
      "type" in part && part.type === "text" &&
      "text" in part && typeof part.text === "string"
    ))
    .map((part) => part.text)
    .join("");
  return text || null;
}

function providerErrorCode(payload: unknown) {
  if (typeof payload !== "object" || payload === null) return undefined;
  const record = payload as Record<string, unknown>;
  const nested = typeof record.error === "object" && record.error !== null
    ? record.error as Record<string, unknown>
    : undefined;
  const code = record.code ?? nested?.code;
  return typeof code === "string" && /^[A-Za-z0-9_.-]{1,80}$/.test(code) ? code : undefined;
}

function parseModelJson(value: string): QwenPayload {
  const cleaned = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const parsed: unknown = JSON.parse(cleaned);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new ProviderResponseError();
    }
    return parsed as QwenPayload;
  } catch (error) {
    if (error instanceof ProviderResponseError) throw error;
    throw new ProviderResponseError();
  }
}

export function createQwenClient(options: QwenClientOptions) {
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const model = options.model ?? DEFAULT_MODEL;
  const modelSnapshot = options.modelSnapshot ?? DEFAULT_SNAPSHOT;
  const fetcher = options.fetcher ?? fetch;

  return async function analyzeWithQwen(image: {
    mimeType: "image/jpeg" | "image/png" | "image/webp";
    base64: string;
  }): Promise<ProviderAnalysis> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 25_000);
    try {
      const response = await fetcher(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${options.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [{
            role: "user",
            content: [
              { type: "image_url", image_url: { url: `data:${image.mimeType};base64,${image.base64}` } },
              { type: "text", text: SYSTEM_PROMPT },
            ],
          }],
          temperature: 0.1,
          max_tokens: 800,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorPayload: unknown = await response.json().catch(() => null);
        throw new ProviderResponseError(
          undefined,
          response.status,
          providerErrorCode(errorPayload),
        );
      }
      const rawText = await response.text();
      let envelope: { choices?: Array<{ message?: { content?: unknown } }> };
      try {
        envelope = JSON.parse(rawText) as typeof envelope;
      } catch {
        throw new ProviderResponseError();
      }
      const message = contentText(envelope.choices?.[0]?.message?.content);
      if (!message) throw new ProviderResponseError();
      const payload = parseModelJson(message);

      return {
        labels: payload.labels as string[],
        caption: payload.caption as string,
        materials: payload.materials as string[],
        visibleText: payload.visibleText as string[],
        uncertainties: payload.uncertainties as string[],
        confidence: payload.confidence,
        modelId: model,
        modelSnapshot,
        promptVersion: PROMPT_VERSION,
        rawResponseHash: createHash("sha256").update(rawText).digest("hex"),
      };
    } catch (error) {
      if (error instanceof ProviderResponseError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new ProviderTimeoutError();
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  };
}

export function createQwenEmbeddingClient(options: QwenClientOptions) {
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const fetcher = options.fetcher ?? fetch;

  return async function embedTexts(texts: string[], dimensions: 256): Promise<number[][]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 20_000);
    try {
      const response = await fetcher(`${baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${options.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: options.model ?? "text-embedding-v4",
          input: texts,
          dimensions,
          encoding_format: "float",
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const errorPayload: unknown = await response.json().catch(() => null);
        throw new EmbeddingProviderError(
          undefined,
          response.status,
          providerErrorCode(errorPayload),
        );
      }

      const payload: unknown = await response.json();
      if (
        typeof payload !== "object" || payload === null ||
        !("data" in payload) || !Array.isArray(payload.data)
      ) throw new EmbeddingProviderError(undefined, 200, "InvalidEmbeddingEnvelope");

      const rows = payload.data
        .map((row) => {
          if (
            typeof row !== "object" || row === null ||
            !("index" in row) || typeof row.index !== "number"
          ) throw new EmbeddingProviderError(undefined, 200, "InvalidEmbeddingRow");
          if (!("embedding" in row) || !Array.isArray(row.embedding)) {
            throw new EmbeddingProviderError(undefined, 200, "InvalidEmbeddingVector");
          }
          if (row.embedding.length !== dimensions) {
            throw new EmbeddingProviderError(undefined, 200, "InvalidEmbeddingDimension");
          }
          if (!row.embedding.every((value: unknown) => typeof value === "number" && Number.isFinite(value))) {
            throw new EmbeddingProviderError(undefined, 200, "InvalidEmbeddingValue");
          }
          return { index: row.index, embedding: row.embedding as number[] };
        })
        .sort((left, right) => left.index - right.index);

      if (
        rows.length !== texts.length ||
        rows.some((row, index) => row.index !== index)
      ) throw new EmbeddingProviderError(undefined, 200, "InvalidEmbeddingCount");
      return rows.map((row) => row.embedding);
    } catch (error) {
      if (error instanceof EmbeddingProviderError) throw error;
      throw new EmbeddingProviderError();
    } finally {
      clearTimeout(timeout);
    }
  };
}
