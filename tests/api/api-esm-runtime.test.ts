import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test } from "vitest";

const projectRoot = process.cwd();
const tsc = resolve(projectRoot, "node_modules/typescript/bin/tsc");
const entries = ["api/analyze.ts", "api/gap.ts", "api/submit.ts"];

test("API entrypoints compile and import in the Node ESM runtime", async () => {
  const root = await mkdtemp(join(tmpdir(), "api-esm-runtime-"));
  const output = join(root, "output");
  try {
    const result = spawnSync(process.execPath, [
      tsc,
      "--ignoreConfig",
      "--module", "NodeNext",
      "--moduleResolution", "NodeNext",
      "--target", "ES2022",
      "--types", "node",
      "--outDir", output,
      "--rootDir", projectRoot,
      "--skipLibCheck",
      ...entries,
    ], { cwd: projectRoot, encoding: "utf8" });

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    await mkdir(output, { recursive: true });
    await writeFile(join(output, "package.json"), '{"type":"module"}\n');

    for (const entry of entries) {
      const result = spawnSync(process.execPath, [
        "--input-type=module",
        "--eval",
        `const module = await import(${JSON.stringify(pathToFileURL(join(output, entry.replace(/\.ts$/, ".js"))).href)}); if (typeof module.default?.fetch !== "function") process.exit(1);`,
      ], { encoding: "utf8" });
      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
