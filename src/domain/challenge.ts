export type ChallengeType =
  | "identity"
  | "usage"
  | "machine_omission"
  | "evidence_boundary";

export type EvidenceFocus = "shape" | "material" | "text" | "usage" | "memory";

export interface ChallengeOption {
  id: string;
  label: string;
}

export interface ChallengeDefinition {
  id: string;
  archiveId: string;
  type: ChallengeType;
  focus: EvidenceFocus;
  prompt: string;
  clue: string;
  options: ChallengeOption[];
  answerOptionId: string;
  curatorialRationale: string;
  userOmission: string;
  machineOmission: string;
}

export interface ChallengeResult {
  challengeId: string;
  archiveId: string;
  challengeType: ChallengeType;
  selectedOptionId: string;
  answerOptionId: string;
  matchedCuratorialAnswer: boolean;
  focus: EvidenceFocus;
}

export function evaluateChallenge(
  challenge: ChallengeDefinition,
  selectedOptionId: string,
): ChallengeResult {
  if (!challenge.options.some((option) => option.id === selectedOptionId)) {
    throw new Error("Unknown challenge option");
  }

  return {
    challengeId: challenge.id,
    archiveId: challenge.archiveId,
    challengeType: challenge.type,
    selectedOptionId,
    answerOptionId: challenge.answerOptionId,
    matchedCuratorialAnswer: selectedOptionId === challenge.answerOptionId,
    focus: challenge.focus,
  };
}

export function findChallenge(
  challenges: readonly ChallengeDefinition[],
  archiveId: string,
) {
  return challenges.find((challenge) => challenge.archiveId === archiveId);
}

export function nextChallengeArchiveId(
  currentArchiveId: string,
  challenges: readonly ChallengeDefinition[],
) {
  if (challenges.length === 0) return currentArchiveId;
  const currentIndex = challenges.findIndex((challenge) => challenge.archiveId === currentArchiveId);
  return challenges[(currentIndex + 1) % challenges.length].archiveId;
}
