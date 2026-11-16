import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  ProviderResponseError,
  ProviderTimeoutError,
  analyzeImage,
  type AnalyzeDependencies,
  type ProviderAnalysis,
} from "../../api/_lib/analyze-service";
import { createQwenClient } from "../../api/_lib/qwen-client";
import { ApiError, clientApi } from "../../src/lib/api";

function webpBytes(width = 800, height = 600) {
  const bytes = new Uint8Array(30);
  bytes.set([0x52, 0x49, 0x46, 0x46, 0x16, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
  bytes.set([0x56, 0x50, 0x38, 0x58, 0x0a, 0x00, 0x00, 0x00], 12);
  const widthMinusOne = width - 1;
  const heightMinusOne = height - 1;
  bytes.set([
    widthMinusOne & 0xff,
    (widthMinusOne >> 8) & 0xff,
    (widthMinusOne >> 16) & 0xff,
    heightMinusOne & 0xff,
    (heightMinusOne >> 8) & 0xff,
    (heightMinusOne >> 16) & 0xff,
  ], 24);
  return bytes;
}

function pngBytes(width = 800, height = 600) {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  bytes.set([0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52], 8);
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);
  return bytes;
}

function jpegBytes(width = 800, height = 600) {
  const bytes = new Uint8Array(21);
  bytes.set([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08]);
  new DataView(bytes.buffer).setUint16(7, height);
  new DataView(bytes.buffer).setUint16(9, width);
  return bytes;
}

const WEBP_BYTES = webpBytes();

function base64(bytes = WEBP_BYTES) {
  return Buffer.from(bytes).toString("base64");
}

function request(overrides: Record<string, unknown> = {}) {
  return new Request("https://archive.test/api/analyze", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.8, 10.0.0.1",
    },
    body: JSON.stringify({
      consent: true,
      image: { mimeType: "image/webp", base64: base64() },
      ...overrides,
    }),
  });
}

const providerResult: ProviderAnalysis = {
  labels: ["旧字典", "纸质工具书"],
  caption: "一本封面开裂并缠有透明胶带的红色小字典。",
  materials: ["纸", "塑料胶带", "油墨"],
  visibleText: ["新华字典", "2003年修订本"],
  uncertainties: ["无法从单张照片确认具体印次"],
  confidence: 0.94,
  modelId: "qwen3-vl-flash",
  modelSnapshot: "qwen3-vl-flash-2026-01-22",
  promptVersion: "object-reading-v1",
  rawResponseHash: "response-hash",
};

function dependencies(overrides: Partial<AnalyzeDependencies> = {}): AnalyzeDependencies {
  return {
    now: () => new Date("2026-09-10T04:00:00.000Z"),
    hashVisitor: vi.fn(async () => "visitor-hash"),
    incrementQuota: vi.fn(async () => 1),
    analyzeWithModel: vi.fn(async () => providerResult),
    saveRun: vi.fn(async () => ({ id: "analysis-01" })),
    ...overrides,
  };
}

describe("POST /api/analyze", () => {
  it("rejects a request without explicit analysis consent", async () => {
    const deps = dependencies();
    const response = await analyzeImage(request({ consent: false }), deps);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: "CONSENT_REQUIRED" });
    expect(deps.incrementQuota).not.toHaveBeenCalled();
  });

  it("rejects bytes whose signature does not match the declared MIME type", async () => {
    const deps = dependencies();
    const response = await analyzeImage(
      request({ image: { mimeType: "image/webp", base64: base64(new TextEncoder().encode("not webp")) } }),
      deps,
    );

    expect(response.status).toBe(415);
    await expect(response.json()).resolves.toMatchObject({ code: "INVALID_IMAGE_SIGNATURE" });
    expect(deps.incrementQuota).not.toHaveBeenCalled();
  });

  it("rejects decoded image payloads over 2MB", async () => {
    const oversized = new Uint8Array(2 * 1024 * 1024 + 1);
    oversized.set(WEBP_BYTES);
    const deps = dependencies();
    const response = await analyzeImage(
      request({ image: { mimeType: "image/webp", base64: base64(oversized) } }),
      deps,
    );

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({ code: "IMAGE_TOO_LARGE" });
    expect(deps.incrementQuota).not.toHaveBeenCalled();
  });

  it.each([
    ["image/webp", webpBytes(1601, 900)],
    ["image/png", pngBytes(1601, 900)],
    ["image/jpeg", jpegBytes(1601, 900)],
  ] as const)("rejects oversized %s pixel dimensions", async (mimeType, bytes) => {
    const deps = dependencies();
    const response = await analyzeImage(
      request({ image: { mimeType, base64: base64(bytes) } }),
      deps,
    );

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({ code: "IMAGE_DIMENSIONS_TOO_LARGE" });
    expect(deps.incrementQuota).not.toHaveBeenCalled();
  });

  it("rejects the fourth request before calling the provider", async () => {
    const deps = dependencies({ incrementQuota: vi.fn(async () => 4) });
    const response = await analyzeImage(request(), deps);

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({
      code: "DAILY_LIMIT",
      message: "今日的三次实时分析额度已用完。你仍可使用种子档案体验。",
      retryable: false,
      resetDate: "2026-09-11",
    });
    expect(deps.analyzeWithModel).not.toHaveBeenCalled();
  });

  it("returns only approved machine-reading fields", async () => {
    const deps = dependencies();
    const response = await analyzeImage(request(), deps);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      analysisId: "analysis-01",
      reading: {
        labels: providerResult.labels,
        caption: providerResult.caption,
        materials: providerResult.materials,
        visibleText: providerResult.visibleText,
        uncertainties: providerResult.uncertainties,
        runMode: "single_live",
        modelId: providerResult.modelId,
        modelSnapshot: providerResult.modelSnapshot,
        promptVersion: providerResult.promptVersion,
      },
    });
    expect(body.reading).not.toHaveProperty("confidence");
    expect(deps.saveRun).toHaveBeenCalledWith(expect.objectContaining({
      rawResponseHash: "response-hash",
    }));
    expect(deps.saveRun).not.toHaveBeenCalledWith(expect.objectContaining({
      visitorHash: expect.anything(),
    }));
  });

  it("does not cache live machine readings", async () => {
    const response = await analyzeImage(request(), dependencies());

    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("marks provider timeouts as retryable gateway timeouts", async () => {
    const deps = dependencies({
      analyzeWithModel: vi.fn(async () => {
        throw new ProviderTimeoutError();
      }),
    });
    const response = await analyzeImage(request(), deps);

    expect(response.status).toBe(504);
    await expect(response.json()).resolves.toEqual({
      code: "PROVIDER_TIMEOUT",
      message: "视觉模型响应超时，请稍后重试。",
      retryable: true,
    });
  });

  it("reports only the upstream status for provider configuration failures", async () => {
    const deps = dependencies({
      analyzeWithModel: vi.fn(async () => {
        throw new ProviderResponseError("private provider detail", 403, "Model.AccessDenied");
      }),
    });
    const response = await analyzeImage(request(), deps);

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      code: "INVALID_PROVIDER_RESPONSE",
      message: "视觉模型返回了无法读取的结果，请稍后重试。",
      retryable: true,
      providerStatus: 403,
      providerCode: "Model.AccessDenied",
    });
  });

  it("rejects provider fields that exceed the approved schema", async () => {
    const deps = dependencies({
      analyzeWithModel: vi.fn(async () => ({
        ...providerResult,
        labels: ["一", "二", "三", "四"],
      })),
    });
    const response = await analyzeImage(request(), deps);

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      code: "INVALID_PROVIDER_RESPONSE",
      retryable: true,
    });
  });
});

describe("clientApi.analyze", () => {
  it("converts quota responses into a typed client error", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      code: "DAILY_LIMIT",
      message: "今日的三次实时分析额度已用完。你仍可使用种子档案体验。",
      retryable: false,
      resetDate: "2026-09-11",
    }), { status: 429, headers: { "content-type": "application/json" } }));
    const image = {
      blob: new Blob([WEBP_BYTES], { type: "image/webp" }),
      width: 800,
      height: 600,
      mimeType: "image/webp" as const,
      previewUrl: "blob:object",
    };

    await expect(clientApi.analyze(image, true, fetcher)).rejects.toMatchObject({
      name: "ApiError",
      kind: "quota",
      code: "DAILY_LIMIT",
      retryable: false,
      resetDate: "2026-09-11",
    } satisfies Partial<ApiError>);
  });

  it.each([
    [415, "validation"],
    [502, "provider"],
    [500, "unknown"],
  ] as const)("classifies status %i as a %s error", async (status, kind) => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      code: "FAILURE",
      message: "暂时不可用",
      retryable: status >= 500,
    }), { status, headers: { "content-type": "application/json" } }));
    const image = {
      blob: new Blob([WEBP_BYTES], { type: "image/webp" }),
      width: 800,
      height: 600,
      mimeType: "image/webp" as const,
      previewUrl: "blob:object",
    };

    await expect(clientApi.analyze(image, true, fetcher)).rejects.toMatchObject({ kind });
  });

  it("does not misclassify a missing server configuration as a provider error", async () => {
    const fetcher = vi.fn(async () => Response.json({
      code: "SERVER_NOT_CONFIGURED",
      message: "实时分析服务尚未完成配置。",
      retryable: false,
    }, { status: 503 }));
    const image = {
      blob: new Blob([WEBP_BYTES], { type: "image/webp" }),
      width: 800,
      height: 600,
      mimeType: "image/webp" as const,
      previewUrl: "blob:object",
    };

    await expect(clientApi.analyze(image, true, fetcher)).rejects.toMatchObject({
      kind: "unknown",
      code: "SERVER_NOT_CONFIGURED",
    });
  });

  it("rejects malformed successful responses with a typed unknown error", async () => {
    const fetcher = vi.fn(async () => Response.json({ analysisId: 42, reading: {} }));
    const image = {
      blob: new Blob([WEBP_BYTES], { type: "image/webp" }),
      width: 800,
      height: 600,
      mimeType: "image/webp" as const,
      previewUrl: "blob:object",
    };

    await expect(clientApi.analyze(image, true, fetcher)).rejects.toMatchObject({
      kind: "unknown",
      code: "INVALID_RESPONSE",
      retryable: true,
    });
  });

  it("turns a network failure into a retryable unknown error", async () => {
    const fetcher = vi.fn(async () => {
      throw new TypeError("network down");
    });
    const image = {
      blob: new Blob([WEBP_BYTES], { type: "image/webp" }),
      width: 800,
      height: 600,
      mimeType: "image/webp" as const,
      previewUrl: "blob:object",
    };

    await expect(clientApi.analyze(image, true, fetcher)).rejects.toMatchObject({
      kind: "unknown",
      code: "NETWORK_ERROR",
      retryable: true,
    });
  });
});

describe("Qwen visual adapter", () => {
  it("sends one image and parses the requested JSON fields", async () => {
    let requestBody: BodyInit | null | undefined;
    const fetcher: typeof fetch = async (_input, init) => {
      requestBody = init?.body;
      return Response.json({
        model: "qwen3-vl-flash",
        choices: [{ message: { content: JSON.stringify({
          labels: providerResult.labels,
          caption: providerResult.caption,
          materials: providerResult.materials,
          visibleText: providerResult.visibleText,
          uncertainties: providerResult.uncertainties,
          confidence: 0.99,
        }) } }],
      });
    };
    const analyze = createQwenClient({ apiKey: "test-key", fetcher });

    const result = await analyze({ mimeType: "image/webp", base64: base64() });
    const sent = JSON.parse(String(requestBody));

    expect(sent.messages[0].content.filter((part: { type: string }) => part.type === "image_url"))
      .toHaveLength(1);
    expect(sent.messages[0].content[1].text).toContain("最多3个");
    expect(result).toMatchObject({
      labels: providerResult.labels,
      caption: providerResult.caption,
      modelId: "qwen3-vl-flash-2026-01-22",
      modelSnapshot: "qwen3-vl-flash-2026-01-22",
      promptVersion: "object-reading-v1",
    });
  });

  it("preserves the upstream status without exposing the response body", async () => {
    const analyze = createQwenClient({
      apiKey: "test-key",
      fetcher: async () => Response.json({
        error: {
          code: "Model.AccessDenied",
          message: "private provider detail",
        },
      }, { status: 403 }),
    });

    await expect(analyze({ mimeType: "image/webp", base64: base64() })).rejects.toMatchObject({
      name: "ProviderResponseError",
      providerStatus: 403,
      providerCode: "Model.AccessDenied",
      message: "Provider returned an invalid response",
    });
  });
});

describe("analysis database migration", () => {
  it("uses the supported pg_cron installation and minimizes stored run data", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "supabase/migrations/20260910_analysis_schema.sql"),
      "utf8",
    );
    const modelRunTable = sql.slice(
      sql.indexOf("create table if not exists public.model_runs"),
      sql.indexOf("alter table public.request_quotas"),
    );

    expect(sql).toContain("create extension if not exists pg_cron;");
    expect(sql).not.toContain("pg_cron with schema extensions");
    expect(modelRunTable).not.toContain("visitor_hash");
    expect(sql).toContain("machine_caption text not null");
    expect(sql).toContain("labels text[] not null");
  });
});
