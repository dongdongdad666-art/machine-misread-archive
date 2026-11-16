import { useRef, useState } from "react";
import type { GovernanceRecord, ModerationEvent } from "../../data/governance-fixtures";

interface ModerationDecisionProps {
  record: GovernanceRecord;
}

const reasonLabels: Record<string, string> = {
  "personal-data": "个人信息未处理",
  "rights-unclear": "权利或来源不清",
  "memory-invention": "记忆内容疑似代写",
  "scope-mismatch": "公开范围与授权不符",
};

const decisionLabels: Record<ModerationEvent["decision"], string> = {
  approve: "批准公开",
  reject: "拒绝公开",
  request_change: "退回补充",
  withdraw: "确认撤回",
};

function formatDecisionTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export function ModerationDecision({ record }: ModerationDecisionProps) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [events, setEvents] = useState(record.moderationEvents);
  const reasonRef = useRef<HTMLSelectElement>(null);
  const actionCountRef = useRef(0);
  const withdrawalPending = Boolean(record.item.withdrawalRequestedAt);

  const recordDecision = (decision: ModerationEvent["decision"]) => {
    if (decision === "reject" && !reason) {
      setError("请选择拒绝原因");
      reasonRef.current?.focus();
      return;
    }
    setError("");
    actionCountRef.current += 1;
    setMessage(`已记录原型审核动作：第 ${actionCountRef.current} 次${decisionLabels[decision]}；未写入生产数据。`);
    setEvents((current) => [
      {
        id: `prototype-${current.length + 1}`,
        archiveItemId: record.item.id,
        decision,
        reasonCodes: decision === "reject" && reason ? [reason] : [],
        note: note.trim(),
        actorLabel: "当前访客 / 高保真原型",
        createdAt: new Date().toISOString(),
      },
      ...current,
    ]);
    setReason("");
    setNote("");
  };

  return (
    <section className="moderation-decision" aria-labelledby="moderation-title">
      <header>
        <div>
          <p>审核判断</p>
          <h3 id="moderation-title">每个决定都必须留下依据</h3>
        </div>
        <small>本页不会写入生产审核记录</small>
      </header>

      {record.item.withdrawalRequestedAt && (
        <div className="withdrawal-notice">
          <span className="status-line status-line--withdrawn"><i aria-hidden="true" />待处理撤回</span>
          <p>投稿者已申请撤回公开授权。审核发布动作应暂停，先完成撤回留痕。</p>
        </div>
      )}

      <div className="moderation-form">
        {!withdrawalPending && (
          <>
            <label htmlFor="moderation-reason">拒绝原因</label>
            <select
              ref={reasonRef}
              id="moderation-reason"
              name="moderation-reason"
              value={reason}
              aria-invalid={error ? "true" : "false"}
              aria-describedby={error ? "moderation-reason-error" : undefined}
              onChange={(event) => {
                setReason(event.target.value);
                if (error) setError("");
              }}
            >
              <option value="">仅拒绝时必选</option>
              {Object.entries(reasonLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            {error && <p id="moderation-reason-error" className="moderation-error" role="alert">{error}</p>}
          </>
        )}

        <label htmlFor="moderation-note">审核备注</label>
        <textarea
          id="moderation-note"
          name="moderation-note"
          rows={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="记录可核验事实、需要补充的内容或撤回说明"
        />
      </div>

      <div className="moderation-actions">
        {withdrawalPending ? (
          <button type="button" className="governance-action governance-action--danger" onClick={() => recordDecision("withdraw")}>确认撤回</button>
        ) : (
          <>
            <button type="button" className="governance-action governance-action--primary" onClick={() => recordDecision("approve")}>批准公开</button>
            <button type="button" className="governance-action" onClick={() => recordDecision("request_change")}>退回补充</button>
            <button type="button" className="governance-action governance-action--danger" onClick={() => recordDecision("reject")}>拒绝公开</button>
          </>
        )}
      </div>
      {message && <p className="moderation-success" role="status">{message}</p>}

      <div className="decision-history" role="region" aria-labelledby="decision-history-title">
        <h4 id="decision-history-title">决策留痕</h4>
        {events.length === 0 ? (
          <p>尚无审核事件。首次判断将在这里形成可追溯记录。</p>
        ) : (
          <ol>
            {events.map((event) => (
              <li key={event.id}>
                <strong>{decisionLabels[event.decision]}</strong>
                <span>{event.reasonCodes.map((code) => reasonLabels[code] ?? code).join("、") || "无附加原因"}</span>
                {event.note && <p>{event.note}</p>}
                <small>
                  <time dateTime={event.createdAt}>{formatDecisionTime(event.createdAt)}</time>
                  <span>{event.actorLabel}</span>
                </small>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
