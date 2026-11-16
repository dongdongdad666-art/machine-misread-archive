import { describe, expect, it } from "vitest";

import { seedArchives } from "../../src/data/seed-archives";
import { validateArchiveItem } from "../../src/domain/validation";

describe("archive validation", () => {
  it("keeps three distinct foundational records with provenance", () => {
    const foundational = seedArchives.filter(
      (item) => item.provenance.sourceType === "contributor_photo",
    );

    expect(foundational).toHaveLength(3);
    expect(new Set(foundational.map((item) => item.objectName)).size).toBe(3);
    expect(foundational.every((item) => item.provenance.note.length > 0)).toBe(true);
    expect(foundational.every((item) => item.sourceVisibility === "private")).toBe(true);
  });

  it("accepts every foundational seed archive", () => {
    expect(seedArchives.flatMap((item) => validateArchiveItem(item).issues)).toEqual([]);
  });

  it("rejects fabricated live confidence", () => {
    const value = structuredClone(seedArchives[0]);
    value.machine.runMode = "single_live";
    value.machine.stabilityScore = 0.61;

    expect(validateArchiveItem(value).issues).toContain(
      "single_live cannot expose stabilityScore",
    );
  });

  it("rejects memory outside 20–400 characters", () => {
    const value = structuredClone(seedArchives[0]);
    value.memory.text = "太短";

    expect(validateArchiveItem(value).ok).toBe(false);
  });
});
