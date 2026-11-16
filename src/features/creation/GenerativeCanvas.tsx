import { useEffect, useRef, useState } from "react";
import type { CreationState } from "../../domain/creation-machine";
import { renderArtifact } from "../../generation/render-artifact";

interface GenerativeCanvasProps {
  state: CreationState;
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function supportedWebmType(): string | null {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) return null;
  return ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find(
    (type) => MediaRecorder.isTypeSupported(type),
  ) ?? null;
}

export function GenerativeCanvas({ state }: GenerativeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [recording, setRecording] = useState(false);
  const [webmType] = useState(supportedWebmType);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context || !state.parameters || !state.reading || !state.memory) return;
    const reading = state.reading;
    const memory = state.memory;
    const parameters = state.parameters;

    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let frame = 0;
    let request = 0;
    const draw = () => {
      renderArtifact(context, {
        seed: state.generationSeed ?? 1,
        frame,
        reducedMotion,
        machineText: reading.caption,
        memoryText: memory.text,
        accessionNo: state.analysisId ?? "LOCAL-DRAFT",
        provenance: "单次机器推断 · 本地生成",
        parameters,
      });
      frame += 1;
      if (!reducedMotion) request = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(request);
  }, [state]);

  const downloadPng = () => {
    canvasRef.current?.toBlob((blob) => blob && saveBlob(blob, "semantic-residue.png"), "image/png");
  };

  const downloadWebm = () => {
    const canvas = canvasRef.current;
    if (!canvas || !webmType || typeof canvas.captureStream !== "function") return;
    const stream = canvas.captureStream(30);
    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(stream, { mimeType: webmType });
    recorder.ondataavailable = (event) => event.data.size && chunks.push(event.data);
    recorder.onstop = () => {
      saveBlob(new Blob(chunks, { type: webmType }), "semantic-residue.webm");
      stream.getTracks().forEach((track) => track.stop());
      setRecording(false);
    };
    setRecording(true);
    recorder.start();
    window.setTimeout(() => recorder.stop(), 8000);
  };

  const canRecord = Boolean(webmType && HTMLCanvasElement.prototype.captureStream);

  return (
    <section className="creation-stage artifact-stage" aria-labelledby="artifact-title">
      <div className="stage-index">05 / 生成档案</div>
      <div className="stage-copy">
        <h2 id="artifact-title">语义残差已经显影</h2>
        <p>朱红属于物件与人的记忆，紫色属于机器偏移，黄色标记仍可核验的证据。</p>
        {state.semanticGap !== undefined && (
          <p className="artifact-measure">
            {state.gapMode === "temporary" ? "临时距离" : "语义距离"} {Math.round(state.semanticGap * 100)}%
            {state.gapAlgorithmVersion ? ` · ${state.gapAlgorithmVersion}` : ""}
          </p>
        )}
      </div>
      <div className="canvas-frame">
        <canvas
          ref={canvasRef}
          width="960"
          height="640"
          aria-label="根据机器解读和人类记忆生成的语义残差作品"
        />
      </div>
      <div className="artifact-actions">
        <button type="button" className="creation-primary" onClick={downloadPng}>下载 PNG</button>
        {canRecord && (
          <button type="button" className="text-action" onClick={downloadWebm} disabled={recording}>
            {recording ? "正在录制 8 秒…" : "导出 8 秒 WebM"}
          </button>
        )}
        {!canRecord && <small>当前浏览器不支持画布录像，可正常下载 PNG。</small>}
      </div>
    </section>
  );
}
