import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { ChallengePage } from "../../src/pages/ChallengePage";
import { loadObservationTrace } from "../../src/lib/observation-trace";

function renderChallenge(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/challenge/:id" element={<ChallengePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("machine misread challenge", () => {
  beforeEach(() => localStorage.clear());

  it("keeps the object identity hidden until a visitor submits a judgment", async () => {
    const user = userEvent.setup();
    renderChallenge("/challenge/seed-old-keys-01");

    expect(screen.getByRole("heading", { name: "你能从残差里认出它吗？" })).toBeVisible();
    expect(screen.queryByText("用途待确认的旧钥匙组")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/用途待确认的旧钥匙组/)).not.toBeInTheDocument();
    expect(screen.getByText("两个圆形镂空端部连接着细长金属柄。")).toBeVisible();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(screen.queryByRole("heading", { name: "你的判断" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "两枚长柄钥匙" }));
    await user.click(screen.getByRole("button", { name: "提交判断" }));

    expect(screen.getByText("用途待确认的旧钥匙组")).toBeVisible();
    expect(screen.getByRole("heading", { name: "你的判断" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "机器判断" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "可核验的人类档案" })).toBeVisible();
    expect(screen.getByRole("link", { name: "查看完整档案" })).toHaveAttribute(
      "href",
      "/archive/seed-old-keys-01",
    );
    expect(screen.getByRole("link", { name: "继续下一件" })).toHaveAttribute(
      "href",
      "/challenge/seed-old-dictionary-01",
    );
    expect(loadObservationTrace().attempts).toHaveLength(1);
  });

  it("returns to the public archive when a challenge is unavailable", () => {
    renderChallenge("/challenge/not-found");

    expect(screen.getByRole("heading", { name: "未找到这项挑战" })).toBeVisible();
    expect(screen.getByRole("link", { name: "返回公共档案馆" })).toHaveAttribute(
      "href",
      "/archive",
    );
  });

  it("returns to a hidden unanswered state when continuing to the next object", async () => {
    const user = userEvent.setup();
    renderChallenge("/challenge/seed-old-keys-01");

    await user.click(screen.getByRole("radio", { name: "两枚长柄钥匙" }));
    await user.click(screen.getByRole("button", { name: "提交判断" }));
    await user.click(screen.getByRole("link", { name: "继续下一件" }));

    expect(screen.getByRole("heading", { name: "你能从残差里认出它吗？" })).toBeVisible();
    expect(screen.queryByText("严重磨损的《新华字典》")).not.toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });
});
