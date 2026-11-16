import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { seedArchives } from "../../src/data/seed-archives";
import type { ArchiveItem } from "../../src/domain/archive";
import { ArchiveDetail } from "../../src/features/archive/ArchiveDetail";
import { ArchiveDetailPage } from "../../src/pages/ArchiveDetailPage";
import { ArchivePage } from "../../src/pages/ArchivePage";

function published(item: ArchiveItem): ArchiveItem {
  return {
    ...structuredClone(item),
    status: "published",
    artifactVisibility: "public",
  };
}

function renderArchive(records: ArchiveItem[]) {
  return render(
    <MemoryRouter>
      <ArchivePage records={records} />
    </MemoryRouter>,
  );
}

describe("public archive", () => {
  it("never renders non-published records", () => {
    const visible = published(seedArchives[0]);
    const pending = {
      ...structuredClone(seedArchives[1]),
      objectName: "不应出现的待审核钥匙",
      status: "pending_review" as const,
      artifactVisibility: "public_requested" as const,
    };

    renderArchive([visible, pending]);

    expect(screen.getByText(visible.objectName)).toBeVisible();
    expect(screen.queryByText(pending.objectName)).not.toBeInTheDocument();
  });

  it("shows both interpretations and provenance without exposing a private source", () => {
    const item = published(seedArchives[0]);

    render(<ArchiveDetail item={item} />);

    const comparison = screen.getByRole("group", { name: "实物证据与机器残差对照" });
    expect(screen.getByText(item.machine.caption)).toBeVisible();
    expect(screen.getByText(item.memory.text)).toBeVisible();
    expect(screen.getByText(/模型与提示词版本/)).toBeVisible();
    expect(within(comparison).getByText(/原始照片未公开/)).toBeVisible();
    expect(screen.queryByAltText(`${item.objectName}原始照片`)).not.toBeInTheDocument();
  });

  it("pairs public source photos with generated artifacts in cards and detail views", () => {
    const item = seedArchives.find((record) => record.id === "seed-rotary-telephone-01");
    expect(item).toBeDefined();

    const archive = renderArchive([item!]);
    expect(screen.getByRole("img", { name: `${item!.objectName}原始照片` })).toHaveAttribute(
      "src",
      item!.sourceUrl,
    );
    expect(screen.getByLabelText(`${item!.objectName}的语义残差作品`)).toBeVisible();

    archive.unmount();
    render(<ArchiveDetail item={item!} />);

    const comparison = screen.getByRole("group", { name: "实物证据与机器残差对照" });
    expect(within(comparison).getByText("实物照片")).toBeVisible();
    expect(within(comparison).getByText("机器残差")).toBeVisible();
    expect(within(comparison).getByRole("img", { name: `${item!.objectName}原始照片` })).toHaveAttribute(
      "src",
      item!.sourceUrl,
    );
    expect(within(comparison).getByLabelText(`${item!.objectName}的语义残差作品`)).toBeVisible();
  });

  it("renders different residue structures for different archive objects", () => {
    const ticket = published(seedArchives[0]);
    const keys = published(seedArchives[1]);
    const dictionary = published(seedArchives[2]);

    const { container } = renderArchive([ticket, keys, dictionary]);
    const variants = Array.from(
      container.querySelectorAll<HTMLElement>("[data-residue-variant]"),
      (node) => node.dataset.residueVariant,
    );

    expect(variants).toEqual(["bus-tickets", "keys", "dictionary"]);
    expect(new Set(variants).size).toBe(3);
  });

  it("uses a privacy placeholder instead of a private image in archive cards", () => {
    const item = published(seedArchives[0]);

    renderArchive([item]);

    expect(screen.getByText("原始照片未公开")).toBeVisible();
    expect(screen.queryByRole("img", { name: `${item.objectName}原始照片` })).not.toBeInTheDocument();
    expect(document.querySelector('img[src^="private-source:"]')).not.toBeInTheDocument();
  });

  it("blocks a private source URL even when its visibility flag is inconsistent", () => {
    const item = {
      ...published(seedArchives[0]),
      sourceVisibility: "public" as const,
    };

    renderArchive([item]);

    expect(screen.getByText("原始照片未公开")).toBeVisible();
    expect(screen.queryByRole("img", { name: `${item.objectName}原始照片` })).not.toBeInTheDocument();
    expect(document.querySelector('img[src^="private-source:"]')).not.toBeInTheDocument();
  });

  it("renders structured attribution for a licensed source", () => {
    const item = seedArchives.find((record) => record.id === "seed-rotary-telephone-01");
    expect(item).toBeDefined();

    render(<ArchiveDetail item={item!} />);

    expect(screen.getByText("Wilfredor")).toBeVisible();
    expect(screen.getByRole("link", { name: "查看 Wikimedia Commons 来源页" })).toHaveAttribute(
      "href",
      "https://commons.wikimedia.org/wiki/File:Grey_rotary_dial_telephone.jpg",
    );
    expect(screen.getByRole("link", { name: "CC BY-SA 4.0" })).toHaveAttribute(
      "href",
      "https://creativecommons.org/licenses/by-sa/4.0/",
    );
    expect(screen.getByText("缩放并转换为 WebP；派生文件按相同许可发布")).toBeVisible();
  });

  it("filters published work by disappearance mode", async () => {
    const user = userEvent.setup();
    const ticket = published(seedArchives[0]);
    const dictionary = published(seedArchives[2]);

    renderArchive([ticket, dictionary]);
    await user.selectOptions(screen.getByLabelText("按消失方式筛选"), "媒介替代");

    expect(screen.getByText(dictionary.objectName)).toBeVisible();
    expect(screen.queryByText(ticket.objectName)).not.toBeInTheDocument();
  });

  it("uses real links for archive records", () => {
    const item = published(seedArchives[0]);
    renderArchive([item]);

    expect(screen.getByRole("link", { name: new RegExp(item.objectName) })).toHaveAttribute(
      "href",
      `/archive/${item.id}`,
    );
  });

  it("offers a curated challenge from the public archive hero", () => {
    renderArchive(seedArchives);

    expect(screen.getByRole("link", { name: "开始一次误读挑战" })).toHaveAttribute(
      "href",
      "/challenge/seed-bus-ticket-collection-01",
    );
  });

  it("organizes verified archive knowledge into six evidence drawers", () => {
    const item = published(seedArchives[2]);
    render(<ArchiveDetail item={item} />);

    const drawers = screen.getByRole("region", { name: "六层档案记录" });
    for (const label of ["证据", "使用", "时间", "地区", "误读", "补述"]) {
      expect(within(drawers).getByText(label)).toBeVisible();
    }
    expect(within(drawers).getByText("透明胶带")).toBeInTheDocument();
    expect(within(drawers).getByText("新华字典")).toBeInTheDocument();
    expect(within(drawers).getByText(item.timeRange)).toBeInTheDocument();
    expect(within(drawers).getByText("地区资料待补述")).toBeInTheDocument();
    expect(within(drawers).getByText(item.machine.uncertainties[0])).toBeInTheDocument();
    expect(within(drawers).getByText(item.memory.relation)).toBeInTheDocument();
  });

  it("ignores a host-specific return value when resetting detail scroll", () => {
    const originalScrollTo = window.scrollTo;
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    Object.defineProperty(window, "scrollTo", {
      configurable: true,
      value: vi.fn(() => Promise.resolve()),
    });

    try {
      const view = render(
        <MemoryRouter initialEntries={[`/archive/${seedArchives[0].id}`]}>
          <Routes>
            <Route path="/archive/:id" element={<ArchiveDetailPage />} />
          </Routes>
        </MemoryRouter>,
      );

      expect(() => view.unmount()).not.toThrow();
      expect(consoleError).not.toHaveBeenCalledWith(
        expect.stringContaining("useEffect must not return anything"),
      );
    } finally {
      Object.defineProperty(window, "scrollTo", {
        configurable: true,
        value: originalScrollTo,
      });
      consoleError.mockRestore();
    }
  });
});
