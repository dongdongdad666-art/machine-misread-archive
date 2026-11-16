import type { ArchiveItem } from "../../domain/archive";

export function SourcePreview({ item }: { item: ArchiveItem }) {
  if (item.sourceVisibility === "public" && !item.sourceUrl.startsWith("private-source:")) {
    return (
      <img
        className="source-preview-image"
        src={item.sourceUrl}
        alt={`${item.objectName}原始照片`}
        loading="lazy"
        decoding="async"
      />
    );
  }

  return (
    <div className="private-source" role="note">
      <strong>原始照片未公开</strong>
      <span>隐私占位，不使用生成图替代真实来源。</span>
    </div>
  );
}
