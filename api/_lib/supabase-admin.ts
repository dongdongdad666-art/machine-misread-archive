import type { ModelRunRecord } from "./analyze-service.js";
import type { SavedGap, StoredAnalysis } from "./gap-service.js";
import type {
  PendingArchiveRecord,
  SubmissionAnalysis,
} from "./submit-service.js";

interface SupabaseAdminOptions {
  url: string;
  serviceRoleKey: string;
  fetcher?: typeof fetch;
}

function headers(serviceRoleKey: string, prefer?: string) {
  return {
    apikey: serviceRoleKey,
    authorization: `Bearer ${serviceRoleKey}`,
    "content-type": "application/json",
    ...(prefer ? { prefer } : {}),
  };
}

export function createSupabaseAdmin(options: SupabaseAdminOptions) {
  const fetcher = options.fetcher ?? fetch;
  const projectUrl = options.url.replace(/\/$/, "");
  const restUrl = `${projectUrl}/rest/v1`;
  const storageUrl = `${projectUrl}/storage/v1`;

  return {
    async incrementQuota(visitorHash: string, quotaDate: string) {
      const response = await fetcher(`${restUrl}/rpc/increment_analysis_quota`, {
        method: "POST",
        headers: headers(options.serviceRoleKey),
        body: JSON.stringify({ p_visitor_hash: visitorHash, p_quota_date: quotaDate }),
      });
      if (!response.ok) throw new Error(`Quota update failed with status ${response.status}`);
      const value: unknown = await response.json();
      if (typeof value !== "number") throw new Error("Quota update returned an invalid count");
      return value;
    },

    async saveRun(record: ModelRunRecord) {
      const response = await fetcher(`${restUrl}/model_runs`, {
        method: "POST",
        headers: headers(options.serviceRoleKey, "return=representation"),
        body: JSON.stringify({
          model_id: record.modelId,
          model_snapshot: record.modelSnapshot,
          prompt_version: record.promptVersion,
          raw_response_hash: record.rawResponseHash,
          labels: record.reading.labels,
          machine_caption: record.reading.caption,
          materials: record.reading.materials,
          visible_text: record.reading.visibleText,
          uncertainties: record.reading.uncertainties,
          run_mode: record.reading.runMode,
          created_at: record.createdAt,
        }),
      });
      if (!response.ok) throw new Error(`Model run save failed with status ${response.status}`);
      const rows: unknown = await response.json();
      if (!Array.isArray(rows) || typeof rows[0]?.id !== "string") {
        throw new Error("Model run save returned no id");
      }
      return { id: rows[0].id };
    },

    async findAnalysis(analysisId: string): Promise<StoredAnalysis | null> {
      const query = new URLSearchParams({
        id: `eq.${analysisId}`,
        select: "id,machine_caption,uncertainties",
        limit: "1",
      });
      const response = await fetcher(`${restUrl}/model_runs?${query}`, {
        headers: headers(options.serviceRoleKey),
      });
      if (!response.ok) throw new Error(`Model run lookup failed with status ${response.status}`);
      const rows: unknown = await response.json();
      if (!Array.isArray(rows) || rows.length === 0) return null;
      const row = rows[0] as Record<string, unknown>;
      if (
        typeof row.id !== "string" ||
        typeof row.machine_caption !== "string" ||
        !Array.isArray(row.uncertainties)
      ) throw new Error("Model run lookup returned invalid data");
      return {
        id: row.id,
        machineCaption: row.machine_caption,
        uncertaintyCount: row.uncertainties.length,
      };
    },

    async saveGap(record: SavedGap) {
      const query = new URLSearchParams({ id: `eq.${record.analysisId}` });
      const response = await fetcher(`${restUrl}/model_runs?${query}`, {
        method: "PATCH",
        headers: headers(options.serviceRoleKey, "return=representation"),
        body: JSON.stringify({
          semantic_gap: record.semanticGap,
          gap_algorithm_version: record.algorithmVersion,
          generation_seed: record.generationSeed,
          generation_engine_version: record.generationEngineVersion,
          visual_parameters: record.visualParameters,
        }),
      });
      if (!response.ok) throw new Error(`Gap save failed with status ${response.status}`);
      const rows: unknown = await response.json();
      if (!Array.isArray(rows) || rows.length !== 1) {
        throw new Error("Gap save did not update exactly one model run");
      }
    },

    async findSubmissionAnalysis(analysisId: string): Promise<SubmissionAnalysis | null> {
      const query = new URLSearchParams({
        id: `eq.${analysisId}`,
        select: [
          "id",
          "archive_item_id",
          "labels",
          "semantic_gap",
          "gap_algorithm_version",
          "generation_seed",
          "generation_engine_version",
          "visual_parameters",
        ].join(","),
        limit: "1",
      });
      const response = await fetcher(`${restUrl}/model_runs?${query}`, {
        headers: headers(options.serviceRoleKey),
      });
      if (!response.ok) throw new Error(`Submission analysis lookup failed with status ${response.status}`);
      const rows: unknown = await response.json();
      if (!Array.isArray(rows) || rows.length === 0) return null;
      const row = rows[0] as Record<string, unknown>;
      if (
        typeof row.id !== "string" ||
        (row.archive_item_id !== null && typeof row.archive_item_id !== "string") ||
        !Array.isArray(row.labels) ||
        !row.labels.every((label) => typeof label === "string")
      ) throw new Error("Submission analysis lookup returned invalid data");
      return {
        id: row.id,
        archiveItemId: row.archive_item_id,
        labels: row.labels,
        semanticGap: typeof row.semantic_gap === "number" ? row.semantic_gap : null,
        gapAlgorithmVersion: typeof row.gap_algorithm_version === "string"
          ? row.gap_algorithm_version
          : null,
        generationSeed: typeof row.generation_seed === "number" ? row.generation_seed : null,
        generationEngineVersion: typeof row.generation_engine_version === "string"
          ? row.generation_engine_version
          : null,
        visualParameters: typeof row.visual_parameters === "object" && row.visual_parameters !== null
          ? row.visual_parameters as SubmissionAnalysis["visualParameters"]
          : null,
      };
    },

    async uploadPrivateObject(path: string, bytes: Uint8Array, contentType: string) {
      const encodedPath = path.split("/").map(encodeURIComponent).join("/");
      const response = await fetcher(`${storageUrl}/object/source-private/${encodedPath}`, {
        method: "POST",
        headers: {
          apikey: options.serviceRoleKey,
          authorization: `Bearer ${options.serviceRoleKey}`,
          "content-type": contentType,
          "x-upsert": "false",
        },
        body: bytes.slice().buffer as ArrayBuffer,
      });
      if (!response.ok) throw new Error(`Private object upload failed with status ${response.status}`);
    },

    async removePrivateObjects(paths: string[]) {
      if (!paths.length) return;
      const response = await fetcher(`${storageUrl}/object/source-private`, {
        method: "DELETE",
        headers: headers(options.serviceRoleKey),
        body: JSON.stringify({ prefixes: paths }),
      });
      if (!response.ok) throw new Error(`Private object cleanup failed with status ${response.status}`);
    },

    async findArchiveByToken(token: string) {
      const query = new URLSearchParams({
        submission_token: `eq.${token}`,
        select: "id,accession_no,analysis_id,artifact_path,source_path",
        limit: "1",
      });
      const response = await fetcher(`${restUrl}/archive_items?${query}`, {
        headers: headers(options.serviceRoleKey),
      });
      if (!response.ok) throw new Error(`Archive reconciliation failed with status ${response.status}`);
      const rows: unknown = await response.json();
      if (!Array.isArray(rows) || rows.length === 0) return null;
      const row = rows[0] as Record<string, unknown>;
      if (
        typeof row.id !== "string" ||
        typeof row.accession_no !== "string" ||
        typeof row.analysis_id !== "string" ||
        typeof row.artifact_path !== "string" ||
        (row.source_path !== null && typeof row.source_path !== "string")
      ) {
        throw new Error("Archive reconciliation returned invalid data");
      }
      return {
        id: row.id,
        accessionNo: row.accession_no,
        analysisId: row.analysis_id,
        artifactPath: row.artifact_path,
        sourcePath: row.source_path,
      };
    },

    async createPendingArchive(record: PendingArchiveRecord) {
      const response = await fetcher(`${restUrl}/rpc/create_pending_archive_submission`, {
        method: "POST",
        headers: headers(options.serviceRoleKey),
        body: JSON.stringify({
          p_analysis_id: record.analysisId,
          p_accession_no: record.accessionNo,
          p_submission_token: record.submissionToken,
          p_object_name: record.objectName,
          p_time_range: record.timeRange,
          p_city: record.city,
          p_memory_text: record.memoryText,
          p_relation: record.relation,
          p_emotion_tags: record.emotionTags,
          p_source_visibility: record.sourceVisibility,
          p_artifact_visibility: record.artifactVisibility,
          p_consent_version: record.consentVersion,
          p_source_path: record.sourcePath,
          p_artifact_path: record.artifactPath,
        }),
      });
      if (!response.ok) throw new Error(`Archive submission failed with status ${response.status}`);
      const rows: unknown = await response.json();
      const row = Array.isArray(rows) ? rows[0] : null;
      if (
        typeof row !== "object" || row === null ||
        typeof row.id !== "string" ||
        typeof row.accession_no !== "string" ||
        typeof row.artifact_path !== "string" ||
        (row.source_path !== null && typeof row.source_path !== "string")
      ) throw new Error("Archive submission returned invalid data");
      return {
        id: row.id,
        accessionNo: row.accession_no,
        artifactPath: row.artifact_path,
        sourcePath: row.source_path,
      };
    },
  };
}
