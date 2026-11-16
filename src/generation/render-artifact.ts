import type { VisualParameters } from "../domain/archive";
import { createSeededRandom } from "./seeded-random";

export interface ArtifactRenderModel {
  seed: number;
  frame: number;
  reducedMotion: boolean;
  machineText: string;
  memoryText: string;
  accessionNo: string;
  provenance: string;
  parameters: VisualParameters;
}

const palette = {
  paper: "#eee9dc",
  ink: "#172624",
  vermilion: "#d94b32",
  violet: "#6851ba",
  evidence: "#e4b83f",
};

function polygon(
  ctx: CanvasRenderingContext2D,
  random: () => number,
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
  points: number,
) {
  ctx.beginPath();
  for (let index = 0; index < points; index += 1) {
    const angle = (Math.PI * 2 * index) / points;
    const variance = 0.82 + random() * 0.28;
    const x = centerX + Math.cos(angle) * radiusX * variance;
    const y = centerY + Math.sin(angle) * radiusY * variance;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function textLines(text: string, length: number): string[] {
  const characters = Array.from(text);
  const lines: string[] = [];
  for (let index = 0; index < characters.length; index += length) {
    lines.push(characters.slice(index, index + length).join(""));
  }
  return lines;
}

export function renderArtifact(
  ctx: CanvasRenderingContext2D,
  model: ArtifactRenderModel,
): void {
  const { width, height } = ctx.canvas;
  const p = model.parameters;
  const random = createSeededRandom(model.seed);
  const seconds = model.reducedMotion ? 0 : model.frame / 60;
  const drift = Math.sin(seconds * (0.4 + p.motionSpeed)) * width * 0.018 * p.layerOffset;
  const centerX = width * 0.48;
  const centerY = height * 0.46;

  ctx.save();
  ctx.fillStyle = palette.paper;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(23, 38, 36, 0.18)";
  ctx.lineWidth = 1;
  const fieldLines = 5 + Math.round(p.lineDensity * 12);
  for (let index = 0; index < fieldLines; index += 1) {
    const y = ((index + 1) / (fieldLines + 1)) * height;
    ctx.beginPath();
    ctx.moveTo(width * 0.06, y);
    ctx.lineTo(width * (0.82 + random() * 0.12), y + (random() - 0.5) * 8);
    ctx.stroke();
  }

  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = palette.vermilion;
  ctx.globalAlpha = 0.78;
  polygon(ctx, random, centerX - drift, centerY, width * 0.22, height * 0.27, 12);
  ctx.fill();

  ctx.fillStyle = palette.violet;
  ctx.globalAlpha = 0.4 + p.layerOffset * 0.38;
  polygon(
    ctx,
    random,
    centerX + width * (0.03 + p.layerOffset * 0.12) + drift,
    centerY - height * p.layerOffset * 0.06,
    width * (0.17 + p.fragmentation * 0.07),
    height * 0.23,
    8 + Math.round(p.fragmentation * 8),
  );
  ctx.fill();

  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = palette.ink;
  ctx.globalAlpha = 0.72;
  ctx.lineWidth = 1 + p.lineDensity * 2;
  polygon(ctx, random, centerX, centerY, width * 0.24, height * 0.29, 18);
  ctx.stroke();

  ctx.fillStyle = palette.evidence;
  ctx.globalAlpha = 0.86;
  const evidenceMarks = 3 + Math.round(p.fragmentation * 8);
  for (let index = 0; index < evidenceMarks; index += 1) {
    const markX = width * (0.1 + random() * 0.8);
    const markY = height * (0.12 + random() * 0.7);
    ctx.fillRect(markX, markY, 3 + random() * 18, 2);
  }

  ctx.globalAlpha = 1;
  ctx.fillStyle = palette.ink;
  ctx.font = `${Math.max(12, Math.round(width * 0.018))}px ui-monospace, monospace`;
  ctx.fillText("MACHINE / 机器层", width * 0.07, height * 0.1);
  textLines(model.machineText, 18).forEach((line, index) => {
    ctx.fillText(line, width * 0.07, height * 0.16 + index * height * 0.04);
  });

  const collisionOffset = width * p.textCollision * 0.08;
  ctx.fillStyle = palette.vermilion;
  ctx.font = `${Math.max(14, Math.round(width * 0.023))}px serif`;
  ctx.fillText("MEMORY / 记忆层", width * 0.61 - collisionOffset, height * 0.68);
  textLines(model.memoryText, 15).forEach((line, index) => {
    ctx.fillText(line, width * 0.61 - collisionOffset, height * 0.74 + index * height * 0.045);
  });

  ctx.fillStyle = palette.ink;
  ctx.globalAlpha = 0.68;
  ctx.font = `${Math.max(10, Math.round(width * 0.013))}px ui-monospace, monospace`;
  ctx.fillText(model.accessionNo, width * 0.07, height * 0.92);
  ctx.fillText(model.provenance, width * 0.34, height * 0.92);
  ctx.restore();
}
