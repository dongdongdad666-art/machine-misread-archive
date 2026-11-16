import { Link } from "react-router-dom";
import { seedArchives } from "../data/seed-archives";
import { ArtifactViewer } from "../features/archive/ArtifactViewer";

export function HomePage() {
  const representative = seedArchives[2];

  return (
    <div className="page page--home">
      <section className="home-hero">
        <div className="hero-copy">
          <p className="section-label">当期专题：失去说明书的日常物件</p>
          <h1>当机器只看见物，谁来保存它曾经的生活？</h1>
          <p className="hero-summary">一座收集真实旧物、机器判断与未被算法理解之处的在线档案馆。</p>
          <div className="home-actions">
            <Link className="primary-action" to="/create">交出一件物件</Link>
            <Link className="text-action" to="/archive">进入公共档案</Link>
          </div>
        </div>
        <div className="home-artifact" aria-label="当期代表档案">
          <ArtifactViewer item={representative} />
          <Link to={`/archive/${representative.id}`}>查看代表档案：{representative.objectName}</Link>
        </div>
      </section>
      <div className="dual-track" aria-label="机器判断与人的记忆示例">
        <p><span>机器</span> 修补过的旧书</p>
        <p><span>人的记录</span> 尚未补述，不代写记忆</p>
      </div>
    </div>
  );
}
