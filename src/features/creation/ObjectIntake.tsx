import type { ChangeEvent, DragEvent } from "react";

export interface IntakePreview {
  name: string;
  url: string;
  width: number;
  height: number;
}

interface ObjectIntakeProps {
  preview: IntakePreview | null;
  rotation: number;
  analysisConsent: boolean;
  processing: boolean;
  analyzing: boolean;
  error?: string;
  onFile(file: File): void;
  onRotate(delta: number): void;
  onConsent(consent: boolean): void;
  onAnalyze(): void;
  onUseSeed(): void;
}

export function ObjectIntake({
  preview,
  rotation,
  analysisConsent,
  processing,
  analyzing,
  error,
  onFile,
  onRotate,
  onConsent,
  onAnalyze,
  onUseSeed,
}: ObjectIntakeProps) {
  const acceptFile = (file?: File) => file && onFile(file);
  const handleInput = (event: ChangeEvent<HTMLInputElement>) =>
    acceptFile(event.target.files?.[0]);
  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    acceptFile(event.dataTransfer.files?.[0]);
  };

  return (
    <section className="creation-stage creation-stage--intake" aria-labelledby="intake-title">
      <div className="stage-index" aria-hidden="true">01 / 证物接收</div>
      <div className="stage-copy">
        <h2 id="intake-title">先让物件保持沉默</h2>
        <p>上传之前不替它命名。浏览器会压缩照片并移除 EXIF，原图默认不公开。</p>
      </div>

      <label
        className={`intake-field${preview ? " intake-field--occupied" : ""}`}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        <input
          className="visually-hidden"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-label="选择物件照片"
          onChange={handleInput}
        />
        {preview ? (
          <>
            <span className="intake-image-wrap">
              <img
                src={preview.url}
                alt="待分析物件预览"
                style={{ transform: `rotate(${rotation}deg)` }}
              />
            </span>
            <span className="intake-file-meta">
              <strong>{preview.name}</strong>
              <span>{preview.width} × {preview.height} · 已去除拍摄元数据</span>
            </span>
          </>
        ) : (
          <span className="intake-empty">
            <strong>{processing ? "正在整理证物…" : "拖入照片，或按 Enter 选择"}</strong>
            <span>JPEG / PNG / WebP · 最大边 1600px · 输出不超过 2MB</span>
          </span>
        )}
      </label>

      {!preview && (
        <div className="seed-entry">
          <div>
            <strong>没有照片也可以先体验</strong>
            <span>载入馆内旧字典样本，全程使用本地种子数据，不调用在线模型。</span>
          </div>
          <button type="button" className="text-action" onClick={onUseSeed}>
            使用示例：旧字典
          </button>
        </div>
      )}

      {preview && (
        <div className="intake-controls" aria-label="照片方向调整">
          <button type="button" className="text-action" onClick={() => onRotate(-90)}>
            逆时针旋转照片
          </button>
          <button type="button" className="text-action" onClick={() => onRotate(90)}>
            顺时针旋转照片
          </button>
        </div>
      )}

      <div className="consent-panel">
        <div className="consent-copy">
          <label className="check-line">
            <input
              type="checkbox"
              aria-label="同意用于本次 AI 分析"
              checked={analysisConsent}
              onChange={(event) => onConsent(event.target.checked)}
            />
            <span>
              <strong>同意物件照片与稍后填写的记忆文本用于本次 AI 分析</strong>
              <small>照片用于视觉解读，记忆文本用于第三方向量距离计算；这不等于同意公开任何内容。</small>
            </span>
          </label>
          <a
            className="consent-link"
            href="https://help.aliyun.com/zh/model-studio/privacy-notice"
            target="_blank"
            rel="noreferrer"
          >
            查看模型服务的数据与隐私说明
          </a>
        </div>
        <button
          type="button"
          className="creation-primary"
          disabled={!preview || !analysisConsent || processing || analyzing}
          onClick={onAnalyze}
        >
          {analyzing ? "机器正在观察…" : "开始机器解读"}
        </button>
      </div>
      {error && <p className="creation-error" role="alert">{error}</p>}
    </section>
  );
}
