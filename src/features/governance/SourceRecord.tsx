import type { GovernanceArchiveItem } from "../../data/governance-fixtures";
import type { MachineReading } from "../../domain/archive";

interface SourceRecordProps {
  run: MachineReading;
  item: GovernanceArchiveItem;
}

export function SourceRecord({ run, item }: SourceRecordProps) {
  return (
    <section className="source-record-panel" aria-labelledby="source-record-title">
      <header>
        <p>来源链</p>
        <h3 id="source-record-title">从模型运行到公开授权</h3>
      </header>
      <dl>
        <div><dt>模型快照</dt><dd>{run.modelSnapshot}</dd></div>
        <div><dt>提示词版本</dt><dd>{run.promptVersion}</dd></div>
        <div><dt>授权文本</dt><dd>{item.consentVersion}</dd></div>
        <div><dt>生成引擎</dt><dd>{item.engineVersion}</dd></div>
        <div><dt>原图边界</dt><dd>{item.sourceVisibility === "public" ? "已申请公开" : "原始照片保持私密"}</dd></div>
        <div><dt>来源类型</dt><dd>{item.provenance.sourceType === "contributor_photo" ? "投稿者实物照片" : "许可档案素材"}</dd></div>
      </dl>
      <details>
        <summary>查看来源说明</summary>
        <p>{item.provenance.note}</p>
      </details>
    </section>
  );
}
