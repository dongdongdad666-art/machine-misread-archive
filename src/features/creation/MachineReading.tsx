import { useState, type CSSProperties } from "react";
import type { MachineReading as MachineReadingModel } from "../../domain/archive";

interface MachineReadingProps {
  reading: MachineReadingModel;
}

export function MachineReading({ reading }: MachineReadingProps) {
  const [scanner, setScanner] = useState(46);

  return (
    <section className="creation-stage machine-reading" aria-labelledby="machine-title">
      <div className="stage-index">
        02 / {reading.runMode === "single_live" ? "单次推断" : "固定种子读取"}
      </div>
      <div className="stage-copy">
        <h2 id="machine-title">机器如何称呼它</h2>
        <p>这是一次情境化机器读取，不是历史鉴定，也不展示伪造的置信度。</p>
      </div>
      <div className="machine-grid">
        <div className="scanner-field" style={{ "--scanner-y": `${scanner}%` } as CSSProperties}>
          <span className="scanner-line" aria-hidden="true" />
          <p>{reading.caption}</p>
        </div>
        <dl className="reading-ledger">
          <div><dt>候选名称</dt><dd>{reading.labels.join(" / ")}</dd></div>
          <div><dt>材质判断</dt><dd>{reading.materials.join(" / ") || "未检出"}</dd></div>
          <div><dt>可见文字</dt><dd>{reading.visibleText.join(" / ") || "未检出"}</dd></div>
          <div><dt>不确定项</dt><dd>{reading.uncertainties.join("；")}</dd></div>
        </dl>
      </div>
      <label className="axis-control">
        <span>移动扫描线</span>
        <input
          type="range"
          min="0"
          max="100"
          value={scanner}
          onChange={(event) => setScanner(Number(event.target.value))}
        />
        <output>{scanner}%</output>
      </label>
    </section>
  );
}
