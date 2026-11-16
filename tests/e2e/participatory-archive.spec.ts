import { expect, test } from "@playwright/test";

test("a visitor can judge, reveal three readings, and keep a personal residue", async ({ page }) => {
  await page.goto("/challenge/seed-old-keys-01");

  await expect(page.getByLabel("尚未揭示名称的机器残差")).toBeVisible();
  await expect(page.getByRole("heading", { name: "用途待确认的旧钥匙组" })).toHaveCount(0);

  await page.getByRole("radio", { name: "一组发簪" }).check();
  await page.getByRole("button", { name: "提交判断" }).click();

  await expect(page.getByRole("heading", { name: "你的判断" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "机器判断" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "可核验的人类档案" })).toBeVisible();
  await expect(page.getByText("保留为一条不同判断，不自动判定为错误。")).toBeVisible();

  await page.getByRole("link", { name: "查看我的观察" }).click();
  await expect(page.getByText("完成 1 次观察")).toBeVisible();
  await expect(page.getByText("保留不同判断 1 次")).toBeVisible();
  await expect(page.getByRole("img", { name: "我的观察残差" })).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载个人残差" }).click();
  expect((await download).suggestedFilename()).toBe("my-observation-residue.svg");
});

test("a public record exposes six expandable evidence layers", async ({ page }) => {
  await page.goto("/archive/seed-old-dictionary-01");

  const record = page.getByRole("region", { name: "六层档案记录" });
  await expect(record.locator("details")).toHaveCount(6);
  await expect(record.getByText("透明胶带", { exact: true })).toBeVisible();

  await record.getByText("时间", { exact: true }).click();
  await expect(record.getByText("封面标注2003年修订本，实际使用年份待补充")).toBeVisible();
  await expect(record.getByRole("link", { name: "挑战你的判断" })).toHaveAttribute(
    "href",
    "/challenge/seed-old-dictionary-01",
  );
});
