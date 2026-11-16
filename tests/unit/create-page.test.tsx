import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { seedArchives } from "../../src/data/seed-archives";
import {
  CreatePage,
  type CreationAdapters,
} from "../../src/pages/CreatePage";

function fixtureAdapters(overrides: Partial<CreationAdapters> = {}): CreationAdapters {
  const seed = seedArchives[0];
  return {
    processImage: vi.fn(async (file) => ({
      blob: file,
      width: 800,
      height: 600,
      mimeType: "image/webp" as const,
      previewUrl: "blob:fixture",
    })),
    analyze: vi.fn(async () => ({ analysisId: "analysis-01", reading: seed.machine })),
    calculateGap: vi.fn(async () => ({
      gap: seed.semanticGap,
      generationSeed: seed.generationSeed,
      parameters: seed.visualParameters,
      mode: "measured" as const,
      algorithmVersion: "gap-v1",
      publishable: true,
    })),
    submit: vi.fn(async () => ({
      submissionId: "submission-01",
      accessionNo: "MMA-20260910-12345678",
    })),
    ...overrides,
  };
}

describe("guided creation page", () => {
  it("loads the old dictionary seed without calling a live model", async () => {
    const user = userEvent.setup();
    const adapters = fixtureAdapters();
    render(<CreatePage adapters={adapters} />);

    await user.click(screen.getByRole("button", { name: "使用示例：旧字典" }));

    expect(screen.getByRole("heading", { name: "机器如何称呼它" })).toBeVisible();
    expect(screen.getByText(/纸质工具书/)).toBeVisible();
    expect(adapters.analyze).not.toHaveBeenCalled();
  });

  it("keeps analysis consent separate from publication", async () => {
    const user = userEvent.setup();
    render(<CreatePage adapters={fixtureAdapters()} />);
    const validImage = new File(["pixels"], "旧物.jpg", { type: "image/jpeg" });

    await user.upload(screen.getByLabelText("选择物件照片"), validImage);

    expect(await screen.findByText("旧物.jpg")).toBeVisible();
    expect(screen.getByRole("button", { name: "开始机器解读" })).toBeDisabled();
    await user.click(screen.getByLabelText("同意用于本次 AI 分析"));
    expect(screen.getByRole("button", { name: "开始机器解读" })).toBeEnabled();
    expect(screen.queryByLabelText("公开原始照片")).not.toBeInTheDocument();
    expect(screen.getByText(/物件照片与稍后填写的记忆文本/)).toBeVisible();
    expect(screen.getByRole("link", { name: "查看模型服务的数据与隐私说明" })).toHaveAttribute(
      "href",
      "https://help.aliyun.com/zh/model-studio/privacy-notice",
    );
  });

  it("reveals machine interpretation only after analysis starts", async () => {
    const user = userEvent.setup();
    const adapters = fixtureAdapters();
    render(<CreatePage adapters={adapters} />);
    await user.upload(
      screen.getByLabelText("选择物件照片"),
      new File(["pixels"], "旧物.jpg", { type: "image/jpeg" }),
    );
    await user.click(screen.getByLabelText("同意用于本次 AI 分析"));
    await user.click(screen.getByRole("button", { name: "开始机器解读" }));

    expect(await screen.findByRole("heading", { name: "机器如何称呼它" })).toBeVisible();
    expect(adapters.analyze).toHaveBeenCalledOnce();
  });

  it("reaches a generated artifact before asking publication choices", async () => {
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: vi.fn(() => null),
    });
    const user = userEvent.setup();
    render(<CreatePage adapters={fixtureAdapters()} />);
    await user.upload(
      screen.getByLabelText("选择物件照片"),
      new File(["pixels"], "旧物.jpg", { type: "image/jpeg" }),
    );
    await user.click(screen.getByLabelText("同意用于本次 AI 分析"));
    await user.click(screen.getByRole("button", { name: "开始机器解读" }));
    await screen.findByRole("heading", { name: "机器如何称呼它" });

    await user.type(
      screen.getByPlaceholderText("它曾在哪里出现？谁会使用它？为什么今天还留着？"),
      "这件旧物一直被放在抽屉里，具体来历已经记不清，但磨损痕迹仍然被保留下来。",
    );
    await user.click(screen.getByRole("button", { name: "保存这段记忆" }));
    await user.click(screen.getByRole("button", { name: "计算语义距离并生成" }));

    expect(
      await screen.findByLabelText("根据机器解读和人类记忆生成的语义残差作品"),
    ).toBeVisible();
    expect(screen.getByLabelText("公开原始照片")).not.toBeChecked();
  });

  it("keeps temporary generation downloadable but disables archive submission", async () => {
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: vi.fn(() => null),
    });
    const user = userEvent.setup();
    const seed = seedArchives[0];
    render(<CreatePage adapters={fixtureAdapters({
      calculateGap: vi.fn(async () => ({
        gap: 0.5,
        generationSeed: seed.generationSeed,
        parameters: seed.visualParameters,
        mode: "temporary" as const,
        publishable: false,
        algorithmVersion: "temporary-fixed-v1",
      })),
    })} />);
    await user.upload(
      screen.getByLabelText("选择物件照片"),
      new File(["pixels"], "旧物.jpg", { type: "image/jpeg" }),
    );
    await user.click(screen.getByLabelText("同意用于本次 AI 分析"));
    await user.click(screen.getByRole("button", { name: "开始机器解读" }));
    await screen.findByRole("heading", { name: "机器如何称呼它" });
    await user.type(
      screen.getByPlaceholderText("它曾在哪里出现？谁会使用它？为什么今天还留着？"),
      "这件旧物一直被放在抽屉里，具体来历已经记不清，但磨损痕迹仍然被保留下来。",
    );
    await user.click(screen.getByRole("button", { name: "保存这段记忆" }));
    await user.click(screen.getByRole("button", { name: "计算语义距离并生成" }));

    expect(await screen.findByRole("button", { name: "下载 PNG" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "实时距离不可用，暂不能入档" })).toBeDisabled();
    expect(screen.getByText(/临时参数生成的作品仍可下载/)).toBeVisible();
  });

  it("submits separate source consent and shows the pending accession", async () => {
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: vi.fn(() => null),
    });
    const user = userEvent.setup();
    const adapters = fixtureAdapters();
    render(<CreatePage adapters={adapters} />);
    await user.upload(
      screen.getByLabelText("选择物件照片"),
      new File(["pixels"], "旧物.jpg", { type: "image/jpeg" }),
    );
    await user.click(screen.getByLabelText("同意用于本次 AI 分析"));
    await user.click(screen.getByRole("button", { name: "开始机器解读" }));
    await screen.findByRole("heading", { name: "机器如何称呼它" });
    await user.type(
      screen.getByPlaceholderText("它曾在哪里出现？谁会使用它？为什么今天还留着？"),
      "这件旧物一直被放在抽屉里，具体来历已经记不清，但磨损痕迹仍然被保留下来。",
    );
    await user.click(screen.getByRole("button", { name: "保存这段记忆" }));
    await user.click(screen.getByRole("button", { name: "计算语义距离并生成" }));
    await screen.findByRole("button", { name: "提交人工审核" });

    expect(screen.getByLabelText("申请公开生成作品与记忆")).not.toBeChecked();
    expect(screen.getByLabelText("确认本次公开授权")).not.toBeChecked();
    expect(screen.getByRole("button", { name: "提交人工审核" })).toBeDisabled();
    await user.click(screen.getByLabelText("申请公开生成作品与记忆"));
    await user.click(screen.getByLabelText("公开原始照片"));
    await user.click(screen.getByLabelText("确认本次公开授权"));
    await user.click(screen.getByRole("button", { name: "提交人工审核" }));

    expect(adapters.submit).toHaveBeenCalledWith(expect.objectContaining({
      publishArtifact: true,
      publishSource: true,
      publicationConsent: true,
      submissionToken: expect.stringMatching(/^[0-9a-f-]{36}$/),
    }));
    expect(await screen.findByText(/MMA-20260910-12345678/)).toBeVisible();
  });
});
