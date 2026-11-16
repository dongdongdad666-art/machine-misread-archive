import { describe, expect, it } from "vitest";

import { deriveVisualParameters } from "../../src/generation/derive-parameters";
import { renderArtifact } from "../../src/generation/render-artifact";
import { seedFromParts } from "../../src/generation/seeded-random";

function createRecordingContext() {
  const log: unknown[] = [];
  const methods = [
    "beginPath",
    "closePath",
    "fill",
    "fillRect",
    "fillText",
    "lineTo",
    "moveTo",
    "restore",
    "save",
    "stroke",
  ];
  const target: Record<string, unknown> = { canvas: { width: 800, height: 600 } };

  for (const method of methods) {
    target[method] = (...args: unknown[]) => log.push([method, ...args]);
  }

  const context = new Proxy(target, {
    set(object, property, value) {
      log.push(["set", String(property), value]);
      object[String(property)] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;

  return { context, log };
}

describe("semantic residue generation", () => {
  it("reproduces the same seed", () => {
    expect(seedFromParts(["sha256:abc", "0142", "residue-v1"])).toBe(
      seedFromParts(["sha256:abc", "0142", "residue-v1"]),
    );
  });

  it("maps every visual parameter into 0..1", () => {
    const result = deriveVisualParameters({
      semanticGap: 0.73,
      uncertaintyCount: 2,
      ageYears: 39,
      emotionTags: ["怀念", "归属"],
      contourComplexity: 0.58,
      keywordConflict: 0.81,
    });

    expect(Object.values(result).every((value) => value >= 0 && value <= 1)).toBe(true);
    expect(result.layerOffset).toBeCloseTo(0.73);
  });

  it("records identical drawing operations for the same evidence", () => {
    const first = createRecordingContext();
    const second = createRecordingContext();
    const model = {
      seed: 21060,
      frame: 24,
      reducedMotion: false,
      machineText: "旧式纸质票据",
      memoryText: "一张被留下、但还没有讲完来历的车票。",
      accessionNo: "MMA-OBJ-0001",
      provenance: "物主提供的实物照片",
      parameters: deriveVisualParameters({
        semanticGap: 0.48,
        uncertaintyCount: 3,
        ageYears: 30,
        emotionTags: ["留存"],
        contourComplexity: 0.67,
        keywordConflict: 0.42,
      }),
    };

    renderArtifact(first.context, model);
    renderArtifact(second.context, model);

    expect(second.log).toEqual(first.log);
  });
});
