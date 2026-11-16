import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { ObservationPage } from "../../src/pages/ObservationPage";
import { DRAFT_STORAGE_KEY } from "../../src/lib/local-draft";
import {
  OBSERVATION_STORAGE_KEY,
  recordObservation,
} from "../../src/lib/observation-trace";

function renderPage() {
  return render(<MemoryRouter><ObservationPage /></MemoryRouter>);
}

describe("personal observation archive", () => {
  beforeEach(() => localStorage.clear());

  it("invites a first challenge when there is no observation trace", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "我的观察档案" })).toBeVisible();
    expect(screen.getByText("还没有观察记录")).toBeVisible();
    expect(screen.getByRole("link", { name: "开始第一次观察" })).toHaveAttribute(
      "href",
      "/challenge/seed-bus-ticket-collection-01",
    );
  });

  it("turns completed challenges into a personal trace and downloadable residue", () => {
    recordObservation({
      challengeId: "challenge-bus-ticket-usage",
      archiveId: "seed-bus-ticket-collection-01",
      challengeType: "usage",
      selectedOptionId: "fare-proof",
      answerOptionId: "fare-proof",
      matchedCuratorialAnswer: true,
      focus: "usage",
      completedAt: "2026-09-11T08:00:00.000Z",
    });
    recordObservation({
      challengeId: "challenge-keys-identity",
      archiveId: "seed-old-keys-01",
      challengeType: "identity",
      selectedOptionId: "hairpins",
      answerOptionId: "keys",
      matchedCuratorialAnswer: false,
      focus: "shape",
      completedAt: "2026-09-11T08:05:00.000Z",
    });

    renderPage();

    expect(screen.getByText("完成 2 次观察")).toBeVisible();
    expect(screen.getByText("与策展答案一致 1 次")).toBeVisible();
    expect(screen.getByText("保留不同判断 1 次")).toBeVisible();
    expect(screen.getByText("纸质公交车票集合")).toBeVisible();
    expect(screen.getByText("用途待确认的旧钥匙组")).toBeVisible();
    expect(screen.getByRole("img", { name: "我的观察残差" })).toBeVisible();
    expect(screen.getByRole("button", { name: "下载个人残差" })).toBeVisible();
  });

  it("requires confirmation before clearing only the observation record", async () => {
    const user = userEvent.setup();
    localStorage.setItem(DRAFT_STORAGE_KEY, "untouched-draft");
    recordObservation({
      challengeId: "challenge-bus-ticket-usage",
      archiveId: "seed-bus-ticket-collection-01",
      challengeType: "usage",
      selectedOptionId: "fare-proof",
      answerOptionId: "fare-proof",
      matchedCuratorialAnswer: true,
      focus: "usage",
      completedAt: "2026-09-11T08:00:00.000Z",
    });
    renderPage();

    await user.click(screen.getByRole("button", { name: "清空观察记录" }));
    expect(localStorage.getItem(OBSERVATION_STORAGE_KEY)).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "确认清空" }));
    expect(localStorage.getItem(OBSERVATION_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(DRAFT_STORAGE_KEY)).toBe("untouched-draft");
    expect(screen.getByText("还没有观察记录")).toBeVisible();
  });
});
