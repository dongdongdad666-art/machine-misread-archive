import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { seedArchives } from "../data/seed-archives";
import type { ArchiveItem } from "../domain/archive";
import {
  ArchiveFilters,
  type ArchiveFilterValue,
} from "../features/archive/ArchiveFilters";
import { ArchiveGrid } from "../features/archive/ArchiveGrid";

const emptyFilters: ArchiveFilterValue = {
  timeRange: "",
  emotion: "",
  disappearanceMode: "",
};

export function ArchivePage({ records = seedArchives }: { records?: ArchiveItem[] }) {
  const [filters, setFilters] = useState(emptyFilters);
  const published = useMemo(
    () => records.filter(
      (item) => item.status === "published" && item.artifactVisibility === "public",
    ),
    [records],
  );
  const filtered = published.filter((item) =>
    (!filters.timeRange || item.timeRange === filters.timeRange) &&
    (!filters.emotion || item.memory.emotionTags.includes(filters.emotion)) &&
    (!filters.disappearanceMode || item.disappearanceMode === filters.disappearanceMode),
  );

  return (
    <div className="page page--archive">
      <header className="archive-hero">
        <div>
          <p className="section-label">PUBLIC INDEX / 已审核生成作品</p>
          <h1>公共档案馆</h1>
        </div>
        <div className="archive-hero-actions">
          <p>在机器的判断和人的记忆之间漫游。公开的是生成作品；源照片仍遵循每件档案自己的授权边界。</p>
          <Link className="primary-action" to="/challenge/seed-bus-ticket-collection-01">开始一次误读挑战</Link>
        </div>
      </header>
      <ArchiveFilters records={published} value={filters} onChange={setFilters} />
      <div className="archive-count" aria-live="polite">
        显示 {filtered.length} / {published.length} 件公开档案
      </div>
      <ArchiveGrid records={filtered} />
    </div>
  );
}
