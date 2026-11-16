import { expect, test } from "@playwright/test";

test("the seed archive remains available after one online visit", async ({ context, page }) => {
  await page.goto("/archive");
  await expect(page.getByRole("heading", { name: "公共档案馆" })).toBeVisible();
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "/manifest.webmanifest",
  );
  const manifest = await page.evaluate(async () => {
    const response = await fetch("/manifest.webmanifest");
    return response.json() as Promise<{
      display: string;
      icons: Array<{ sizes: string; src: string; type: string }>;
      start_url: string;
    }>;
  });
  expect(manifest).toMatchObject({ display: "standalone", start_url: "/" });
  expect(manifest.icons).toEqual(expect.arrayContaining([
    expect.objectContaining({ sizes: "192x192", type: "image/png" }),
    expect.objectContaining({ sizes: "512x512", type: "image/png" }),
  ]));
  const iconSizes = await page.evaluate(async (icons) => Promise.all(
    icons.filter((icon) => icon.type === "image/png").map(async (icon) => {
      const response = await fetch(icon.src);
      const bitmap = await createImageBitmap(await response.blob());
      return `${bitmap.width}x${bitmap.height}`;
    }),
  ), manifest.icons);
  expect(iconSizes).toEqual(expect.arrayContaining(["192x192", "512x512"]));

  await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return;
    await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((resolve) => window.setTimeout(resolve, 2_000)),
    ]);
  });
  await page.reload();
  expect(await page.evaluate(() => Boolean(navigator.serviceWorker?.controller))).toBe(true);

  await page.evaluate(async () => {
    await Promise.allSettled([
      fetch("/api/analyze", { method: "POST", body: "{}" }),
      fetch("/api/gap", { method: "POST", body: "{}" }),
      fetch("/api/submit", { method: "POST", body: "{}" }),
      fetch("/uploads/private-object.webp"),
      fetch("/private-source/object-01"),
    ]);
  });
  const cachedUrls = await page.evaluate(async () => {
    const names = await caches.keys();
    const requests = (await Promise.all(
      names.map((name) => caches.open(name).then((cache) => cache.keys())),
    )).flat();
    return requests.map((request) => request.url);
  });
  expect(cachedUrls.some((url) => /\/api\/|\/uploads\/|\/private-source\//.test(url))).toBe(false);

  await context.setOffline(true);
  try {
    await page.goto("/archive");
    await expect(page.getByText("显示 12 / 12 件公开档案")).toBeVisible();
    await expect(page.getByRole("link", { name: /打开档案：严重磨损的《新华字典》/ })).toBeVisible();
    const indexCount = await page.evaluate(async () => {
      const response = await fetch("/seed-archive.json");
      const index = await response.json() as { records: unknown[] };
      return index.records.length;
    });
    expect(indexCount).toBe(12);
    const mediaFiles = [
      "audio-cassette-source.webp",
      "card-payphone-source.webp",
      "digital-clock-source.webp",
      "film-canisters-source.webp",
      "floppy-disk-source.webp",
      "numeric-pager-source.webp",
      "rotary-telephone-source.webp",
      "slide-rule-source.webp",
      "vhs-tape-source.webp",
    ];
    const offlineMedia = await page.evaluate(async (files) => Promise.all(
      files.map(async (file) => (await fetch(`/seed-media/${file}`)).ok),
    ), mediaFiles);
    expect(offlineMedia).toEqual(mediaFiles.map(() => true));
  } finally {
    await context.setOffline(false);
  }
});
