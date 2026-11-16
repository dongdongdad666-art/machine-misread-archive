import type { VisualParameters } from "../domain/archive";
import type { CreationStage, CreationState } from "../domain/creation-machine";

export const DRAFT_STORAGE_KEY = "misread-archive:draft:v1";

export interface CreationDraft {
  version: 1;
  stage: CreationStage;
  memoryText: string;
  analysisId?: string;
  semanticGap?: number;
  generationSeed?: number;
  parameters?: VisualParameters;
  gapMode?: "measured" | "temporary";
  gapAlgorithmVersion?: string;
  publishable?: boolean;
}

const validStages = new Set<CreationStage>([
  "local_draft",
  "analyzing",
  "interpreted",
  "memory_complete",
  "generated",
  "pending_review",
]);

function isUnitValue(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function isDraft(value: unknown): value is CreationDraft {
  if (typeof value !== "object" || value === null) return false;
  const draft = value as Partial<CreationDraft>;
  if (
    draft.version !== 1 ||
    !validStages.has(draft.stage as CreationStage) ||
    typeof draft.memoryText !== "string"
  ) {
    return false;
  }
  if (draft.analysisId !== undefined && typeof draft.analysisId !== "string") return false;
  if (
    draft.generationSeed !== undefined &&
    (typeof draft.generationSeed !== "number" || !Number.isFinite(draft.generationSeed))
  ) {
    return false;
  }
  if (draft.semanticGap !== undefined && !isUnitValue(draft.semanticGap)) return false;
  if (
    draft.gapMode !== undefined &&
    draft.gapMode !== "measured" &&
    draft.gapMode !== "temporary"
  ) return false;
  if (
    draft.gapAlgorithmVersion !== undefined &&
    typeof draft.gapAlgorithmVersion !== "string"
  ) return false;
  if (draft.publishable !== undefined && typeof draft.publishable !== "boolean") return false;
  if (draft.parameters !== undefined) {
    const values = Object.values(draft.parameters);
    if (values.length !== 6 || values.some((entry) => !isUnitValue(entry))) return false;
  }
  if (draft.stage === "generated" || draft.stage === "pending_review") {
    if (
      !isUnitValue(draft.semanticGap) ||
      typeof draft.generationSeed !== "number" ||
      !Number.isFinite(draft.generationSeed) ||
      draft.parameters === undefined ||
      typeof draft.gapAlgorithmVersion !== "string"
    ) return false;
    const measured = draft.gapMode === "measured" && draft.publishable === true;
    const temporary = draft.gapMode === "temporary" && draft.publishable === false;
    if (!measured && !temporary) return false;
    if (draft.stage === "pending_review" && !measured) return false;
  }
  return true;
}

export function saveDraft(state: CreationState, storage: Storage = localStorage): void {
  const draft: CreationDraft = {
    version: 1,
    stage: state.stage,
    memoryText: state.memoryText,
    analysisId: state.analysisId,
    semanticGap: state.semanticGap,
    generationSeed: state.generationSeed,
    parameters: state.parameters,
    gapMode: state.gapMode,
    gapAlgorithmVersion: state.gapAlgorithmVersion,
    publishable: state.publishable,
  };
  storage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
}

export function loadDraft(storage: Storage = localStorage): CreationDraft | null {
  const raw = storage.getItem(DRAFT_STORAGE_KEY);
  if (raw === null) return null;

  try {
    const value: unknown = JSON.parse(raw);
    if (isDraft(value)) return value;
  } catch {
    // Invalid drafts are removed below without affecting other application data.
  }

  storage.removeItem(DRAFT_STORAGE_KEY);
  return null;
}

export function clearDraft(storage: Storage = localStorage): void {
  storage.removeItem(DRAFT_STORAGE_KEY);
}
