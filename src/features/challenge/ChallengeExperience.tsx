import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import type { ArchiveItem } from "../../domain/archive";
import {
  evaluateChallenge,
  nextChallengeArchiveId,
  type ChallengeDefinition,
  type ChallengeResult,
} from "../../domain/challenge";
import { seedChallenges } from "../../data/seed-challenges";
import { ArtifactViewer } from "../archive/ArtifactViewer";
import { recordObservation } from "../../lib/observation-trace";

interface ChallengeExperienceProps {
  challenge: ChallengeDefinition;
  item: ArchiveItem;
}

export function ChallengeExperience({ challenge, item }: ChallengeExperienceProps) {
  const [selection, setSelection] = useState("");
  const [result, setResult] = useState<ChallengeResult | null>(null);

  function reveal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selection) return;
    const next = evaluateChallenge(challenge, selection);
    recordObservation({ ...next, completedAt: new Date().toISOString() });
    setResult(next);
  }

  if (result) {
    const selected = challenge.options.find((option) => option.id === result.selectedOptionId);
    return (
      <section className="challenge-reveal" aria-live="polite">
        <header className="challenge-reveal-heading">
          <p className="section-label">REVEAL / 三重档案对照</p>
          <h1>{item.objectName}</h1>
          <p>{challenge.curatorialRationale}</p>
        </header>

        <div className="challenge-reveal-grid">
          <article className="reveal-panel reveal-panel--visitor">
            <span>01 / VISITOR</span>
            <h2>你的判断</h2>
            <strong>{selected?.label}</strong>
            <p>{result.matchedCuratorialAnswer ? "与当前策展答案一致。" : "保留为一条不同判断，不自动判定为错误。"}</p>
            <small>{challenge.userOmission}</small>
          </article>
          <article className="reveal-panel reveal-panel--machine">
            <span>02 / MACHINE</span>
            <h2>机器判断</h2>
            <strong>{item.machine.labels.join(" / ")}</strong>
            <p>{item.machine.caption}</p>
            <small>{challenge.machineOmission}</small>
          </article>
          <article className="reveal-panel reveal-panel--archive">
            <span>03 / EVIDENCE</span>
            <h2>可核验的人类档案</h2>
            <strong>{item.memory.relation}</strong>
            <p>{item.memory.text}</p>
            <small>{item.provenance.note}</small>
          </article>
        </div>

        <div className="challenge-actions">
          <Link className="primary-action" to={`/archive/${item.id}`}>查看完整档案</Link>
          <Link className="text-action" to={`/challenge/${nextChallengeArchiveId(item.id, seedChallenges)}`}>
            继续下一件
          </Link>
          <Link className="text-action" to="/observation">查看我的观察</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="challenge-answering">
      <header className="challenge-heading">
        <p className="section-label">MISREAD CHALLENGE / 01 OF 01</p>
        <h1>你能从残差里认出它吗？</h1>
        <p>先留下判断，再打开机器、证据与记忆之间的差异。</p>
      </header>

      <div className="challenge-layout">
        <div className="challenge-artifact">
          <ArtifactViewer item={item} accessibleLabel="尚未揭示名称的机器残差" />
          <p><span>有限线索</span>{challenge.clue}</p>
        </div>
        <form className="challenge-form" onSubmit={reveal}>
          <fieldset>
            <legend>{challenge.prompt}</legend>
            {challenge.options.map((option, index) => (
              <label key={option.id} className={selection === option.id ? "is-selected" : ""}>
                <input
                  type="radio"
                  name="challenge-answer"
                  value={option.id}
                  checked={selection === option.id}
                  onChange={() => setSelection(option.id)}
                />
                <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                <strong>{option.label}</strong>
              </label>
            ))}
          </fieldset>
          <button className="primary-action" type="submit" disabled={!selection}>提交判断</button>
          <small>这不是能力测试。你的选择只进入个人观察记录。</small>
        </form>
      </div>
    </section>
  );
}
