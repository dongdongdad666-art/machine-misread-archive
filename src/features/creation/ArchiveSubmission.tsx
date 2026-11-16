import { useState } from "react";

interface ArchiveSubmissionProps {
  submitting: boolean;
  submitted: boolean;
  publishable: boolean;
  accessionNo?: string;
  onSubmit(options: {
    publishArtifact: boolean;
    publishSource: boolean;
    publicationConsent: true;
  }): void;
}

export function ArchiveSubmission({
  submitting,
  submitted,
  publishable,
  accessionNo,
  onSubmit,
}: ArchiveSubmissionProps) {
  const [publishArtifact, setPublishArtifact] = useState(false);
  const [publishSource, setPublishSource] = useState(false);
  const [publicationConsent, setPublicationConsent] = useState(false);

  return (
    <section className="creation-stage submission-stage" aria-labelledby="submission-title">
      <div className="stage-index">06 / 公开边界</div>
      <div className="stage-copy">
        <h2 id="submission-title">决定什么可以被看见</h2>
        <p>投稿只进入人工审核队列。分析授权不会自动转换为公开授权。</p>
      </div>
      {!publishable && (
        <p id="submission-unavailable" className="submission-note" role="status">
          临时参数生成的作品仍可下载，但需要重新计算真实语义距离后才能申请入档。
        </p>
      )}
      <fieldset
        className="publication-options"
        disabled={submitting || submitted || !publishable}
      >
        <legend>公开范围</legend>
        <label className="check-line">
          <input
            type="checkbox"
            aria-label="申请公开生成作品与记忆"
            checked={publishArtifact}
            onChange={(event) => setPublishArtifact(event.target.checked)}
          />
          <span><strong>申请公开生成作品与记忆</strong><small>审核通过后进入公共档案馆。</small></span>
        </label>
        <label className="check-line">
          <input
            type="checkbox"
            aria-label="公开原始照片"
            checked={publishSource}
            onChange={(event) => setPublishSource(event.target.checked)}
          />
          <span><strong>公开原始照片</strong><small>默认关闭；不影响生成作品参与审核。</small></span>
        </label>
        <label className="check-line">
          <input
            type="checkbox"
            aria-label="确认本次公开授权"
            checked={publicationConsent}
            onChange={(event) => setPublicationConsent(event.target.checked)}
          />
          <span>
            <strong>确认本次公开授权</strong>
            <small>我理解所选内容仅在人工审核通过后公开。授权文本版本：publication-v1。</small>
          </span>
        </label>
      </fieldset>
      <button
        type="button"
        className="creation-primary"
        disabled={!publishArtifact || !publicationConsent || submitting || submitted || !publishable}
        aria-describedby={!publishable ? "submission-unavailable" : undefined}
        onClick={() => {
          if (publicationConsent) onSubmit({ publishArtifact, publishSource, publicationConsent: true });
        }}
      >
        {submitted
          ? "已进入待审核队列"
          : submitting
            ? "正在提交…"
            : publishable
              ? "提交人工审核"
              : "实时距离不可用，暂不能入档"}
      </button>
      {submitted && accessionNo && (
        <p className="submission-receipt" role="status">
          <span>待审核档案编号</span>
          <strong>{accessionNo}</strong>
          <small>审核完成前，它不会出现在公共档案馆。</small>
        </p>
      )}
    </section>
  );
}
