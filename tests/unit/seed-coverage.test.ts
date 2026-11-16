import { describe, expect, it } from "vitest";

import { seedArchives } from "../../src/data/seed-archives";
import { validateArchiveItem } from "../../src/domain/validation";

describe("seed archive coverage", () => {
  it("contains twelve unique, publishable archive records", () => {
    expect(seedArchives).toHaveLength(12);
    expect(new Set(seedArchives.map((item) => item.accessionNo))).toHaveLength(12);

    for (const item of seedArchives) {
      expect(validateArchiveItem(item), item.accessionNo).toEqual({ ok: true, issues: [] });
    }
  });

  it("keeps failure and boundary evidence visible", () => {
    expect(seedArchives.filter((item) => item.evidenceKind === "failure_or_boundary").length)
      .toBeGreaterThanOrEqual(3);
  });

  it("distinguishes contributed photos from licensed archive photographs", () => {
    const contributed = seedArchives.filter(
      (item) => item.provenance.sourceType === "contributor_photo",
    );

    expect(contributed).toHaveLength(3);
    expect(contributed.every((item) => item.sourceVisibility === "private")).toBe(true);
    expect(contributed.every((item) => !item.sourceUrl.startsWith("/seed-media/"))).toBe(true);
    expect(seedArchives.filter((item) => item.provenance.sourceType === "licensed_archive"))
      .toHaveLength(9);
  });
});
