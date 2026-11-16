import { expect, test } from "@playwright/test";

const liveBaseUrl = process.env.PLAYWRIGHT_BASE_URL;

test.describe("production smoke", () => {
  test.skip(!liveBaseUrl, "Set PLAYWRIGHT_BASE_URL to run production smoke coverage.");

  for (const [path, heading] of Object.entries({
    "/": "当机器只看见物，谁来保存它曾经的生活？",
    "/create": "交出一件物件",
    "/archive": "公共档案馆",
    "/case-study": "机器误读档案馆",
    "/archive/seed-old-dictionary-01": "严重磨损的《新华字典》",
  })) {
    test(`${path} is reachable`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
      await expect(page.locator(".route-loading")).toHaveCount(0);
    });
  }

  for (const path of ["/api/analyze", "/api/gap", "/api/submit"]) {
    test(`${path} returns a configured health state without caching`, async ({ request }) => {
      const response = await request.get(path);
      expect([405, 503]).toContain(response.status());
      expect(response.headers()["cache-control"]).toContain("no-store");
      expect(response.headers()["content-type"]).toContain("application/json");
    });
  }

  test("a public source image loads beside its generated artifact", async ({ page }) => {
    await page.goto("/archive");

    const cardSource = page.getByRole("img", { name: "灰色转盘电话原始照片" });
    await cardSource.scrollIntoViewIfNeeded();
    await expect(cardSource).toBeVisible();
    await expect.poll(() => cardSource.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);

    await page.goto("/archive/seed-rotary-telephone-01");

    const comparison = page.getByRole("group", { name: "实物证据与机器残差对照" });
    const source = comparison.getByRole("img", { name: "灰色转盘电话原始照片" });
    await expect(source).toBeVisible();
    await expect.poll(() => source.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    await expect(comparison.getByLabel("灰色转盘电话的语义残差作品")).toBeVisible();
  });

  test("a private source stays behind a privacy placeholder", async ({ page }) => {
    await page.goto("/archive/seed-old-dictionary-01");

    const comparison = page.getByRole("group", { name: "实物证据与机器残差对照" });
    await expect(comparison.getByText("原始照片未公开")).toBeVisible();
    await expect(comparison.locator(".archive-visual-panel--source img")).toHaveCount(0);
    await expect(page.locator('img[src^="private-source:"]')).toHaveCount(0);
  });
});
