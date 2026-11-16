import { beforeEach, describe, expect, it } from "vitest";

import type { ChallengeResult } from "../../src/domain/challenge";
import { DRAFT_STORAGE_KEY } from "../../src/lib/local-draft";
import {
  OBSERVATION_STORAGE_KEY,
  clearObservationTrace,
  loadObservationTrace,
  recordObservation,
  summarizeObservation,
} from "../../src/lib/observation-trace";

const result: ChallengeResult = {
  challengeId: "challenge-bus-ticket-usage",
  archiveId: "seed-bus-ticket-collection-01",
  challengeType: "usage",
  selectedOptionId: "fare-proof",
  answerOptionId: "fare-proof",
  matchedCuratorialAnswer: true,
  focus: "usage",
};

describe("personal observation trace", () => {
  beforeEach(() => localStorage.clear());

  it("starts empty and replaces a repeated challenge attempt", () => {
    expect(loadObservationTrace()).toEqual({
      version: 1,
      attempts: [],
      visitedArchiveIds: [],
    });

    recordObservation({ ...result, completedAt: "2026-09-11T10:00:00.000Z" });
    recordObservation({
      ...result,
      selectedOptionId: "route-map",
      matchedCuratorialAnswer: false,
      completedAt: "2026-09-11T10:01:00.000Z",
    });

    const trace = loadObservationTrace();
    expect(trace.attempts).toHaveLength(1);
    expect(trace.attempts[0].selectedOptionId).toBe("route-map");
    expect(trace.visitedArchiveIds).toEqual(["seed-bus-ticket-collection-01"]);
  });

  it("removes only invalid observation data", () => {
    localStorage.setItem(OBSERVATION_STORAGE_KEY, "broken-json");
    localStorage.setItem(DRAFT_STORAGE_KEY, "untouched");

    expect(loadObservationTrace()).toEqual({
      version: 1,
      attempts: [],
      visitedArchiveIds: [],
    });
    expect(localStorage.getItem(OBSERVATION_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(DRAFT_STORAGE_KEY)).toBe("untouched");
  });

  it("summarizes observable behavior without a personality score", () => {
    const summary = summarizeObservation({
      version: 1,
      attempts: [
        { ...result, completedAt: "2026-09-11T10:00:00.000Z" },
        {
          ...result,
          challengeId: "challenge-keys-identity",
          archiveId: "seed-old-keys-01",
          challengeType: "identity",
          selectedOptionId: "hairpins",
          answerOptionId: "keys",
          matchedCuratorialAnswer: false,
          focus: "shape",
          completedAt: "2026-09-11T10:02:00.000Z",
        },
        {
          ...result,
          challengeId: "challenge-payphone-usage",
          archiveId: "seed-card-payphone-01",
          selectedOptionId: "public-call",
          answerOptionId: "public-call",
          focus: "usage",
          completedAt: "2026-09-11T10:03:00.000Z",
        },
      ],
      visitedArchiveIds: [
        "seed-bus-ticket-collection-01",
        "seed-old-keys-01",
        "seed-card-payphone-01",
      ],
    });

    expect(summary).toEqual({ completed: 3, matched: 2, different: 1, dominantFocus: "usage" });
    expect(summary).not.toHaveProperty("personality");
    expect(summary).not.toHaveProperty("score");
  });

  it("clears only the personal observation trace", () => {
    localStorage.setItem(OBSERVATION_STORAGE_KEY, "trace");
    localStorage.setItem(DRAFT_STORAGE_KEY, "draft");

    clearObservationTrace();

    expect(localStorage.getItem(OBSERVATION_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(DRAFT_STORAGE_KEY)).toBe("draft");
  });
});
