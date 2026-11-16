import type { GovernanceRecord } from "../../data/governance-fixtures";

interface ReviewQueueProps {
  records: GovernanceRecord[];
  selectedId: string;
  onSelect(id: string): void;
}

const statusLabels = {
  draft: "草稿",
  pending_review: "待审核",
  published: "已发布",
  rejected: "已拒绝",
  withdrawn: "已撤回",
};

function formatSubmittedAt(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export function ReviewQueue({ records, selectedId, onSelect }: ReviewQueueProps) {
  return (
    <section className="governance-section review-queue" aria-labelledby="review-queue-title">
      <header className="governance-section-heading">
        <div>
          <p>审核队列</p>
          <h2 id="review-queue-title">先处理公开边界，再判断作品质量</h2>
        </div>
        <span>{records.length} 件记录</span>
      </header>
      <div className="governance-table-wrap">
        <table aria-label="审核记录队列">
          <caption className="visually-hidden">审核记录队列</caption>
          <thead>
            <tr>
              <th scope="col">档案</th>
              <th scope="col">状态</th>
              <th scope="col">授权范围</th>
              <th scope="col">风险提示</th>
              <th scope="col">提交时间（北京）</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => {
              const selected = record.item.id === selectedId;
              return (
                <tr key={record.item.id} data-selected={selected ? "true" : "false"}>
                  <td data-label="档案">
                    <button
                      className="queue-record-button"
                      type="button"
                      aria-label={`审阅${record.item.objectName}（${record.item.accessionNo}）`}
                      aria-controls="dossier"
                      aria-pressed={selected}
                      onClick={() => onSelect(record.item.id)}
                    >
                      <strong>{record.item.objectName}</strong>
                      <span>{record.item.accessionNo}</span>
                    </button>
                  </td>
                  <td data-label="状态">
                    <span className={`status-line status-line--${record.item.status}`}>
                      <i aria-hidden="true" />{statusLabels[record.item.status]}
                    </span>
                  </td>
                  <td data-label="授权范围">{record.item.sourceVisibility === "public" ? "作品 + 原图" : "仅作品"}</td>
                  <td data-label="风险提示">{record.riskFlags.join("；") || "未发现阻塞项"}</td>
                  <td data-label="提交时间（北京）" className="governance-number">{formatSubmittedAt(record.item.submittedAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
