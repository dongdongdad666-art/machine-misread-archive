import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test } from "vitest";

const validator = resolve(process.cwd(), "scripts/validate-deployment.mjs");
const requiredEnvironment = [
  "DASHSCOPE_API_KEY",
  "DASHSCOPE_BASE_URL",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "QUOTA_SALT",
];

const validConfig = {
  functions: {
    "api/**/*.ts": { regions: ["sin1"] },
  },
  rewrites: [
    { source: "/((?!api(?:/|$)).*)", destination: "/index.html" },
  ],
  headers: [
    {
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=()" },
      ],
    },
    ...["/api/:path*", "/uploads/:path*", "/private-source/:path*"].map((source) => ({
      source,
      headers: [{ key: "Cache-Control", value: "no-store" }],
    })),
  ],
};

function environmentExample(extra = "") {
  return `${requiredEnvironment.map((name) => `${name}=`).join("\n")}\n${extra}`;
}

async function runValidator(config: object, envExample = environmentExample()) {
  const root = await mkdtemp(join(tmpdir(), "deployment-validation-"));
  try {
    await Promise.all([
      writeFile(join(root, "vercel.json"), JSON.stringify(config)),
      writeFile(join(root, "README.md"), requiredEnvironment.join("\n")),
      writeFile(join(root, ".env.example"), envExample),
    ]);
    return spawnSync(process.execPath, [validator], { cwd: root, encoding: "utf8" });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("accepts the complete deployment configuration", async () => {
  expect((await runValidator(validConfig)).status).toBe(0);
});

test("rejects every SPA rewrite that catches an API entry", async () => {
  const config = structuredClone(validConfig);
  config.rewrites.push({ source: "/api/:path*", destination: "/index.html" });

  const result = await runValidator(config);
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain("SPA rewrite must exactly match the archive fallback.");
});

test("rejects a partial API whitelist in the SPA rewrite", async () => {
  const config = structuredClone(validConfig);
  config.rewrites[0].source = "/((?!api/(?:analyze|gap|submit)$).*)";

  const result = await runValidator(config);
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain("SPA rewrite must exactly match the archive fallback.");
});

test("rejects a non-application SPA rewrite", async () => {
  const config = structuredClone(validConfig);
  config.rewrites[0].source = "/unrelated";

  const result = await runValidator(config);
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain("SPA rewrite must exactly match the archive fallback.");
});

test("requires sin1 coverage for every API entrypoint", async () => {
  const config = structuredClone(validConfig);
  const functions = config.functions as Record<string, { regions: string[] }>;
  delete functions["api/**/*.ts"];
  functions["not-api/*.ts"] = { regions: ["sin1"] };

  const result = await runValidator(config);
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain("api/analyze.ts must run in the sin1 region.");
});

test("requires every global security header on application and API routes", async () => {
  const config = structuredClone(validConfig);
  config.headers[0].source = "/unrelated/:path*";

  const result = await runValidator(config);
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain("X-Content-Type-Options must use a sitewide header rule.");
});

test("requires one sitewide security-header rule", async () => {
  const config = structuredClone(validConfig);
  const globalHeaders = config.headers[0].headers;
  const cacheHeaders = config.headers.slice(1);
  config.headers = [
    ...["/", "/create", "/archive", "/case-study", "/api/analyze", "/api/gap", "/api/submit"].map((source) => ({
      source,
      headers: globalHeaders,
    })),
    ...cacheHeaders,
  ];

  const result = await runValidator(config);
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain("X-Content-Type-Options must use a sitewide header rule.");
});

test("rejects VITE_ declarations in build.env", async () => {
  const config = structuredClone(validConfig);
  Object.assign(config, { build: { env: { VITE_DASHSCOPE_API_KEY: "secret" } } });

  const result = await runValidator(config);
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain("VITE_DASHSCOPE_API_KEY must not be declared.");
});

test("rejects VITE_ declarations in .env.example", async () => {
  const result = await runValidator(validConfig, environmentExample("VITE_OTHER_SECRET=secret\n"));

  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain("VITE_OTHER_SECRET must not be declared.");
});

test("rejects VITE_SECRET in config.env", async () => {
  const config = structuredClone(validConfig);
  Object.assign(config, { env: { VITE_SECRET: "secret" } });

  const result = await runValidator(config);
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain("VITE_SECRET must not be declared.");
});

test("rejects VITE_PASSWORD in build.env", async () => {
  const config = structuredClone(validConfig);
  Object.assign(config, { build: { env: { VITE_PASSWORD: "secret" } } });

  const result = await runValidator(config);
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain("VITE_PASSWORD must not be declared.");
});
