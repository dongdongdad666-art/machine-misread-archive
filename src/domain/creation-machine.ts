import type { HumanMemory, MachineReading, VisualParameters } from "./archive";

export type CreationStage =
  | "local_draft"
  | "analyzing"
  | "interpreted"
  | "memory_complete"
  | "generated"
  | "pending_review";

export interface AcceptedImage {
  name: string;
  type: string;
  size: number;
  width: number;
  height: number;
  previewUrl: string;
}

export interface CreationState {
  stage: CreationStage;
  image?: AcceptedImage;
  analysisId?: string;
  reading?: MachineReading;
  memory?: HumanMemory;
  memoryText: string;
  semanticGap?: number;
  generationSeed?: number;
  parameters?: VisualParameters;
  gapMode?: "measured" | "temporary";
  gapAlgorithmVersion?: string;
  publishable?: boolean;
  submissionId?: string;
  accessionNo?: string;
  error?: string;
}

export type CreationEvent =
  | { type: "IMAGE_ACCEPTED"; image: AcceptedImage }
  | { type: "ANALYSIS_SUCCEEDED"; analysisId: string; reading: MachineReading }
  | { type: "ANALYSIS_FAILED"; message: string }
  | { type: "MEMORY_COMPLETED"; memory: HumanMemory }
  | {
      type: "GAP_SUCCEEDED";
      gap: number;
      generationSeed: number;
      parameters: VisualParameters;
      mode: "measured" | "temporary";
      algorithmVersion: string;
      publishable: boolean;
    }
  | { type: "SUBMISSION_REQUESTED"; submissionId: string; accessionNo: string };

export function initialCreationState(): CreationState {
  return { stage: "local_draft", memoryText: "" };
}

function assertStage(
  state: CreationState,
  eventType: CreationEvent["type"],
  expected: CreationStage,
) {
  if (state.stage !== expected) {
    throw new Error(`Illegal creation transition: ${state.stage} → ${eventType}`);
  }
}

export function transition(state: CreationState, event: CreationEvent): CreationState {
  switch (event.type) {
    case "IMAGE_ACCEPTED":
      assertStage(state, event.type, "local_draft");
      return { ...state, stage: "analyzing", image: event.image, error: undefined };

    case "ANALYSIS_SUCCEEDED":
      assertStage(state, event.type, "analyzing");
      return {
        ...state,
        stage: "interpreted",
        analysisId: event.analysisId,
        reading: event.reading,
        error: undefined,
      };

    case "ANALYSIS_FAILED":
      assertStage(state, event.type, "analyzing");
      return { ...state, stage: "local_draft", error: event.message };

    case "MEMORY_COMPLETED":
      assertStage(state, event.type, "interpreted");
      return {
        ...state,
        stage: "memory_complete",
        memory: event.memory,
        memoryText: event.memory.text,
      };

    case "GAP_SUCCEEDED":
      assertStage(state, event.type, "memory_complete");
      return {
        ...state,
        stage: "generated",
        semanticGap: event.gap,
        generationSeed: event.generationSeed,
        parameters: event.parameters,
        gapMode: event.mode,
        gapAlgorithmVersion: event.algorithmVersion,
        publishable: event.publishable,
      };

    case "SUBMISSION_REQUESTED":
      assertStage(state, event.type, "generated");
      if (state.gapMode !== "measured" || state.publishable !== true) {
        throw new Error("Only measured artifacts can enter review");
      }
      return {
        ...state,
        stage: "pending_review",
        submissionId: event.submissionId,
        accessionNo: event.accessionNo,
      };

    default: {
      const unknownEvent = event as { type?: string };
      throw new Error(
        `Illegal creation transition: ${state.stage} → ${unknownEvent.type ?? "unknown"}`,
      );
    }
  }
}
