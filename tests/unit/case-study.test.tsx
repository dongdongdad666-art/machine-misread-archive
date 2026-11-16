import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { CaseStudyPage } from "../../src/pages/CaseStudyPage";
import { HomePage } from "../../src/pages/HomePage";
import { seedArchives } from "../../src/data/seed-archives";

const sectionHeadings = [
  "问题",
  "假设",
  "范围",
  "真实物件",
  "机器与人的张力",
  "交互流程",
  "生成规则",
  "技术架构",
  "治理机制",
  "失败与边界",
  "限制",
  "商业延展",
];

describe("portfolio narrative", () => {
  it("presents the evidence-led case study in review order", () => {
    const { container } = render(<MemoryRouter><CaseStudyPage /></MemoryRouter>);
    const headings = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);

    expect(headings).toEqual(sectionHeadings);
    expect(screen.getByRole("link", { name: "体验可运行原型" })).toHaveAttribute("href", "/create");
    expect(screen.getByText(/3 件用户提供实拍，9 件许可档案影像/)).toBeVisible();
    expect(container.textContent).toContain("不把生成图当作真实物件证据");
  });

  it("places the live prototype invitation before supporting mockups", () => {
    const { container } = render(<MemoryRouter><CaseStudyPage /></MemoryRouter>);
    const prototype = screen.getByRole("link", { name: "体验可运行原型" });
    const mockups = screen.getByText("辅助呈现，不作为功能证据");

    expect(prototype.compareDocumentPosition(mockups) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.querySelector("[data-evidence='live-prototype']")).toContainElement(prototype);
  });

  it("does not expose private source photographs as case-study media", () => {
    const { container } = render(<MemoryRouter><CaseStudyPage /></MemoryRouter>);
    const privateSources = seedArchives
      .filter((item) => item.sourceVisibility === "private")
      .map((item) => item.sourceUrl);
    const shownSources = Array.from(container.querySelectorAll("img"))
      .map((image) => image.getAttribute("src"));

    expect(shownSources.filter((source) => source && privateSources.includes(source))).toEqual([]);
  });

  it("introduces the current theme and a representative archive on the homepage", () => {
    render(<MemoryRouter><HomePage /></MemoryRouter>);

    expect(screen.getByRole("heading", { name: "当机器只看见物，谁来保存它曾经的生活？" })).toBeVisible();
    expect(screen.getByText("当期专题：失去说明书的日常物件")).toBeVisible();
    expect(screen.getByRole("link", { name: /查看代表档案/ })).toHaveAttribute(
      "href",
      "/archive/seed-old-dictionary-01",
    );
  });
});
