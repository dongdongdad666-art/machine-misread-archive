import { beforeEach, describe, expect, it } from "vitest";

import { seedArchives } from "../../src/data/seed-archives";
import {
  initialCreationState,
  transition,
  type AcceptedImage,
} from "../../src/domain/creation-machine";
import {
  clearDraft,
  DRAFT_STORAGE_KEY,
  loadDraft,
  saveDraft,
} from "../../src/lib/local-draft";

const fixtureImage: AcceptedImage = {
  name: "private-source.jpg",
  type: "image/jpeg",
  size: 10,
  width: 100,
  height: 100,
  previewUrl: "data:image/jpeg;base64,private-bytes",
};

function generatedState() {
  const seed = seedArchives[0];
  let state = transition(initialCreationState(), {
    type: "IMAGE_ACCEPTED",
    image: fixtureImage,
  });
  state = transition(state, {
    type: "ANALYSIS_SUCCEEDED",
    analysisId: "analysis-01",
    reading: seed.machine,
  });
  state = transition(state, { type: "MEMORY_COMPLETED", memory: seed.memory });
  return transition(state, {
    type: "GAP_SUCCEEDED",
    gap: seed.semanticGap,
    generationSeed: seed.generationSeed,
    parameters: seed.visualParameters,
    mode: "temporary",
    algorithmVersion: "temporary-fixed-v1",
    publishable: false,
  });
}

describe("versioned local draft", () => {
  beforeEach(() => localStorage.clear());

  it("restores workflow fields without storing image bytes", () => {
    const state = generatedState();
    saveDraft(state);

    const raw = localStorage.getItem(DRAFT_STORAGE_KEY) ?? "";
    expect(raw).not.toContain("data:image");
    expect(raw).not.toContain("private-source.jpg");
    expect(loadDraft()).toMatchObject({
      version: 1,
      stage: "generated",
      analysisId: "analysis-01",
      memoryText: state.memoryText,
      generationSeed: state.generationSeed,
      parameters: state.parameters,
      gapMode: "temporary",
      gapAlgorithmVersion: "temporary-fixed-v1",
      publishable: false,
    });
  });

  it.each(["not-json", JSON.stringify({ version: 2 })])(
    "removes only an invalid archive draft",
    (invalidValue) => {
      localStorage.setItem(DRAFT_STORAGE_KEY, invalidValue);
      localStorage.setItem("unrelated", "keep-me");

      expect(loadDraft()).toBeNull();
      expect(localStorage.getItem(DRAFT_STORAGE_KEY)).toBeNull();
      expect(localStorage.getItem("unrelated")).toBe("keep-me");
    },
  );

  it("rejects generated drafts whose publishability provenance is missing", () => {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({
      version: 1,
      stage: "generated",
      memoryText: "一段足够长的人类记忆文本。",
      semanticGap: 0.5,
      generationSeed: 21060,
      parameters: seedArchives[0].visualParameters,
    }));

    expect(loadDraft()).toBeNull();
    expect(localStorage.getItem(DRAFT_STORAGE_KEY)).toBeNull();
  });

  it("clears only the archive draft", () => {
    localStorage.setItem(DRAFT_STORAGE_KEY, "draft");
    localStorage.setItem("unrelated", "keep-me");

    clearDraft();

    expect(localStorage.getItem(DRAFT_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem("unrelated")).toBe("keep-me");
  });
});
