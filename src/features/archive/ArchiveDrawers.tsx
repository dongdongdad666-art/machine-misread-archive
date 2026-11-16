import { seedChallenges } from "../../data/seed-challenges";
import type { ArchiveItem } from "../../domain/archive";
import { findChallenge } from "../../domain/challenge";

export function ArchiveDrawers({ item }: { item: ArchiveItem }) {
  const challenge = findChallenge(seedChallenges, item.id);
  const region = item.city && item.city !== "未提供" ? item.city : "地区资料待补述";
  const renderFacts = (facts: string[], fallback: string) => (
    facts.length > 0
      ? <ul className="archive-fact-list">{facts.map((fact) => <li key={fact}>{fact}</li>)}</ul>
      : fallback
  );

  return (
    <section className="archive-drawers" aria-labelledby="archive-drawers-title">
      <header className="archive-drawers-heading">
        <div>
          <p className="section-label">LIVING RECORD / 可继续补述</p>
          <h2 id="archive-drawers-title">六层档案记录</h2>
        </div>
        {challenge && <a className="primary-action" href={`/challenge/${item.id}`}>挑战你的判断</a>}
      </header>

      <div className="archive-drawer-list">
        <details open>
          <summary><span>01</span><strong>证据</strong><small>照片中可以确认什么</small></summary>
          <div className="archive-drawer-content">
            <dl>
              <div><dt>材料</dt><dd>{renderFacts(item.machine.materials, "材料待确认")}</dd></div>
              <div><dt>可见文字</dt><dd>{renderFacts(item.machine.visibleText, "未发现可确认文字")}</dd></div>
              <div><dt>来源边界</dt><dd>{item.provenance.note}</dd></div>
            </dl>
          </div>
        </details>
        <details>
          <summary><span>02</span><strong>使用</strong><small>动作和场景如何被保存</small></summary>
          <div className="archive-drawer-content">
            <p>{challenge?.curatorialRationale ?? item.machine.caption}</p>
            <p className="evidence-boundary-note">使用方式仍需持有者或来源补证；这里不根据物品类别编写私人经历。</p>
          </div>
        </details>
        <details>
          <summary><span>03</span><strong>时间</strong><small>只陈列已经出现的年代线索</small></summary>
          <div className="archive-drawer-content"><p>{item.timeRange}</p></div>
        </details>
        <details>
          <summary><span>04</span><strong>地区</strong><small>名称和使用方式可能因地而异</small></summary>
          <div className="archive-drawer-content">
            <p>{region}</p>
            <p className="evidence-boundary-note">第一里程碑暂不接收公开补述；地区资料将在登录与审核系统上线后进入档案。</p>
          </div>
        </details>
        <details>
          <summary><span>05</span><strong>误读</strong><small>机器没有确认的部分</small></summary>
          <div className="archive-drawer-content">
            <p>机器标签：{item.machine.labels.join(" / ")}</p>
            <ul>{item.machine.uncertainties.map((text) => <li key={text}>{text}</li>)}</ul>
            <p>当前语义差：{Math.round(item.semanticGap * 100)}%</p>
          </div>
        </details>
        <details>
          <summary><span>06</span><strong>补述</strong><small>人的记忆与事实分层保存</small></summary>
          <div className="archive-drawer-content">
            <p>人的补述保留在上方双层解释中；此层记录它与物品的来源关系。</p>
            <p><strong>{item.memory.relation}</strong></p>
            <p className="evidence-boundary-note">此内容保持原有来源身份，不被机器描述覆盖。</p>
          </div>
        </details>
      </div>
    </section>
  );
}
