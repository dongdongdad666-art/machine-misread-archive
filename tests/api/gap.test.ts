import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  EmbeddingProviderError,
  calculateGap,
  cosineDistance,
  type GapDependencies,
} from "../../api/_lib/gap-service";
import { createQwenEmbeddingClient } from "../../api/_lib/qwen-client";
import { ApiError, clientApi } from "../../src/lib/api";

const analysisId = "20f65a48-30fd-48f9-8f1c-5bb0f5640102";
const validInput = {
  analysisId,
  memoryText: "这是一本从学生时代一直保存到今天的旧字典，封面的胶带是后来反复修补留下的。",
  timeRange: "2000年代",
  relation: "日常使用",
  emotionTags: ["怀念", "温暖"],
};

function request(overrides: Record<string, unknown> = {}) {
  return new Request("https://archive.test/api/gap", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...validInput, ...overrides }),
  });
}

function dependencies(overrides: Partial<GapDependencies> = {}): GapDependencies {
  return {
    findAnalysis: vi.fn(async () => ({
      id: analysisId,
      machineCaption: "一本封面开裂并缠有透明胶带的红色小字典。",
      uncertaintyCount: 1,
    })),
    embedTexts: vi.fn(async () => [[1, 0], [0.75, Math.sqrt(1 - 0.75 ** 2)]]),
    saveGap: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("cosineDistance", () => {
  it.each([
    [[1, 0], [1, 0], 0],
    [[1, 0], [0.5, Math.sqrt(0.75)], 0.5],
    [[1, 0], [0, 1], 1],
  ] as const)("returns %s and %s as distance %s", (left, right, expected) => {
    expect(cosineDistance([...left], [...right])).toBeCloseTo(expected);
  });
});

describe("POST /api/gap", () => {
  it.each([
    [19, 400],
    [20, 200],
    [400, 200],
    [401, 400],
  ])("validates a %i-character memory", async (length, expectedStatus) => {
    const deps = dependencies();
    const response = await calculateGap(request({ memoryText: "记".repeat(length) }), deps);

    expect(response.status).toBe(expectedStatus);
    if (expectedStatus === 400) expect(deps.embedTexts).not.toHaveBeenCalled();
  });

  it("allows at most three controlled emotion tags", async () => {
    const deps = dependencies();
    const response = await calculateGap(request({
      emotionTags: ["怀念", "温暖", "遗憾", "疏离"],
    }), deps);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: "INVALID_EMOTIONS" });
    expect(deps.embedTexts).not.toHaveBeenCalled();
  });

  it("rejects duplicate emotion tags instead of weighting one emotion twice", async () => {
    const deps = dependencies();
    const response = await calculateGap(request({ emotionTags: ["怀念", "怀念"] }), deps);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: "INVALID_EMOTIONS" });
    expect(deps.embedTexts).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown analysis id", async () => {
    const deps = dependencies({ findAnalysis: vi.fn(async () => null) });
    const response = await calculateGap(request(), deps);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ code: "ANALYSIS_NOT_FOUND" });
    expect(deps.embedTexts).not.toHaveBeenCalled();
  });

  it("returns a retryable data-service error when analysis lookup fails", async () => {
    const deps = dependencies({
      findAnalysis: vi.fn(async () => {
        throw new Error("database unavailable");
      }),
    });
    const response = await calculateGap(request(), deps);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: "GAP_STORAGE_UNAVAILABLE",
      retryable: true,
    });
    expect(deps.embedTexts).not.toHaveBeenCalled();
  });

  it.each([
    [[1, 0], [1, 0], 0],
    [[1, 0], [0.5, Math.sqrt(0.75)], 0.5],
    [[1, 0], [0, 1], 1],
  ] as const)("derives and persists semantic distance %s", async (left, right, expected) => {
    const deps = dependencies({ embedTexts: vi.fn(async () => [[...left], [...right]]) });
    const response = await calculateGap(
      request({ semanticGap: 0.99, machineCaption: "客户端伪造描述" }),
      deps,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      mode: "measured",
      publishable: true,
      semanticGap: expected,
      algorithmVersion: "gap-v1",
      generationEngineVersion: "residue-v1",
    });
    expect(Object.values(body.visualParameters).every(
      (value) => typeof value === "number" && value >= 0 && value <= 1,
    )).toBe(true);
    expect(deps.embedTexts).toHaveBeenCalledWith([
      "一本封面开裂并缠有透明胶带的红色小字典。",
      validInput.memoryText,
    ], 256);
    expect(deps.saveGap).toHaveBeenCalledWith(expect.objectContaining({
      analysisId,
      semanticGap: expected,
      algorithmVersion: "gap-v1",
    }));
  });

  it("returns a labeled non-publishable result when embedding fails", async () => {
    const deps = dependencies({
      embedTexts: vi.fn(async () => {
        throw new EmbeddingProviderError();
      }),
    });
    const response = await calculateGap(request(), deps);
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      code: "EMBEDDING_UNAVAILABLE",
      mode: "temporary",
      semanticGap: 0.5,
      publishable: false,
      retryable: true,
    });
    expect(body).toHaveProperty("generationSeed");
    expect(body).toHaveProperty("visualParameters");
    expect(deps.saveGap).not.toHaveBeenCalled();
  });

  it("reports only the upstream status for embedding configuration failures", async () => {
    const deps = dependencies({
      embedTexts: vi.fn(async () => {
        throw new EmbeddingProviderError("private provider detail", 403, "Model.AccessDenied");
      }),
    });

    const response = await calculateGap(request(), deps);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: "EMBEDDING_UNAVAILABLE",
      providerStatus: 403,
      providerCode: "Model.AccessDenied",
    });
  });

  it("does not claim success when the measured gap cannot be saved", async () => {
    const deps = dependencies({
      saveGap: vi.fn(async () => {
        throw new Error("write failed");
      }),
    });
    const response = await calculateGap(request(), deps);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: "GAP_STORAGE_UNAVAILABLE",
      retryable: true,
    });
  });
});

describe("clientApi.calculateGap", () => {
  it("sends only approved human-memory fields", async () => {
    let sentBody: Record<string, unknown> = {};
    const fetcher: typeof fetch = async (_input, init) => {
      sentBody = JSON.parse(String(init?.body));
      return Response.json({
        mode: "measured",
        publishable: true,
        semanticGap: 0.25,
        algorithmVersion: "gap-v1",
        generationSeed: 21060,
        generationEngineVersion: "residue-v1",
        visualParameters: {
          layerOffset: 0.25,
          fragmentation: 0.2,
          motionSpeed: 0.7,
          colorTemperature: 0.8,
          lineDensity: 0.5,
          textCollision: 0.25,
        },
      });
    };

    const untrustedInput = {
      ...validInput,
      semanticGap: 0.99,
      machineCaption: "客户端伪造描述",
    };
    const result = await clientApi.calculateGap(untrustedInput, fetcher);

    expect(result.semanticGap).toBe(0.25);
    expect(sentBody).toEqual(validInput);
    expect(sentBody).not.toHaveProperty("semanticGap");
    expect(sentBody).not.toHaveProperty("machineCaption");
  });

  it("returns a valid temporary result instead of discarding the draft", async () => {
    const fetcher = vi.fn(async () => Response.json({
      code: "EMBEDDING_UNAVAILABLE",
      message: "语义距离服务暂时不可用。",
      retryable: true,
      mode: "temporary",
      publishable: false,
      semanticGap: 0.5,
      algorithmVersion: "temporary-fixed-v1",
      generationSeed: 21060,
      generationEngineVersion: "residue-v1",
      visualParameters: {
        layerOffset: 0.5,
        fragmentation: 0.2,
        motionSpeed: 0.7,
        colorTemperature: 0.8,
        lineDensity: 0.5,
        textCollision: 0.5,
      },
    }, { status: 503 }));

    await expect(clientApi.calculateGap(validInput, fetcher)).resolves.toMatchObject({
      mode: "temporary",
      publishable: false,
      semanticGap: 0.5,
    });
  });

  it("rejects malformed success data as a typed response error", async () => {
    const fetcher = vi.fn(async () => Response.json({ semanticGap: "0.5" }));

    await expect(clientApi.calculateGap(validInput, fetcher)).rejects.toMatchObject({
      name: "ApiError",
      kind: "unknown",
      code: "INVALID_RESPONSE",
    } satisfies Partial<ApiError>);
  });
});

describe("Qwen embedding adapter", () => {
  it("requests both texts together at 256 dimensions", async () => {
    let sentBody: Record<string, unknown> = {};
    const first = Array.from({ length: 256 }, (_, index) => index === 0 ? 1 : 0);
    const second = Array.from({ length: 256 }, (_, index) => index === 1 ? 1 : 0);
    const fetcher: typeof fetch = async (_input, init) => {
      sentBody = JSON.parse(String(init?.body));
      return Response.json({
        data: [
          { index: 1, embedding: second },
          { index: 0, embedding: first },
        ],
      });
    };
    const embed = createQwenEmbeddingClient({ apiKey: "test-key", fetcher });

    await expect(embed(["机器描述", "人类记忆"], 256)).resolves.toEqual([first, second]);
    expect(sentBody).toMatchObject({
      model: "text-embedding-v4",
      input: ["机器描述", "人类记忆"],
      dimensions: 256,
      encoding_format: "float",
    });
  });

  it("preserves the upstream status without exposing the response body", async () => {
    const embed = createQwenEmbeddingClient({
      apiKey: "test-key",
      fetcher: async () => Response.json({
        error: {
          code: "Model.AccessDenied",
          message: "private provider detail",
        },
      }, { status: 403 }),
    });

    await expect(embed(["机器描述", "人类记忆"], 256)).rejects.toMatchObject({
      name: "EmbeddingProviderError",
      providerStatus: 403,
      providerCode: "Model.AccessDenied",
      message: "Embedding provider unavailable",
    });
  });

  it("identifies a successful response with the wrong vector dimension", async () => {
    const embed = createQwenEmbeddingClient({
      apiKey: "test-key",
      fetcher: async () => Response.json({
        data: [{ index: 0, embedding: [0.25] }],
      }),
    });

    await expect(embed(["机器描述"], 256)).rejects.toMatchObject({
      providerStatus: 200,
      providerCode: "InvalidEmbeddingDimension",
    });
  });
});

describe("gap persistence migration", () => {
  it("adds traceable server-derived fields to model runs", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "supabase/migrations/20260910_gap_schema.sql"),
      "utf8",
    );

    expect(sql).toContain("semantic_gap double precision");
    expect(sql).toContain("gap_algorithm_version text");
    expect(sql).toContain("generation_seed bigint");
    expect(sql).toContain("generation_engine_version text");
    expect(sql).toContain("visual_parameters jsonb");
  });
});
