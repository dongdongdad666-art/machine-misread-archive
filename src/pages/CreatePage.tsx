import { useEffect, useMemo, useState } from "react";
import type { HumanMemory, MachineReading, VisualParameters } from "../domain/archive";
import {
  initialCreationState,
  transition,
  type CreationState,
} from "../domain/creation-machine";
import { ArchiveSubmission } from "../features/creation/ArchiveSubmission";
import { GenerativeCanvas } from "../features/creation/GenerativeCanvas";
import { MachineReading as MachineReadingPanel } from "../features/creation/MachineReading";
import { MemoryAnnotation } from "../features/creation/MemoryAnnotation";
import { ObjectIntake } from "../features/creation/ObjectIntake";
import { SemanticGapControl } from "../features/creation/SemanticGapControl";
import { renderArtifact } from "../generation/render-artifact";
import { clientApi } from "../lib/api";
import {
  processImage,
  rotateProcessedImage,
  type ProcessedImage,
} from "../lib/image-processing";
import { saveDraft } from "../lib/local-draft";
import { seedArchives } from "../data/seed-archives";

interface GapInput {
  analysisId: string;
  memory: HumanMemory;
}

interface GapResult {
  gap: number;
  generationSeed: number;
  parameters: VisualParameters;
  mode: "measured" | "temporary";
  algorithmVersion: string;
  publishable: boolean;
}

export interface CreationAdapters {
  processImage(file: File): Promise<ProcessedImage>;
  rotateImage?(image: ProcessedImage, degrees: number): Promise<ProcessedImage>;
  analyze(image: ProcessedImage, consent: true): Promise<{
    analysisId: string;
    reading: MachineReading;
  }>;
  calculateGap(input: GapInput): Promise<GapResult>;
  submit(input: {
    state: CreationState;
    processedImage: ProcessedImage | null;
    submissionToken: string;
    publishArtifact: boolean;
    publishSource: boolean;
    publicationConsent: true;
  }): Promise<{ submissionId: string; accessionNo: string }>;
}

function renderSubmissionArtifact(state: CreationState): Promise<Blob> {
  if (!state.parameters || !state.reading || !state.memory || !state.generationSeed) {
    return Promise.reject(new Error("生成作品尚未准备完成。"));
  }
  const canvas = document.createElement("canvas");
  canvas.width = 960;
  canvas.height = 640;
  const context = canvas.getContext("2d");
  if (!context) return Promise.reject(new Error("当前浏览器无法导出生成作品。"));
  renderArtifact(context, {
    seed: state.generationSeed,
    frame: 0,
    reducedMotion: true,
    machineText: state.reading.caption,
    memoryText: state.memory.text,
    accessionNo: state.analysisId ?? "LOCAL-DRAFT",
    provenance: "单次机器推断 · 本地生成",
    parameters: state.parameters,
  });
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("当前浏览器无法导出生成作品。")),
      "image/png",
    );
  });
}

const defaultAdapters: CreationAdapters = {
  processImage,
  rotateImage: rotateProcessedImage,
  analyze: clientApi.analyze,
  async calculateGap({ analysisId, memory }) {
    const result = await clientApi.calculateGap({
      analysisId,
      memoryText: memory.text,
      timeRange: "年代不确定",
      relation: memory.relation,
      emotionTags: memory.emotionTags,
    });
    return {
      gap: result.semanticGap,
      generationSeed: result.generationSeed,
      parameters: result.visualParameters,
      mode: result.mode,
      algorithmVersion: result.algorithmVersion,
      publishable: result.publishable,
    };
  },
  async submit({
    state,
    processedImage,
    submissionToken,
    publishArtifact,
    publishSource,
    publicationConsent,
  }) {
    if (!state.analysisId || !state.memory) throw new Error("档案内容尚未准备完成。");
    const artifact = await renderSubmissionArtifact(state);
    return clientApi.submitArchive({
      submissionToken,
      analysisId: state.analysisId,
      memoryText: state.memory.text,
      timeRange: "年代不确定",
      city: "",
      relation: state.memory.relation,
      emotionTags: state.memory.emotionTags,
      artifact,
      source: publishSource ? processedImage?.blob : undefined,
      publicationConsent,
      consentVersion: "publication-v1",
      publishArtifact,
      publishSource,
    });
  },
};

const stages = ["接收", "解读", "记忆", "语义差", "生成", "公开边界"];
const demoSeed = seedArchives.find((item) => item.id === "seed-old-dictionary-01")!;
const demoAnalysisId = "seed-demo-old-dictionary";

export function CreatePage({ adapters = defaultAdapters }: { adapters?: CreationAdapters }) {
  const [submissionToken] = useState(() => crypto.randomUUID());
  const [state, setState] = useState(initialCreationState);
  const [processed, setProcessed] = useState<ProcessedImage | null>(null);
  const [fileName, setFileName] = useState("");
  const [analysisConsent, setAnalysisConsent] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string>();

  useEffect(() => saveDraft(state), [state]);
  useEffect(
    () => () => {
      if (
        processed?.previewUrl.startsWith("blob:") &&
        typeof URL.revokeObjectURL === "function"
      ) {
        URL.revokeObjectURL(processed.previewUrl);
      }
    },
    [processed],
  );

  const currentStep = useMemo(() => {
    const indices: Record<CreationState["stage"], number> = {
      local_draft: 0,
      analyzing: 1,
      interpreted: 2,
      memory_complete: 3,
      generated: 4,
      pending_review: 5,
    };
    return indices[state.stage];
  }, [state.stage]);

  const handleFile = async (file: File) => {
    setProcessing(true);
    setLocalError(undefined);
    try {
      const result = await adapters.processImage(file);
      setProcessed(result);
      setFileName(file.name);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "无法处理这张图片");
    } finally {
      setProcessing(false);
    }
  };

  const handleRotate = async (degrees: number) => {
    if (!processed) return;
    setProcessing(true);
    setLocalError(undefined);
    try {
      const result = await (adapters.rotateImage ?? rotateProcessedImage)(processed, degrees);
      setProcessed(result);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "无法旋转这张图片");
    } finally {
      setProcessing(false);
    }
  };

  const handleAnalyze = async () => {
    if (!processed || !analysisConsent || state.stage !== "local_draft") return;
    const analyzingState = transition(state, {
      type: "IMAGE_ACCEPTED",
      image: {
        name: fileName,
        type: processed.mimeType,
        size: processed.blob.size,
        width: processed.width,
        height: processed.height,
        previewUrl: processed.previewUrl,
      },
    });
    setState(analyzingState);
    try {
      const result = await adapters.analyze(processed, true);
      setState((current) => transition(current, { type: "ANALYSIS_SUCCEEDED", ...result }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "机器解读暂时不可用";
      setState((current) => transition(current, { type: "ANALYSIS_FAILED", message }));
    }
  };

  const handleUseSeed = () => {
    if (state.stage !== "local_draft") return;
    const analyzingState = transition(state, {
      type: "IMAGE_ACCEPTED",
      image: {
        name: demoSeed.objectName,
        type: "image/webp",
        size: 0,
        width: 0,
        height: 0,
        previewUrl: demoSeed.sourceUrl,
      },
    });
    setState(transition(analyzingState, {
      type: "ANALYSIS_SUCCEEDED",
      analysisId: demoAnalysisId,
      reading: demoSeed.machine,
    }));
    setProcessed(null);
    setFileName(demoSeed.objectName);
    setLocalError(undefined);
  };

  const handleMemory = (memory: HumanMemory) => {
    setState((current) => transition(current, { type: "MEMORY_COMPLETED", memory }));
  };

  const handleGenerate = async () => {
    if (!state.analysisId || !state.memory) return;
    if (state.analysisId === demoAnalysisId) {
      setState((current) => transition(current, {
        type: "GAP_SUCCEEDED",
        gap: demoSeed.semanticGap,
        generationSeed: demoSeed.generationSeed,
        parameters: demoSeed.visualParameters,
        mode: "temporary",
        algorithmVersion: `${demoSeed.engineVersion}-seed-demo`,
        publishable: false,
      }));
      return;
    }
    setGenerating(true);
    try {
      const result = await adapters.calculateGap({
        analysisId: state.analysisId,
        memory: state.memory,
      });
      setState((current) => transition(current, { type: "GAP_SUCCEEDED", ...result }));
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "生成参数计算失败");
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmit = async (options: {
    publishArtifact: boolean;
    publishSource: boolean;
    publicationConsent: true;
  }) => {
    if (state.gapMode !== "measured" || state.publishable !== true) {
      setLocalError("只有完成实时语义距离计算的作品才能申请入档。");
      return;
    }
    setSubmitting(true);
    try {
      const result = await adapters.submit({
        state,
        processedImage: processed,
        submissionToken,
        ...options,
      });
      setState((current) =>
        transition(current, { type: "SUBMISSION_REQUESTED", ...result }),
      );
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "投稿暂时无法提交");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page page--create">
      <header className="create-hero">
        <p className="section-label">CREATE / 一次 60–90 秒的引导取证</p>
        <h1>交出一件物件</h1>
        <p>先记录机器的命名，再让你的记忆改变画面。两种解释并存，不互相覆盖。</p>
      </header>

      <ol className="creation-progress" aria-label="创建进度">
        {stages.map((label, index) => (
          <li key={label} data-state={index < currentStep ? "done" : index === currentStep ? "active" : "later"}>
            <span>{String(index + 1).padStart(2, "0")}</span>{label}
          </li>
        ))}
      </ol>

      {(state.stage === "local_draft" || state.stage === "analyzing") && (
        <ObjectIntake
          preview={processed ? {
            name: fileName,
            url: processed.previewUrl,
            width: processed.width,
            height: processed.height,
          } : null}
          rotation={0}
          analysisConsent={analysisConsent}
          processing={processing}
          analyzing={state.stage === "analyzing"}
          error={localError ?? state.error}
          onFile={handleFile}
          onRotate={handleRotate}
          onConsent={setAnalysisConsent}
          onAnalyze={handleAnalyze}
          onUseSeed={handleUseSeed}
        />
      )}

      {state.reading && currentStep >= 2 && <MachineReadingPanel reading={state.reading} />}
      {state.stage === "interpreted" && <MemoryAnnotation onComplete={handleMemory} />}
      {state.stage === "memory_complete" && (
        <SemanticGapControl generating={generating} onGenerate={handleGenerate} />
      )}
      {(state.stage === "generated" || state.stage === "pending_review") && (
        <>
          <GenerativeCanvas state={state} />
          <ArchiveSubmission
            submitting={submitting}
            submitted={state.stage === "pending_review"}
            publishable={state.gapMode === "measured" && state.publishable === true}
            accessionNo={state.accessionNo}
            onSubmit={handleSubmit}
          />
        </>
      )}
      {localError && state.stage !== "local_draft" && (
        <p className="creation-error" role="alert">{localError}</p>
      )}
    </div>
  );
}
