interface SemanticGapControlProps {
  generating: boolean;
  onGenerate(): void;
}

export function SemanticGapControl({
  generating,
  onGenerate,
}: SemanticGapControlProps) {
  return (
    <section
      className="creation-stage gap-stage"
      aria-labelledby="gap-title"
      aria-busy={generating}
    >
      <div className="stage-index">04 / 语义差轴</div>
      <div className="stage-copy">
        <h2 id="gap-title">让误读留下形状</h2>
        <p>系统将比较机器描述与人类记忆，计算结果只驱动作品，不会改写任何原始文本。</p>
      </div>
      <div className="semantic-axis" aria-label="语义距离计算依据">
        <span className="axis-label axis-label--machine">机器描述</span>
        <span className="semantic-link" aria-hidden="true">对照</span>
        <span className="axis-label axis-label--memory">人类记忆</span>
        <small>text-embedding-v4 · 256 维 · gap-v1</small>
      </div>
      <button
        type="button"
        className="creation-primary"
        disabled={generating}
        onClick={onGenerate}
      >
        {generating ? "正在计算并生成…" : "计算语义距离并生成"}
      </button>
    </section>
  );
}
