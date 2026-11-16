import { useMemo, useState } from "react";
import {
  governanceCollections,
  governanceRecords,
  type GovernanceCollection,
  type GovernanceRecord,
} from "../data/governance-fixtures";
import { ArtifactViewer } from "../features/archive/ArtifactViewer";
import { CuratorialCollection } from "../features/governance/CuratorialCollection";
import { ModerationDecision } from "../features/governance/ModerationDecision";
import { ReviewQueue } from "../features/governance/ReviewQueue";
import { SourceRecord } from "../features/governance/SourceRecord";

interface GovernancePageProps {
  records?: GovernanceRecord[];
  collections?: GovernanceCollection[];
}

export function GovernancePage({
  records = governanceRecords,
  collections = governanceCollections,
}: GovernancePageProps) {
  const [selectedId, setSelectedId] = useState(records[0]?.item.id ?? "");
  const [selectionMessage, setSelectionMessage] = useState("");
  const selected = records.find((record) => record.item.id === selectedId) ?? records[0];
  const counts = useMemo(() => ({
    pending: records.filter((record) => record.item.status === "pending_review").length,
    flagged: records.filter((record) => record.riskFlags.length > 0).length,
    withdrawals: records.filter((record) => record.item.withdrawalRequestedAt).length,
  }), [records]);
  const selectRecord = (id: string) => {
    const next = records.find((record) => record.item.id === id);
    setSelectedId(id);
    setSelectionMessage(next ? `已载入《${next.item.objectName}》证据` : "");
  };

  return (
    <section className="page page--governance">
      <header className="governance-hero">
        <div>
          <p className="section-label">企业证据 / 高保真原型</p>
          <h1>治理台</h1>
          <p>把来源、授权、模型版本和人工判断放在同一条可追溯链路里。</p>
        </div>
        <div className="prototype-boundary">
          <strong>演示边界</strong>
          <span>读取受控样例；审核按钮只生成本页留痕，不调用生产接口。</span>
        </div>
      </header>

      <div className="governance-shell">
        <aside className="governance-rail">
          <nav aria-label="治理工作区">
            <a href="#queue">审核队列</a>
            <a href="#dossier">当前证据</a>
            <a href="#collections">专题编排</a>
          </nav>
          <p>审核原则</p>
          <ol>
            <li>先核对授权范围</li>
            <li>再核对来源与模型</li>
            <li>最后判断是否公开</li>
          </ol>
        </aside>

        <div className="governance-workspace">
          <section className="governance-summary" aria-label="当前审核概况">
            <article className="governance-metric governance-metric--primary">
              <span>等待判断</span>
              <strong>{counts.pending}</strong>
              <small>当前受控样例中的待审记录</small>
            </article>
            <article className="governance-metric">
              <span>需要复核</span>
              <strong>{counts.flagged}</strong>
              <small>包含文字、来源或撤回提示</small>
            </article>
            <article className="governance-metric governance-withdrawal-metric">
              <span>撤回请求</span>
              <strong>{counts.withdrawals}</strong>
              <small>优先于发布动作处理</small>
            </article>
          </section>

          <div id="queue">
            <ReviewQueue records={records} selectedId={selected?.item.id ?? ""} onSelect={selectRecord} />
          </div>
          {selectionMessage && <p className="visually-hidden" role="status">{selectionMessage}</p>}

          {selected && (
            <section id="dossier" className="governance-dossier" role="region" aria-label="当前档案证据">
              <header className="dossier-heading">
                <div>
                  <span>{selected.item.accessionNo}</span>
                  <h2>{selected.item.objectName}</h2>
                </div>
                <p>{selected.item.machine.caption}</p>
              </header>
              <div className="dossier-evidence-grid">
                <ArtifactViewer item={selected.item} compact />
                <SourceRecord run={selected.item.machine} item={selected.item} />
              </div>
              <ModerationDecision key={selected.item.id} record={selected} />
            </section>
          )}

          <div id="collections">
            <CuratorialCollection collections={collections} records={records} />
          </div>
        </div>
      </div>
    </section>
  );
}
