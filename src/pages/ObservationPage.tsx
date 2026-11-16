import { useRef, useState } from "react";
import { Link } from "react-router-dom";

import { seedArchives } from "../data/seed-archives";
import { PersonalResiduePoster } from "../features/observation/PersonalResiduePoster";
import {
  clearObservationTrace,
  loadObservationTrace,
  summarizeObservation,
} from "../lib/observation-trace";

const focusLabels = {
  shape: "形态结构",
  material: "材料痕迹",
  text: "可见文字",
  usage: "使用方式",
  memory: "人的记忆",
} as const;

export function ObservationPage() {
  const [trace, setTrace] = useState(() => loadObservationTrace());
  const [confirmingReset, setConfirmingReset] = useState(false);
  const posterRef = useRef<SVGSVGElement>(null);
  const summary = summarizeObservation(trace);
  const visited = trace.visitedArchiveIds
    .map((id) => seedArchives.find((item) => item.id === id))
    .filter((item) => item !== undefined);

  function downloadPoster() {
    if (!posterRef.current) return;
    const source = `<?xml version="1.0" encoding="UTF-8"?>${new XMLSerializer().serializeToString(posterRef.current)}`;
    const url = URL.createObjectURL(new Blob([source], { type: "image/svg+xml;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "my-observation-residue.svg";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function resetTrace() {
    clearObservationTrace();
    setTrace(loadObservationTrace());
    setConfirmingReset(false);
  }

  return (
    <div className="page observation-page">
      <header className="observation-hero">
        <p className="section-label">PRIVATE TRACE / 仅保存在当前浏览器</p>
        <h1>我的观察档案</h1>
        <p>这里记录你如何阅读机器残差，不为判断打分，也不会改变公共档案中的物品解释。</p>
      </header>

      {summary.completed === 0 ? (
        <section className="observation-empty" aria-labelledby="observation-empty-title">
          <p className="observation-index" aria-hidden="true">00</p>
          <div>
            <h2 id="observation-empty-title">还没有观察记录</h2>
            <p>完成一次误读挑战后，你关注过的证据与保留的不同判断会在这里形成个人残差。</p>
            <Link className="primary-action" to="/challenge/seed-bus-ticket-collection-01">开始第一次观察</Link>
          </div>
        </section>
      ) : (
        <>
          <section className="observation-dashboard" aria-labelledby="observation-summary-title">
            <div className="observation-summary">
              <p className="section-label">TRACE SUMMARY</p>
              <h2 id="observation-summary-title">你看见了什么</h2>
              <dl>
                <div><dt>完成</dt><dd>完成 {summary.completed} 次观察</dd></div>
                <div><dt>交叠</dt><dd>与策展答案一致 {summary.matched} 次</dd></div>
                <div><dt>分歧</dt><dd>保留不同判断 {summary.different} 次</dd></div>
                <div><dt>注意力</dt><dd>{summary.dominantFocus ? focusLabels[summary.dominantFocus] : "尚未形成"}</dd></div>
              </dl>
              <p className="observation-boundary">一致不等于正确，不同也不是错误；它们只描述你与策展答案之间的距离。</p>
              <div className="observation-actions">
                <button className="primary-action" type="button" onClick={downloadPoster}>下载个人残差</button>
                {!confirmingReset ? (
                  <button className="observation-reset" type="button" onClick={() => setConfirmingReset(true)}>清空观察记录</button>
                ) : (
                  <button className="observation-reset observation-reset--confirm" type="button" onClick={resetTrace}>确认清空</button>
                )}
              </div>
            </div>
            <div className="observation-poster-wrap">
              <PersonalResiduePoster ref={posterRef} trace={trace} />
            </div>
          </section>

          <section className="observation-objects" aria-labelledby="observation-objects-title">
            <header>
              <p className="section-label">VISITED OBJECTS</p>
              <h2 id="observation-objects-title">经过的物品</h2>
            </header>
            <ol>
              {visited.map((item, index) => (
                <li key={item.id}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <Link to={`/archive/${item.id}`}>{item.objectName}</Link>
                  <small>{item.disappearanceMode}</small>
                </li>
              ))}
            </ol>
            <Link className="text-action" to="/challenge/seed-bus-ticket-collection-01">继续观察一件物品 →</Link>
          </section>
        </>
      )}
    </div>
  );
}
