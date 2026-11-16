import { expect, test } from "@playwright/test";

const routes = {
  "/": "当机器只看见物，谁来保存它曾经的生活？",
  "/create": "交出一件物件",
  "/archive": "公共档案馆",
  "/challenge/seed-old-keys-01": "你能从残差里认出它吗？",
  "/archive/seed-old-dictionary-01": "严重磨损的《新华字典》",
  "/observation": "我的观察档案",
  "/governance": "治理台",
  "/case-study": "机器误读档案馆",
} as const;

for (const width of [320, 390, 768, 1440]) {
  test(`${width}px pages do not overflow the viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });

    for (const [path, heading] of Object.entries(routes)) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
      await expect(page.locator(".route-loading")).toHaveCount(0);
      const dimensions = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        content: document.documentElement.scrollWidth,
        offenders: [...document.querySelectorAll("body *")]
          .map((element) => ({
            element: `${element.tagName.toLowerCase()}.${element.className}`,
            left: Math.round(element.getBoundingClientRect().left),
            right: Math.round(element.getBoundingClientRect().right),
          }))
          .filter((item) => item.left < 0 || item.right > document.documentElement.clientWidth)
          .slice(0, 8),
        internalOverflow: [document.body, ...document.querySelectorAll("body *")]
          .filter((element) => element.scrollWidth > element.clientWidth + 1)
          .map((element) => ({
            element: `${element.tagName.toLowerCase()}.${element.className}`,
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
          }))
          .slice(0, 40),
      }));
      expect(dimensions.content, `${path} overflowed at ${width}px: ${JSON.stringify({ offenders: dimensions.offenders, internalOverflow: dimensions.internalOverflow })}`).toBeLessThanOrEqual(
        dimensions.viewport,
      );
    }
  });
}

test("paired archive visuals keep equal heights on a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });

  for (const path of ["/archive", "/archive/seed-old-dictionary-01"]) {
    await page.goto(path);
    const comparison = page.getByRole("group", { name: "实物证据与机器残差对照" }).first();
    const panels = comparison.locator(":scope > .archive-visual-panel");
    await expect(panels).toHaveCount(2);
    const heights = await panels.evaluateAll((elements) =>
      elements.map((element) => Math.round(element.getBoundingClientRect().height)),
    );
    expect(heights[0], `${path} source/artifact heights: ${heights.join("/")}`).toBe(heights[1]);
  }
});
