export type RunMode = "single_live" | "seed_repeated";

export type ArchiveStatus =
  | "draft"
  | "pending_review"
  | "published"
  | "rejected"
  | "withdrawn";

export type EvidenceKind = "standard" | "failure_or_boundary";
export type DisappearanceMode =
  | "媒介替代"
  | "制度更替"
  | "语境丢失"
  | "失去用途"
  | "尚待确认";

export interface VisualParameters {
  layerOffset: number;
  fragmentation: number;
  motionSpeed: number;
  colorTemperature: number;
  lineDensity: number;
  textCollision: number;
}

export interface MachineReading {
  labels: string[];
  caption: string;
  materials: string[];
  visibleText: string[];
  uncertainties: string[];
  runMode: RunMode;
  stabilityScore?: number;
  modelId: string;
  modelSnapshot: string;
  promptVersion: string;
}

export interface HumanMemory {
  text: string;
  relation: string;
  emotionTags: string[];
}

export interface ArchiveProvenance {
  sourceType: "contributor_photo" | "licensed_archive";
  note: string;
  capturedAt?: string;
  suppliedAt: string;
  creator?: string;
  sourcePageUrl?: string;
  licenseName?: string;
  licenseUrl?: string;
  transformNote?: string;
}

export interface ArchiveItem {
  id: string;
  accessionNo: string;
  status: ArchiveStatus;
  evidenceKind: EvidenceKind;
  disappearanceMode: DisappearanceMode;
  objectName: string;
  timeRange: string;
  city: string;
  sourceUrl: string;
  sourceVisibility: "private" | "public";
  artifactVisibility: "private" | "public_requested" | "public";
  provenance: ArchiveProvenance;
  machine: MachineReading;
  memory: HumanMemory;
  semanticGap: number;
  generationSeed: number;
  engineVersion: "residue-v1";
  visualParameters: VisualParameters;
}
