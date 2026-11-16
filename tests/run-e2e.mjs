import { spawn, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

const previewUrl = "http://127.0.0.1:4173";
const cwd = process.cwd();
let runner;
let server;
let stopping = false;

async function fetchPreview() {
  try {
    const response = await fetch(previewUrl, { signal: AbortSignal.timeout(500) });
    return response.ok ? response.text() : undefined;
  } catch {
    return undefined;
  }
}

async function stopChild(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === "win32") {
    child.kill("SIGTERM");
  } else {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      child.kill("SIGTERM");
    }
  }
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    delay(1_000),
  ]);
  if (child.exitCode === null) {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
    } else {
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {
        child.kill("SIGKILL");
      }
    }
  }
}

async function stopAll() {
  if (stopping) return;
  stopping = true;
  await stopChild(runner);
  await stopChild(server);
}

async function run() {
  if (process.env.PLAYWRIGHT_BASE_URL) {
    runner = spawn(
      process.execPath,
      ["node_modules/@playwright/test/cli.js", "test", ...process.argv.slice(2)],
      {
        cwd,
        detached: process.platform !== "win32",
        stdio: "inherit",
        windowsHide: true,
      },
    );
    return new Promise((resolve, reject) => {
      runner.once("error", reject);
      runner.once("exit", (code) => resolve(code ?? 1));
    });
  }

  if (await fetchPreview()) {
    throw new Error("Port 4173 is already in use; stop that service before running E2E tests.");
  }

  let serverError;
  server = spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "preview",
      "--host",
      "127.0.0.1",
      "--port",
      "4173",
      "--strictPort",
    ],
    {
      cwd,
      detached: process.platform !== "win32",
      stdio: ["ignore", "inherit", "inherit"],
      windowsHide: true,
    },
  );
  server.once("error", (error) => { serverError = error; });

  let servedHtml;
  for (let attempt = 0; attempt < 40 && !servedHtml; attempt += 1) {
    if (serverError) throw serverError;
    if (server.exitCode !== null) throw new Error(`Vite preview exited with ${server.exitCode}.`);
    await delay(250);
    servedHtml = await fetchPreview();
  }
  if (!servedHtml) throw new Error(`Vite preview did not become ready at ${previewUrl}.`);

  const localHtml = await readFile("dist/index.html", "utf8");
  if (servedHtml !== localHtml) {
    throw new Error("Preview content does not match the local dist/index.html build.");
  }

  runner = spawn(
    process.execPath,
    ["node_modules/@playwright/test/cli.js", "test", ...process.argv.slice(2)],
    {
      cwd,
      detached: process.platform !== "win32",
      stdio: "inherit",
      windowsHide: true,
    },
  );
  return new Promise((resolve, reject) => {
    runner.once("error", reject);
    runner.once("exit", (code) => resolve(code ?? 1));
  });
}

const shutdown = (code) => { void stopAll().finally(() => process.exit(code)); };
process.once("SIGINT", () => shutdown(130));
process.once("SIGTERM", () => shutdown(143));

try {
  process.exitCode = await run();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await stopAll();
}
