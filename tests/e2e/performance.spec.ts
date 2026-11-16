import { readFileSync, readdirSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { expect, test } from "@playwright/test";

test("initial JavaScript stays within 250 KB gzip", () => {
  const html = readFileSync("dist/index.html", "utf8");
  const entryScripts = [...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g)]
    .map((match) => match[1]);
  expect(entryScripts.length).toBeGreaterThan(0);

  const gzipBytes = entryScripts.reduce((total, source) => {
    const asset = readFileSync(`dist/${source.replace(/^\//, "")}`);
    return total + gzipSync(asset).byteLength;
  }, 0);
  expect(gzipBytes).toBeLessThanOrEqual(250 * 1024);
});

test("home loads no more than 700 KB before interaction", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  const metrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
    const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    return {
      hasNavigation: navigation.length > 0,
      hasScript: resources.some((entry) => entry.initiatorType === "script"),
      hasStylesheet: resources.some(
        (entry) => entry.initiatorType === "link" && entry.name.includes(".css"),
      ),
      transferredBytes: [...navigation, ...resources].reduce(
        (total, entry) => total + (entry.transferSize || entry.encodedBodySize || 0),
        0,
      ),
    };
  });

  expect(metrics).toMatchObject({ hasNavigation: true, hasScript: true, hasStylesheet: true });
  expect(metrics.transferredBytes).toBeGreaterThan(0);
  expect(metrics.transferredBytes).toBeLessThanOrEqual(700 * 1024);
});

test("seed thumbnails stay within 180 KB each", () => {
  const files = readdirSync("public/seed-media").filter((name) => name.endsWith(".webp"));
  expect(files.length).toBeGreaterThan(0);
  for (const file of files) {
    expect(statSync(`public/seed-media/${file}`).size, file).toBeLessThanOrEqual(180 * 1024);
  }
});
