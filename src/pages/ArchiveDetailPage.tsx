import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { seedArchives } from "../data/seed-archives";
import { ArchiveDetail } from "../features/archive/ArchiveDetail";

export function ArchiveDetailPage() {
  const { id } = useParams();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [id]);
  const item = seedArchives.find(
    (record) =>
      record.id === id &&
      record.status === "published" &&
      record.artifactVisibility === "public",
  );

  if (!item) {
    return (
      <section className="page archive-not-found">
        <p className="section-label">404 / ARCHIVE BOUNDARY</p>
        <h1>档案不可用</h1>
        <p>它可能仍在审核、已经撤回，或者从未进入公共索引。</p>
        <Link className="primary-action" to="/archive">返回公共档案馆</Link>
      </section>
    );
  }

  return (
    <div className="page page--archive-detail">
      <Link className="archive-back" to="/archive">← 返回公共索引</Link>
      <ArchiveDetail item={item} />
    </div>
  );
}
