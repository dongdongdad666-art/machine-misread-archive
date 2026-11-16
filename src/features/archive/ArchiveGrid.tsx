import { Link } from "react-router-dom";
import type { ArchiveItem } from "../../domain/archive";
import { ArtifactViewer } from "./ArtifactViewer";
import { SourcePreview } from "./SourcePreview";

export function ArchiveGrid({ records }: { records: ArchiveItem[] }) {
  if (records.length === 0) {
    return <p className="archive-empty">这一组筛选条件下还没有公开档案。</p>;
  }

  return (
    <div className="archive-grid">
      {records.map((item, index) => (
        <article className="archive-card" key={item.id}>
          <Link to={`/archive/${item.id}`} aria-label={`打开档案：${item.objectName}`}>
            <div className="archive-visual-pair" role="group" aria-label="实物证据与机器残差对照">
              <div className="archive-visual-panel archive-visual-panel--source">
                <span className="archive-visual-label">实物照片</span>
                <SourcePreview item={item} />
              </div>
              <div className="archive-visual-panel archive-visual-panel--artifact">
                <span className="archive-visual-label">机器残差</span>
                <ArtifactViewer item={item} compact />
              </div>
            </div>
            <div className="archive-card-copy">
              <span className="archive-order">{String(index + 1).padStart(2, "0")}</span>
              <h2>{item.objectName}</h2>
              <p>{item.machine.labels[0]} → {item.memory.relation}</p>
              <dl>
                <div><dt>语义差</dt><dd>{Math.round(item.semanticGap * 100)}%</dd></div>
                <div><dt>消失方式</dt><dd>{item.disappearanceMode}</dd></div>
              </dl>
            </div>
          </Link>
        </article>
      ))}
    </div>
  );
}
