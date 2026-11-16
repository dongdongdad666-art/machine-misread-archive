import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { governanceCollections, governanceRecords } from "../../src/data/governance-fixtures";
import { SourceRecord } from "../../src/features/governance/SourceRecord";
import { GovernancePage } from "../../src/pages/GovernancePage";

describe("governance evidence prototype", () => {
  it("requires a reason before rejection", async () => {
    const user = userEvent.setup();
    render(<GovernancePage records={[governanceRecords[0]]} collections={governanceCollections} />);

    await user.click(screen.getByRole("button", { name: "拒绝公开" }));

    expect(screen.getByRole("alert")).toHaveTextContent("请选择拒绝原因");
    expect(screen.getByLabelText("拒绝原因")).toHaveAttribute("aria-invalid", "true");
  });

  it("records a reasoned prototype decision without claiming a production write", async () => {
    const user = userEvent.setup();
    render(<GovernancePage records={[governanceRecords[0]]} collections={governanceCollections} />);

    await user.selectOptions(screen.getByLabelText("拒绝原因"), "personal-data");
    await user.type(screen.getByLabelText("审核备注"), "画面包含未遮挡的联系方式");
    await user.click(screen.getByRole("button", { name: "拒绝公开" }));

    expect(screen.getByRole("status")).toHaveTextContent("已记录原型审核动作");
    expect(within(screen.getByRole("region", { name: "决策留痕" })).getByText("个人信息未处理")).toBeVisible();
    expect(screen.getByText("本页不会写入生产审核记录")).toBeVisible();
  });

  it("does not attach a rejection reason to an approval", async () => {
    const user = userEvent.setup();
    render(<GovernancePage records={[governanceRecords[0]]} collections={governanceCollections} />);

    await user.selectOptions(screen.getByLabelText("拒绝原因"), "personal-data");
    await user.click(screen.getByRole("button", { name: "批准公开" }));

    const history = screen.getByRole("region", { name: "决策留痕" });
    expect(within(history).getByText("批准公开")).toBeVisible();
    expect(within(history).getByText("无附加原因")).toBeVisible();
    expect(within(history).queryByText("个人信息未处理")).not.toBeInTheDocument();
  });

  it("changes the live message for repeated prototype actions", async () => {
    const user = userEvent.setup();
    render(<GovernancePage records={[governanceRecords[0]]} collections={governanceCollections} />);

    await user.click(screen.getByRole("button", { name: "批准公开" }));
    expect(screen.getByRole("status")).toHaveTextContent("第 1 次批准公开");
    await user.click(screen.getByRole("button", { name: "批准公开" }));
    expect(screen.getByRole("status")).toHaveTextContent("第 2 次批准公开");
  });

  it("shows model, prompt, consent and source boundaries", () => {
    const pending = governanceRecords[0];
    render(<SourceRecord run={pending.item.machine} item={pending.item} />);

    expect(screen.getByText(pending.item.machine.modelSnapshot)).toBeVisible();
    expect(screen.getByText(pending.item.machine.promptVersion)).toBeVisible();
    expect(screen.getByText(pending.item.consentVersion)).toBeVisible();
    expect(screen.getByText("原始照片保持私密")).toBeVisible();
  });

  it("switches the active dossier from the review queue", async () => {
    const user = userEvent.setup();
    render(<GovernancePage records={governanceRecords} collections={governanceCollections} />);
    const second = governanceRecords[1];

    const queueButton = screen.getByRole("button", { name: `审阅${second.item.objectName}（${second.item.accessionNo}）` });
    expect(queueButton).toHaveAttribute("aria-controls", "dossier");
    await user.click(queueButton);

    const dossier = screen.getByRole("region", { name: "当前档案证据" });
    expect(within(dossier).getByRole("heading", { name: second.item.objectName })).toBeVisible();
    expect(within(dossier).getByText(second.item.accessionNo)).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(`已载入《${second.item.objectName}》证据`);
  });

  it("does not introduce a nested main landmark inside the app page", () => {
    const { container } = render(<GovernancePage records={governanceRecords} collections={governanceCollections} />);

    expect(container.querySelector("main")).not.toBeInTheDocument();
  });

  it("keeps every queue risk visible instead of dropping later blockers", () => {
    const record = {
      ...governanceRecords[0],
      riskFlags: ["可见文字需复核", "来源权利待确认"],
    };

    render(<GovernancePage records={[record]} collections={governanceCollections} />);

    expect(screen.getByText("可见文字需复核；来源权利待确认")).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "提交时间（北京）" })).toBeVisible();
  });

  it("surfaces withdrawal handling and both approved collection concepts", () => {
    render(<GovernancePage records={[governanceRecords[2]]} collections={governanceCollections} />);

    expect(governanceRecords[2].item.status).toBe("published");
    expect(governanceRecords[2].item.artifactVisibility).toBe("public");
    expect(screen.getAllByText("待处理撤回")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "确认撤回" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "批准公开" })).not.toBeInTheDocument();
    expect(screen.getByText("2026年9月10日 12:10")).toBeVisible();
    expect(screen.getByRole("heading", { name: "回家的票据" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "打不开的门" })).toBeVisible();
  });
});
