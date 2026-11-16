import { describe, expect, it } from "vitest";

import { seedArchives } from "../../src/data/seed-archives";
import { seedChallenges } from "../../src/data/seed-challenges";
import {
  evaluateChallenge,
  findChallenge,
  nextChallengeArchiveId,
} from "../../src/domain/challenge";

describe("curated archive challenges", () => {
  it("covers every seed archive exactly once", () => {
    expect(seedChallenges.map((item) => item.archiveId)).toEqual(
      seedArchives.map((item) => item.id),
    );
    expect(new Set(seedChallenges.map((item) => item.id)).size).toBe(12);
  });

  it("evaluates a literal selection without inventing a personality score", () => {
    const challenge = seedChallenges[0];
    const result = evaluateChallenge(challenge, "fare-proof");

    expect(result).toEqual({
      challengeId: "challenge-bus-ticket-usage",
      archiveId: "seed-bus-ticket-collection-01",
      challengeType: "usage",
      selectedOptionId: "fare-proof",
      answerOptionId: "fare-proof",
      matchedCuratorialAnswer: true,
      focus: "usage",
    });
    expect(result).not.toHaveProperty("score");
  });

  it("rejects a selection that is not part of the challenge", () => {
    expect(() => evaluateChallenge(seedChallenges[0], "not-an-option"))
      .toThrow("Unknown challenge option");
  });

  it("finds and cycles through curated challenges deterministically", () => {
    expect(findChallenge(seedChallenges, "seed-old-keys-01")?.id)
      .toBe("challenge-keys-identity");
    expect(nextChallengeArchiveId("seed-digital-clock-01", seedChallenges))
      .toBe("seed-bus-ticket-collection-01");
    expect(nextChallengeArchiveId("unknown", seedChallenges))
      .toBe("seed-bus-ticket-collection-01");
  });
});
