import type {
  ChallengeResult,
  ChallengeType,
  EvidenceFocus,
} from "../domain/challenge";

export const OBSERVATION_STORAGE_KEY = "misread-archive:observation:v1";

export interface ObservationAttempt extends ChallengeResult {
  completedAt: string;
}

export interface ObservationTrace {
  version: 1;
  attempts: ObservationAttempt[];
  visitedArchiveIds: string[];
}

export interface ObservationSummary {
  completed: number;
  matched: number;
  different: number;
  dominantFocus: EvidenceFocus | null;
}

const challengeTypes = new Set<ChallengeType>([
  "identity",
  "usage",
  "machine_omission",
  "evidence_boundary",
]);
const evidenceFocuses = new Set<EvidenceFocus>(["shape", "material", "text", "usage", "memory"]);

function emptyTrace(): ObservationTrace {
  return { version: 1, attempts: [], visitedArchiveIds: [] };
}

function isAttempt(value: unknown): value is ObservationAttempt {
  if (typeof value !== "object" || value === null) return false;
  const attempt = value as Partial<ObservationAttempt>;
  return (
    typeof attempt.challengeId === "string" &&
    typeof attempt.archiveId === "string" &&
    challengeTypes.has(attempt.challengeType as ChallengeType) &&
    typeof attempt.selectedOptionId === "string" &&
    typeof attempt.answerOptionId === "string" &&
    typeof attempt.matchedCuratorialAnswer === "boolean" &&
    evidenceFocuses.has(attempt.focus as EvidenceFocus) &&
    typeof attempt.completedAt === "string" &&
    Number.isFinite(Date.parse(attempt.completedAt))
  );
}

function isTrace(value: unknown): value is ObservationTrace {
  if (typeof value !== "object" || value === null) return false;
  const trace = value as Partial<ObservationTrace>;
  return (
    trace.version === 1 &&
    Array.isArray(trace.attempts) &&
    trace.attempts.length <= 100 &&
    trace.attempts.every(isAttempt) &&
    Array.isArray(trace.visitedArchiveIds) &&
    trace.visitedArchiveIds.length <= 100 &&
    trace.visitedArchiveIds.every((id) => typeof id === "string")
  );
}

export function loadObservationTrace(storage: Storage = localStorage): ObservationTrace {
  const raw = storage.getItem(OBSERVATION_STORAGE_KEY);
  if (raw === null) return emptyTrace();

  try {
    const value: unknown = JSON.parse(raw);
    if (isTrace(value)) return value;
  } catch {
    // Invalid observation data is removed below without touching other local records.
  }

  storage.removeItem(OBSERVATION_STORAGE_KEY);
  return emptyTrace();
}

export function recordObservation(
  attempt: ObservationAttempt,
  storage: Storage = localStorage,
): ObservationTrace {
  const current = loadObservationTrace(storage);
  const attempts = [
    ...current.attempts.filter((entry) => entry.challengeId !== attempt.challengeId),
    attempt,
  ].slice(-100);
  const visitedArchiveIds = current.visitedArchiveIds.includes(attempt.archiveId)
    ? current.visitedArchiveIds
    : [...current.visitedArchiveIds, attempt.archiveId].slice(-100);
  const next: ObservationTrace = { version: 1, attempts, visitedArchiveIds };
  storage.setItem(OBSERVATION_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function clearObservationTrace(storage: Storage = localStorage): void {
  storage.removeItem(OBSERVATION_STORAGE_KEY);
}

export function summarizeObservation(trace: ObservationTrace): ObservationSummary {
  const focusCounts = new Map<EvidenceFocus, number>();
  let matched = 0;

  for (const attempt of trace.attempts) {
    if (attempt.matchedCuratorialAnswer) matched += 1;
    focusCounts.set(attempt.focus, (focusCounts.get(attempt.focus) ?? 0) + 1);
  }

  let dominantFocus: EvidenceFocus | null = null;
  let dominantCount = 0;
  for (const [focus, count] of focusCounts) {
    if (count > dominantCount) {
      dominantFocus = focus;
      dominantCount = count;
    }
  }

  return {
    completed: trace.attempts.length,
    matched,
    different: trace.attempts.length - matched,
    dominantFocus,
  };
}
