import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { seedArchives } from "../../src/data/seed-archives";
import {
  ResidueGlyph,
  resolveResidueVariant,
  type ResidueVariant,
} from "../../src/features/archive/residue-glyphs";

const expected: Record<string, ResidueVariant> = {
  "seed-bus-ticket-collection-01": "bus-tickets",
  "seed-old-keys-01": "keys",
  "seed-old-dictionary-01": "dictionary",
  "seed-audio-cassette-01": "audio-cassette",
  "seed-floppy-disk-01": "floppy-disk",
  "seed-vhs-tape-01": "vhs-tape",
  "seed-numeric-pager-01": "pager",
  "seed-card-payphone-01": "payphone",
  "seed-slide-rule-01": "slide-rule",
  "seed-rotary-telephone-01": "rotary-phone",
  "seed-film-canisters-01": "film-canisters",
  "seed-digital-clock-01": "digital-clock",
};

describe("object-specific residue glyphs", () => {
  it("assigns a different semantic glyph to every curated seed object", () => {
    const variants = seedArchives.map((item) => resolveResidueVariant(item));

    expect(Object.fromEntries(seedArchives.map((item, index) => [item.id, variants[index]])))
      .toEqual(expected);
    expect(new Set(variants).size).toBe(seedArchives.length);
  });

  it("uses the generic glyph for an unknown archive", () => {
    expect(resolveResidueVariant({ id: "future-live-record" })).toBe("generic");
  });

  it("marks each glyph group with its semantic variant", () => {
    const { container } = render(
      <svg><ResidueGlyph variant="keys" offset={42} fragmentation={0.6} /></svg>,
    );

    expect(container.querySelector('g[data-glyph="keys"]')).toBeInTheDocument();
  });
});
