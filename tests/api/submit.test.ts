import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  submitArchive,
  type SubmitDependencies,
} from "../../api/_lib/submit-service";
import { clientApi } from "../../src/lib/api";

const analysisId = "20f65a48-30fd-48f9-8f1c-5bb0f5640102";
const ATTEMPT_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const ARTIFACT_PATH = `pending-artifacts/${validInputToken()}/${ATTEMPT_ID}/artifact.png`;
const SOURCE_PATH = `pending-sources/${validInputToken()}/${ATTEMPT_ID}/source.jpg`;

function validInputToken() {
  return "12345678-90ab-cdef-1234-567890abcdef";
}
const PNG_BYTES = Uint8Array.from(Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
));
const TRUNCATED_PNG = PNG_BYTES.slice(0, 8);
const JPEG_BYTES = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]);

const validInput = {
  analysisId,
  memoryText: "这是一本从学生时代一直保存到今天的旧字典，封面的胶带是后来反复修补留下的。",
  timeRange: "年代不确定",
  city: "",
  relation: "日常使用",
  emotionTags: ["怀念", "温暖"],
  artifact: {
    mimeType: "image/png",
    base64: Buffer.from(PNG_BYTES).toString("base64"),
  },
  submissionToken: validInputToken(),
  publicationConsent: true,
  consentVersion: "publication-v1",
  publishArtifact: true,
  publishSource: false,
};

function request(overrides: Record<string, unknown> = {}) {
  return new Request("https://archive.test/api/submit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...validInput, ...overrides }),
  });
}

function dependencies(overrides: Partial<SubmitDependencies> = {}): SubmitDependencies {
  return {
    now: () => new Date("2026-09-10T06:00:00.000Z"),
    createAttemptId: () => ATTEMPT_ID,
    findAnalysis: vi.fn(async () => ({
      id: analysisId,
      archiveItemId: null,
      labels: ["旧字典", "修补过的书"],
      semanticGap: 0.42,
      gapAlgorithmVersion: "gap-v1",
      generationSeed: 21060,
      generationEngineVersion: "residue-v1",
      visualParameters: {
        layerOffset: 0.42,
        fragmentation: 0.5,
        motionSpeed: 0.3,
        colorTemperature: 0.7,
        lineDensity: 0.6,
        textCollision: 0.42,
      },
    })),
    uploadPrivateObject: vi.fn(async () => undefined),
    removePrivateObjects: vi.fn(async () => undefined),
    findArchiveByToken: vi.fn(async () => null),
    createPendingArchive: vi.fn(async (record) => ({
      id: "archive-01",
      accessionNo: record.accessionNo,
      artifactPath: record.artifactPath,
      sourcePath: record.sourcePath,
    })),
    ...overrides,
  };
}

describe("archive schema policies", () => {
  it("defines four business tables, unique quota, buckets, and published-only reads", () => {
    const migrationDirectory = resolve(process.cwd(), "supabase/migrations");
    const sql = [
      "20260910_analysis_schema.sql",
      "20260910_gap_schema.sql",
      "20260911_archive_schema.sql",
    ].map((file) => readFileSync(resolve(migrationDirectory, file), "utf8")).join("\n");

    expect(sql.match(/create table if not exists public\./g)).toHaveLength(4);
    expect(sql).toContain("request_quotas_visitor_day_key");
    expect(sql).toMatch(/'source-private'[\s\S]*false/);
    expect(sql).toMatch(/'artifacts-public'[\s\S]*false/);
    expect(sql).toMatch(/analysis_id uuid not null unique/);
    expect(sql).toMatch(/submission_token = p_submission_token[\s\S]*submission_token_conflict/);
    expect(sql).toContain("revoke insert, update, delete on table public.archive_items from anon, authenticated");
    expect(sql).toMatch(/create policy "Published archives are readable"[\s\S]*status = 'published'/);
    expect(sql).toMatch(/create policy "Published source objects are readable"[\s\S]*status = 'published'/);
  });
});

describe("POST /api/submit", () => {
  it("requires publication consent even when analysis consent was granted", async () => {
    const deps = dependencies();
    const response = await submitArchive(request({
      publicationConsent: false,
      analysisConsent: true,
    }), deps);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: "PUBLICATION_CONSENT_REQUIRED" });
    expect(deps.findAnalysis).not.toHaveBeenCalled();
  });

  it.each([
    [true, false, "public_requested", "private", 1],
    [true, true, "public_requested", "public", 2],
  ] as const)(
    "keeps artifact %s and source %s visibility independent",
    async (publishArtifact, publishSource, artifactVisibility, sourceVisibility, uploadCount) => {
      const deps = dependencies();
      const response = await submitArchive(request({
        publishArtifact,
        publishSource,
        source: {
          mimeType: "image/jpeg",
          base64: Buffer.from(JPEG_BYTES).toString("base64"),
        },
      }), deps);

      expect(response.status).toBe(201);
      expect(deps.uploadPrivateObject).toHaveBeenCalledTimes(uploadCount);
      expect(deps.createPendingArchive).toHaveBeenCalledWith(expect.objectContaining({
        artifactVisibility,
        sourceVisibility,
      }));
    },
  );

  it("does not create a source-only public record", async () => {
    const deps = dependencies();
    const response = await submitArchive(request({
      publishArtifact: false,
      publishSource: true,
      source: {
        mimeType: "image/jpeg",
        base64: Buffer.from(JPEG_BYTES).toString("base64"),
      },
    }), deps);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: "ARTIFACT_PUBLICATION_REQUIRED" });
    expect(deps.findAnalysis).not.toHaveBeenCalled();
  });

  it("rejects an analysis without a measured semantic gap", async () => {
    const deps = dependencies({
      findAnalysis: vi.fn(async () => ({
        id: analysisId,
        archiveItemId: null,
        labels: ["旧字典"],
        semanticGap: null,
        gapAlgorithmVersion: null,
        generationSeed: null,
        generationEngineVersion: null,
        visualParameters: null,
      })),
    });
    const response = await submitArchive(request(), deps);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: "GAP_REQUIRED" });
    expect(deps.uploadPrivateObject).not.toHaveBeenCalled();
  });

  it("rejects a temporary non-publishable gap", async () => {
    const deps = dependencies();
    vi.mocked(deps.findAnalysis).mockResolvedValue({
      ...await vi.mocked(deps.findAnalysis)(analysisId),
      id: analysisId,
      archiveItemId: null,
      labels: ["旧字典"],
      semanticGap: 0.5,
      gapAlgorithmVersion: "temporary-fixed-v1",
      generationSeed: 21060,
      generationEngineVersion: "residue-v1",
      visualParameters: {
        layerOffset: 0.5,
        fragmentation: 0.5,
        motionSpeed: 0.5,
        colorTemperature: 0.5,
        lineDensity: 0.5,
        textCollision: 0.5,
      },
    });
    const response = await submitArchive(request(), deps);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: "GAP_NOT_PUBLISHABLE" });
    expect(deps.uploadPrivateObject).not.toHaveBeenCalled();
  });

  it("accepts only a real PNG artifact", async () => {
    const deps = dependencies();
    const response = await submitArchive(request({
      artifact: {
        mimeType: "image/jpeg",
        base64: Buffer.from(JPEG_BYTES).toString("base64"),
      },
    }), deps);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: "INVALID_ARTIFACT" });
    expect(deps.findAnalysis).not.toHaveBeenCalled();
  });

  it("rejects a truncated payload that only has a PNG signature", async () => {
    const deps = dependencies();
    const response = await submitArchive(request({
      artifact: {
        mimeType: "image/png",
        base64: Buffer.from(TRUNCATED_PNG).toString("base64"),
      },
    }), deps);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: "INVALID_ARTIFACT" });
    expect(deps.findAnalysis).not.toHaveBeenCalled();
  });

  it("rejects an oversized request before parsing its JSON body", async () => {
    const deps = dependencies();
    const oversized = new Request("https://archive.test/api/submit", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": String(6 * 1024 * 1024 + 1),
      },
      body: JSON.stringify(validInput),
    });
    const response = await submitArchive(oversized, deps);

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({ code: "REQUEST_TOO_LARGE" });
    expect(deps.findAnalysis).not.toHaveBeenCalled();
  });

  it("enforces the byte limit when content-length is missing", async () => {
    const deps = dependencies();
    const oversized = new Request("https://archive.test/api/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...validInput, ignored: "x".repeat(6 * 1024 * 1024) }),
    });
    const response = await submitArchive(oversized, deps);

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({ code: "REQUEST_TOO_LARGE" });
    expect(deps.findAnalysis).not.toHaveBeenCalled();
  });

  it("ignores a client attempt to force published status", async () => {
    const deps = dependencies();
    const response = await submitArchive(request({ status: "published" }), deps);

    expect(response.status).toBe(201);
    expect(deps.createPendingArchive).toHaveBeenCalledWith(expect.objectContaining({
      status: "pending_review",
    }));
    expect(await response.json()).toMatchObject({ status: "pending_review" });
  });

  it("removes only newly uploaded objects when database insertion fails", async () => {
    const deps = dependencies({
      createPendingArchive: vi.fn(async () => {
        throw new Error("database unavailable");
      }),
    });
    const response = await submitArchive(request({
      publishSource: true,
      source: {
        mimeType: "image/jpeg",
        base64: Buffer.from(JPEG_BYTES).toString("base64"),
      },
    }), deps);

    expect(response.status).toBe(503);
    expect(deps.removePrivateObjects).toHaveBeenCalledWith([
      ARTIFACT_PATH,
      SOURCE_PATH,
    ]);
  });

  it("keeps uploaded objects when an ambiguous RPC failure actually committed", async () => {
    const findArchiveByToken = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "archive-01",
        accessionNo: "MMA-20260910-12345678",
        analysisId,
        artifactPath: ARTIFACT_PATH,
        sourcePath: null,
      });
    const deps = dependencies({
      createPendingArchive: vi.fn(async () => {
        throw new Error("response lost after commit");
      }),
      findArchiveByToken,
    });
    const response = await submitArchive(request(), deps);

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      submissionId: "archive-01",
      accessionNo: "MMA-20260910-12345678",
      status: "pending_review",
    });
    expect(deps.removePrivateObjects).not.toHaveBeenCalled();
  });

  it("returns the original receipt when the browser retries with the same token", async () => {
    const deps = dependencies({
      findArchiveByToken: vi.fn(async () => ({
        id: "archive-01",
        accessionNo: "MMA-20260910-12345678",
        analysisId,
        artifactPath: ARTIFACT_PATH,
        sourcePath: null,
      })),
    });
    const response = await submitArchive(request(), deps);

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      submissionId: "archive-01",
      accessionNo: "MMA-20260910-12345678",
      status: "pending_review",
    });
    expect(deps.uploadPrivateObject).not.toHaveBeenCalled();
    expect(deps.findAnalysis).not.toHaveBeenCalled();
  });

  it("rejects a reused token bound to another analysis before any storage write", async () => {
    const deps = dependencies({
      findArchiveByToken: vi.fn(async () => ({
        id: "archive-existing",
        accessionNo: "MMA-20260910-12345678",
        analysisId: "another-analysis",
        artifactPath: "pending-artifacts/existing/artifact.png",
        sourcePath: null,
      })),
    });
    const response = await submitArchive(request(), deps);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: "SUBMISSION_TOKEN_CONFLICT" });
    expect(deps.findAnalysis).not.toHaveBeenCalled();
    expect(deps.uploadPrivateObject).not.toHaveBeenCalled();
    expect(deps.removePrivateObjects).not.toHaveBeenCalled();
  });

  it("cleans only its isolated upload when another analysis wins the token race", async () => {
    const findArchiveByToken = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "archive-winner",
        accessionNo: "MMA-20260910-12345678",
        analysisId: "another-analysis",
        artifactPath: `pending-artifacts/${validInputToken()}/winner/artifact.png`,
        sourcePath: null,
      });
    const deps = dependencies({
      findArchiveByToken,
      createPendingArchive: vi.fn(async () => {
        throw new Error("submission_token_conflict");
      }),
    });
    const response = await submitArchive(request(), deps);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: "SUBMISSION_TOKEN_CONFLICT" });
    expect(deps.removePrivateObjects).toHaveBeenCalledWith([ARTIFACT_PATH]);
    expect(deps.removePrivateObjects).not.toHaveBeenCalledWith([
      `pending-artifacts/${validInputToken()}/winner/artifact.png`,
    ]);
  });

  it("does not delete files when committed state cannot be determined", async () => {
    const findArchiveByToken = vi.fn()
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error("reconciliation unavailable"));
    const deps = dependencies({
      createPendingArchive: vi.fn(async () => {
        throw new Error("response lost after commit");
      }),
      findArchiveByToken,
    });
    const response = await submitArchive(request(), deps);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ code: "SUBMISSION_STATE_UNKNOWN" });
    expect(deps.removePrivateObjects).not.toHaveBeenCalled();
  });

  it("cleans up the artifact when the optional source upload fails", async () => {
    const upload = vi.fn(async (path: string) => {
      if (path.includes("pending-sources")) throw new Error("storage unavailable");
    });
    const deps = dependencies({ uploadPrivateObject: upload });
    const response = await submitArchive(request({
      publishSource: true,
      source: {
        mimeType: "image/jpeg",
        base64: Buffer.from(JPEG_BYTES).toString("base64"),
      },
    }), deps);

    expect(response.status).toBe(503);
    expect(deps.removePrivateObjects).toHaveBeenCalledWith([
      ARTIFACT_PATH,
      SOURCE_PATH,
    ]);
    expect(deps.createPendingArchive).not.toHaveBeenCalled();
  });

  it("returns a pending accession number after controlled persistence succeeds", async () => {
    const deps = dependencies();
    const response = await submitArchive(request(), deps);

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      submissionId: "archive-01",
      accessionNo: "MMA-20260910-12345678",
      status: "pending_review",
    });
    expect(deps.uploadPrivateObject).toHaveBeenCalledWith(
      ARTIFACT_PATH,
      PNG_BYTES,
      "image/png",
    );
    expect(deps.createPendingArchive).toHaveBeenCalledWith(expect.objectContaining({
      analysisId,
      accessionNo: "MMA-20260910-12345678",
      objectName: "旧字典",
      consentVersion: "publication-v1",
      status: "pending_review",
    }));
  });

  it("cleans only its isolated upload when a concurrent same-token request wins", async () => {
    const deps = dependencies({
      createPendingArchive: vi.fn(async () => ({
        id: "archive-winner",
        accessionNo: "MMA-20260910-12345678",
        artifactPath: `pending-artifacts/${validInputToken()}/winner/artifact.png`,
        sourcePath: null,
      })),
    });
    const response = await submitArchive(request(), deps);

    expect(response.status).toBe(201);
    expect(deps.removePrivateObjects).toHaveBeenCalledWith([ARTIFACT_PATH]);
    expect(deps.removePrivateObjects).not.toHaveBeenCalledWith([
      `pending-artifacts/${validInputToken()}/winner/artifact.png`,
    ]);
  });
});

describe("clientApi.submitArchive", () => {
  it("serializes approved fields and returns the pending accession", async () => {
    let sentBody: Record<string, unknown> = {};
    const fetcher: typeof fetch = async (_input, init) => {
      sentBody = JSON.parse(String(init?.body));
      return Response.json({
        submissionId: "archive-01",
        accessionNo: "MMA-20260910-12345678",
        status: "pending_review",
      }, { status: 201 });
    };

    const untrustedInput = {
      ...validInput,
      artifact: new Blob([PNG_BYTES], { type: "image/png" }),
      source: undefined,
      publicationConsent: true as const,
      consentVersion: "publication-v1" as const,
      status: "published",
    };
    const result = await clientApi.submitArchive(untrustedInput, fetcher);

    expect(result.accessionNo).toBe("MMA-20260910-12345678");
    expect(sentBody).not.toHaveProperty("status");
    expect(sentBody).not.toHaveProperty("source");
    expect(sentBody).toMatchObject({
      publicationConsent: true,
      consentVersion: "publication-v1",
      submissionToken: "12345678-90ab-cdef-1234-567890abcdef",
      publishArtifact: true,
      publishSource: false,
      artifact: { mimeType: "image/png" },
    });
  });
});
