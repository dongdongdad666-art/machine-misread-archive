import type { ArchiveItem } from "../../domain/archive";
import { ArtifactViewer } from "./ArtifactViewer";
import { DualInterpretation } from "./DualInterpretation";
import { SourcePreview } from "./SourcePreview";
import { ArchiveDrawers } from "./ArchiveDrawers";

export function ArchiveDetail({ item }: { item: ArchiveItem }) {
  return (
    <article className="archive-detail">
      <header className="archive-detail-hero">
        <div>
          <p className="section-label">{item.accessionNo} / {item.disappearanceMode}</p>
          <h1>{item.objectName}</h1>
        </div>
        <dl>
          <div><dt>年代线索</dt><dd>{item.timeRange}</dd></div>
          <div><dt>地点</dt><dd>{item.city}</dd></div>
          <div><dt>语义差</dt><dd>{Math.round(item.semanticGap * 100)}%</dd></div>
        </dl>
      </header>

      <div className="archive-visual-pair archive-visual-pair--detail" role="group" aria-label="实物证据与机器残差对照">
        <div className="archive-visual-panel archive-visual-panel--source">
          <span className="archive-visual-label">实物照片</span>
          <SourcePreview item={item} />
        </div>
        <div className="archive-visual-panel archive-visual-panel--artifact">
          <span className="archive-visual-label">机器残差</span>
          <ArtifactViewer item={item} />
        </div>
      </div>
      <DualInterpretation item={item} />
      <ArchiveDrawers item={item} />

      <section className="source-evidence" aria-labelledby="source-title">
        <header>
          <p className="section-label">PROVENANCE / 来源边界</p>
          <h2 id="source-title">证据到哪里为止</h2>
        </header>
        <div className="source-record">
          <dl>
            <div><dt>来源说明</dt><dd>{item.provenance.note}</dd></div>
            {item.provenance.sourceType === "licensed_archive" && (
              <>
                <div><dt>影像作者</dt><dd>{item.provenance.creator}</dd></div>
                <div>
                  <dt>来源页面</dt>
                  <dd><a href={item.provenance.sourcePageUrl} target="_blank" rel="noreferrer">查看 Wikimedia Commons 来源页</a></dd>
                </div>
                <div>
                  <dt>许可</dt>
                  <dd><a href={item.provenance.licenseUrl} target="_blank" rel="noreferrer">{item.provenance.licenseName}</a></dd>
                </div>
                <div><dt>派生处理</dt><dd>{item.provenance.transformNote}</dd></div>
              </>
            )}
            <div><dt>素材提交</dt><dd>{item.provenance.suppliedAt}</dd></div>
            <div>
              <dt>模型与提示词版本</dt>
              <dd>{item.machine.modelId} / {item.machine.modelSnapshot} / {item.machine.promptVersion}</dd>
            </div>
            <div><dt>生成引擎</dt><dd>{item.engineVersion} / seed {item.generationSeed}</dd></div>
          </dl>
        </div>
      </section>
    </article>
  );
}
