import type { GovernanceCollection, GovernanceRecord } from "../../data/governance-fixtures";

interface CuratorialCollectionProps {
  collections: GovernanceCollection[];
  records: GovernanceRecord[];
}

export function CuratorialCollection({ collections, records }: CuratorialCollectionProps) {
  const byId = new Map(records.map((record) => [record.item.id, record.item]));

  return (
    <section className="governance-section curatorial-board" aria-labelledby="curatorial-title">
      <header className="governance-section-heading">
        <div>
          <p>专题编排</p>
          <h2 id="curatorial-title">审核通过不等于自动进入展陈</h2>
        </div>
        <span>候选编排，不自动发布</span>
      </header>
      <div className="collection-layout">
        {collections.map((collection, index) => (
          <article key={collection.id} className={index === 0 ? "collection-feature" : "collection-secondary"}>
            <span>专题候选 {String(index + 1).padStart(2, "0")}</span>
            <h3>{collection.title}</h3>
            <p>{collection.thesis}</p>
            <ul>
              {collection.itemIds.map((id) => {
                const item = byId.get(id);
                return <li key={id}>{item ? `${item.accessionNo} · ${item.objectName}` : `待补档案 · ${id}`}</li>;
              })}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
