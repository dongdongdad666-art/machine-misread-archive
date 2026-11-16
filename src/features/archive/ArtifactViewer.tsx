import type { CSSProperties } from "react";
import type { ArchiveItem } from "../../domain/archive";
import { ResidueGlyph, resolveResidueVariant } from "./residue-glyphs";

interface ArtifactViewerProps {
  item: ArchiveItem;
  compact?: boolean;
  accessibleLabel?: string;
}

export function ArtifactViewer({
  item,
  compact = false,
  accessibleLabel,
}: ArtifactViewerProps) {
  const p = item.visualParameters;
  const style = {
    "--gap": p.layerOffset,
    "--fragment": p.fragmentation,
    "--density": p.lineDensity,
    "--temperature": p.colorTemperature,
  } as CSSProperties;
  const offset = 18 + p.layerOffset * 86;
  const fragments = 4 + Math.round(p.fragmentation * 5);
  const variant = resolveResidueVariant(item);

  return (
    <figure
      className={`archive-artifact${compact ? " archive-artifact--compact" : ""}`}
      style={style}
      aria-label={accessibleLabel ?? `${item.objectName}的语义残差作品`}
      data-residue-variant={variant}
    >
      <svg viewBox="0 0 800 520" role="img" aria-hidden="true">
        <rect width="800" height="520" fill="#eee9dc" />
        {Array.from({ length: 8 }).map((_, index) => (
          <line
            key={index}
            x1="40"
            x2={650 + index * 8}
            y1={58 + index * 50}
            y2={56 + index * 50}
            stroke="#172624"
            strokeOpacity={0.1 + p.lineDensity * 0.08}
          />
        ))}
        <ResidueGlyph
          variant={variant}
          offset={offset}
          fragmentation={p.fragmentation}
        />
        {Array.from({ length: fragments }).map((_, index) => (
          <rect
            key={index}
            x={92 + ((item.generationSeed + index * 83) % 590)}
            y={72 + ((item.generationSeed + index * 47) % 350)}
            width={18 + ((item.generationSeed + index * 29) % 62)}
            height="5"
            fill="#e4b83f"
          />
        ))}
        <text x="46" y="42" fill="#172624" fontFamily="monospace" fontSize="14">
          {item.accessionNo} / RESIDUE-V1
        </text>
        {!compact && (
          <text x="46" y="492" fill="#172624" fontFamily="serif" fontSize="22">
            MACHINE ≠ MEMORY · GAP {Math.round(item.semanticGap * 100)}
          </text>
        )}
      </svg>
    </figure>
  );
}
