import { Link, useParams } from "react-router-dom";

import { seedArchives } from "../data/seed-archives";
import { seedChallenges } from "../data/seed-challenges";
import { findChallenge } from "../domain/challenge";
import { ChallengeExperience } from "../features/challenge/ChallengeExperience";

export function ChallengePage() {
  const { id = "" } = useParams();
  const item = seedArchives.find((record) => record.id === id);
  const challenge = findChallenge(seedChallenges, id);

  if (!item || !challenge) {
    return (
      <section className="page archive-not-found">
        <p className="section-label">404 / CHALLENGE BOUNDARY</p>
        <h1>未找到这项挑战</h1>
        <p>这件物品可能尚未完成策展问题，或者已经离开公共索引。</p>
        <Link className="primary-action" to="/archive">返回公共档案馆</Link>
      </section>
    );
  }

  return (
    <div className="page page--challenge">
      <ChallengeExperience key={challenge.id} challenge={challenge} item={item} />
    </div>
  );
}
