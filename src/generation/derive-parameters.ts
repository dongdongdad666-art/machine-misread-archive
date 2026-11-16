import type { VisualParameters } from "../domain/archive.js";

export interface GenerationInputs {
  semanticGap: number;
  uncertaintyCount: number;
  ageYears: number;
  emotionTags: string[];
  contourComplexity: number;
  keywordConflict: number;
}

const emotionTemperature: Record<string, number> = {
  怀念: 0.82,
  归属: 0.74,
  温暖: 0.88,
  留存: 0.7,
  等待补述: 0.5,
  疏离: 0.28,
  焦虑: 0.2,
  遗憾: 0.38,
};

export const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export function deriveVisualParameters(input: GenerationInputs): VisualParameters {
  const temperatures = input.emotionTags.map((tag) => emotionTemperature[tag] ?? 0.5);
  const colorTemperature = temperatures.length
    ? temperatures.reduce((sum, value) => sum + value, 0) / temperatures.length
    : 0.5;

  return {
    layerOffset: clamp01(input.semanticGap),
    fragmentation: clamp01(input.uncertaintyCount / 5),
    motionSpeed: 1 - clamp01(input.ageYears / 80),
    colorTemperature: clamp01(colorTemperature),
    lineDensity: clamp01(input.contourComplexity),
    textCollision: clamp01(input.keywordConflict),
  };
}
