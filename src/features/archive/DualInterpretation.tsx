import type { ArchiveItem } from "../../domain/archive";

export function DualInterpretation({ item }: { item: ArchiveItem }) {
  return (
    <section className="dual-interpretation" aria-labelledby="interpretation-title">
      <header>
        <p className="section-label">DUAL RECORD / 双重记录</p>
        <h2 id="interpretation-title">同一件物品，没有唯一解释</h2>
      </header>
      <article className="interpretation interpretation--machine">
        <span>机器层 / {item.machine.runMode === "single_live" ? "单次推断" : "固定种子读取"}</span>
        <h3>{item.machine.labels.join(" / ")}</h3>
        <p>{item.machine.caption}</p>
        <details>
          <summary>查看机器没有确认的部分</summary>
          <ul>{item.machine.uncertainties.map((text) => <li key={text}>{text}</li>)}</ul>
        </details>
      </article>
      <article className="interpretation interpretation--memory">
        <span>记忆层 / {item.memory.relation}</span>
        <h3>{item.memory.emotionTags.join(" / ") || "未标注情绪"}</h3>
        <p>{item.memory.text}</p>
      </article>
    </section>
  );
}
