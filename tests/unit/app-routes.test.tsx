import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { App } from "../../src/app/App";

describe("application routes", () => {
  it.each([
    ["/", "当机器只看见物，谁来保存它曾经的生活？"],
    ["/create", "交出一件物件"],
    ["/archive", "公共档案馆"],
    ["/challenge/seed-bus-ticket-collection-01", "你能从残差里认出它吗？"],
    ["/observation", "我的观察档案"],
    ["/governance", "治理台"],
    ["/case-study", "机器误读档案馆"],
  ])("renders %s", async (path, heading) => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: heading })).toBeVisible();
  });
});
