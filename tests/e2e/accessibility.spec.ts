import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

const routeHeadings = {
  "/": "当机器只看见物，谁来保存它曾经的生活？",
  "/create": "交出一件物件",
  "/archive": "公共档案馆",
  "/challenge/seed-old-keys-01": "你能从残差里认出它吗？",
  "/observation": "我的观察档案",
  "/governance": "治理台",
  "/case-study": "机器误读档案馆",
} as const;

async function focusWithTab(page: Page, target: Locator) {
  for (let step = 0; step < 30; step += 1) {
    if (await target.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error("Target could not be reached with Tab navigation");
}

async function completeSeedCreation(page: Page) {
  await page.goto("/create");

  const seedButton = page.getByRole("button", { name: "使用示例：旧字典" });
  await focusWithTab(page, seedButton);
  await page.keyboard.press("Enter");

  const memory = page.getByLabel("写下一段真实记忆");
  await focusWithTab(page, memory);
  await page.keyboard.type(
    "这本旧字典在家中的抽屉里保存了很多年，封面的胶带和磨损仍然清楚可见。",
  );

  const save = page.getByRole("button", { name: "保存这段记忆" });
  await focusWithTab(page, save);
  await page.keyboard.press("Enter");

  const generate = page.getByRole("button", { name: "计算语义距离并生成" });
  await focusWithTab(page, generate);
  await page.keyboard.press("Enter");

  await expect(
    page.getByLabel("根据机器解读和人类记忆生成的语义残差作品"),
  ).toBeVisible();
}

test("a seed object can be completed with keyboard input", async ({ page }) => {
  await completeSeedCreation(page);
});

test("keyboard focus is visibly indicated", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");

  const focused = page.locator(":focus-visible");
  await expect(focused).toHaveCount(1);
  await expect
    .poll(() => focused.evaluate((element) => getComputedStyle(element).outlineWidth))
    .not.toBe("0px");
});

for (const [path, heading] of Object.entries(routeHeadings)) {
  test(`${path} has no serious or critical axe violations`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
    await expect(page.locator(".route-loading")).toHaveCount(0);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const blocking = results.violations.filter(
      (violation) => violation.impact === "critical" || violation.impact === "serious",
    );

    expect(blocking.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      targets: violation.nodes.map((node) => node.target.join(" ")),
    }))).toEqual([]);
  });
}

test("reduced motion keeps the generated canvas static", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await completeSeedCreation(page);

  const canvas = page.getByLabel("根据机器解读和人类记忆生成的语义残差作品");
  const first = await canvas.screenshot();
  await page.waitForTimeout(250);
  const second = await canvas.screenshot();

  expect(second.equals(first)).toBe(true);
});
