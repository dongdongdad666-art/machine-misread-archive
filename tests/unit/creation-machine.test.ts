import { describe, expect, it } from "vitest";

import { seedArchives } from "../../src/data/seed-archives";
import {
  initialCreationState,
  transition,
  type AcceptedImage,
} from "../../src/domain/creation-machine";

const fixtureImage: AcceptedImage = {
  name: "ticket.webp",
  type: "image/webp",
  size: 162_682,
  width: 1200,
  height: 1600,
  previewUrl: "blob:local-preview",
};

describe("creation workflow", () => {
  it("moves through the approved flow", () => {
    const seed = seedArchives[0];
    let state = initialCreationState();
    state = transition(state, { type: "IMAGE_ACCEPTED", image: fixtureImage });
    state = transition(state, {
      type: "ANALYSIS_SUCCEEDED",
      analysisId: "analysis-01",
      reading: seed.machine,
    });
    state = transition(state, { type: "MEMORY_COMPLETED", memory: seed.memory });
    state = transition(state, {
      type: "GAP_SUCCEEDED",
      gap: 0.73,
      generationSeed: 21060,
      parameters: seed.visualParameters,
      mode: "measured",
      algorithmVersion: "gap-v1",
      publishable: true,
    });

    expect(state.stage).toBe("generated");
    expect(state.analysisId).toBe("analysis-01");
    expect(state.memoryText).toBe(seed.memory.text);
    expect(state.generationSeed).toBe(21060);
  });

  it("fails closed when a temporary gap tries to enter review", () => {
    const seed = seedArchives[0];
    let state = transition(initialCreationState(), { type: "IMAGE_ACCEPTED", image: fixtureImage });
    state = transition(state, {
      type: "ANALYSIS_SUCCEEDED",
      analysisId: "analysis-01",
      reading: seed.machine,
    });
    state = transition(state, { type: "MEMORY_COMPLETED", memory: seed.memory });
    state = transition(state, {
      type: "GAP_SUCCEEDED",
      gap: 0.5,
      generationSeed: 21060,
      parameters: seed.visualParameters,
      mode: "temporary",
      algorithmVersion: "temporary-fixed-v1",
      publishable: false,
    });

    expect(() => transition(state, {
      type: "SUBMISSION_REQUESTED",
      submissionId: "submission-01",
      accessionNo: "MMA-20260910-12345678",
    })).toThrow("Only measured artifacts can enter review");
  });

  it("does not publish from the client", () => {
    expect(() =>
      transition(initialCreationState(), { type: "PUBLISH" } as never),
    ).toThrow("Illegal creation transition");
  });

  it("returns to a recoverable draft after analysis failure", () => {
    let state = transition(initialCreationState(), {
      type: "IMAGE_ACCEPTED",
      image: fixtureImage,
    });
    state = transition(state, {
      type: "ANALYSIS_FAILED",
      message: "模型暂时不可用",
    });

    expect(state.stage).toBe("local_draft");
    expect(state.image?.name).toBe("ticket.webp");
    expect(state.error).toBe("模型暂时不可用");
  });
});
