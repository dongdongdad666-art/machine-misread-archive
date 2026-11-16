import type {
  ArchiveItem,
  ArchiveStatus,
  DisappearanceMode,
  MachineReading,
  RunMode,
} from "./archive.js";

export interface ValidationResult {
  ok: boolean;
  issues: string[];
}

const archiveStatuses = new Set<ArchiveStatus>([
  "draft",
  "pending_review",
  "published",
  "rejected",
  "withdrawn",
]);

const runModes = new Set<RunMode>(["single_live", "seed_repeated"]);
const disappearanceModes = new Set<DisappearanceMode>([
  "媒介替代",
  "制度更替",
  "语境丢失",
  "失去用途",
  "尚待确认",
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const inUnitRange = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;

const textLength = (value: string) => Array.from(value.trim()).length;

function validTextArray(
  value: unknown,
  maximumItems: number,
  maximumLength: number,
  allowEmpty = true,
) {
  return (
    Array.isArray(value) &&
    value.length <= maximumItems &&
    (allowEmpty || value.length > 0) &&
    value.every((item) => (
      typeof item === "string" && textLength(item) > 0 && textLength(item) <= maximumLength
    ))
  );
}

export function validateMachineReading(value: unknown): ValidationResult {
  if (!isRecord(value)) return { ok: false, issues: ["machine reading must be an object"] };

  const reading = value as unknown as MachineReading;
  const issues: string[] = [];
  if (!validTextArray(reading.labels, 3, 60, false)) issues.push("invalid machine labels");
  if (typeof reading.caption !== "string" || textLength(reading.caption) > 320 || textLength(reading.caption) === 0) {
    issues.push("invalid machine caption");
  }
  if (!validTextArray(reading.materials, 8, 60)) issues.push("invalid materials");
  if (!validTextArray(reading.visibleText, 8, 120)) issues.push("invalid visible text");
  if (!validTextArray(reading.uncertainties, 6, 180)) issues.push("invalid uncertainties");
  if (!runModes.has(reading.runMode)) issues.push("invalid run mode");
  if (reading.runMode === "single_live" && reading.stabilityScore !== undefined) {
    issues.push("single_live cannot expose stabilityScore");
  }
  if (typeof reading.modelId !== "string" || !reading.modelId.trim()) issues.push("model id is required");
  if (typeof reading.modelSnapshot !== "string" || !reading.modelSnapshot.trim()) {
    issues.push("model snapshot is required");
  }
  if (typeof reading.promptVersion !== "string" || !reading.promptVersion.trim()) {
    issues.push("prompt version is required");
  }

  return { ok: issues.length === 0, issues };
}

export function validateArchiveItem(value: unknown): ValidationResult {
  const issues: string[] = [];

  if (!isRecord(value)) {
    return { ok: false, issues: ["archive item must be an object"] };
  }

  const item = value as unknown as ArchiveItem;

  if (!archiveStatuses.has(item.status)) issues.push("invalid archive status");
  if (!disappearanceModes.has(item.disappearanceMode)) {
    issues.push("invalid disappearance mode");
  }
  if (!item.id || !item.accessionNo || !item.objectName) {
    issues.push("id, accessionNo and objectName are required");
  }
  if (!item.provenance?.note || !item.provenance?.suppliedAt) {
    issues.push("provenance note and suppliedAt are required");
  }
  if (!runModes.has(item.machine?.runMode)) issues.push("invalid run mode");
  if (item.machine?.runMode === "single_live" && item.machine.stabilityScore !== undefined) {
    issues.push("single_live cannot expose stabilityScore");
  }
  if (
    item.machine?.stabilityScore !== undefined &&
    !inUnitRange(item.machine.stabilityScore)
  ) {
    issues.push("stabilityScore must be between 0 and 1");
  }

  const memoryLength = typeof item.memory?.text === "string" ? textLength(item.memory.text) : 0;
  if (memoryLength < 20 || memoryLength > 400) {
    issues.push("memory text must contain 20–400 characters");
  }
  if (!Array.isArray(item.memory?.emotionTags) || item.memory.emotionTags.length > 3) {
    issues.push("memory may contain at most three emotions");
  }

  if (!inUnitRange(item.semanticGap)) issues.push("semanticGap must be between 0 and 1");

  const parameterValues = item.visualParameters
    ? Object.values(item.visualParameters)
    : [];
  if (parameterValues.length !== 6 || parameterValues.some((entry) => !inUnitRange(entry))) {
    issues.push("visual parameters must contain six values between 0 and 1");
  }

  if (item.status === "published" && item.artifactVisibility !== "public") {
    issues.push("published archive requires a public artifact");
  }
  if (item.status !== "published" && item.artifactVisibility === "public") {
    issues.push("only published archives may expose public artifacts");
  }

  return { ok: issues.length === 0, issues };
}
