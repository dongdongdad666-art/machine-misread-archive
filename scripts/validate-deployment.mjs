import { readFile } from "node:fs/promises";

const requiredEnvironment = [
  "DASHSCOPE_API_KEY",
  "DASHSCOPE_BASE_URL",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "QUOTA_SALT",
];
const apiEntrypoints = ["api/analyze.ts", "api/gap.ts", "api/submit.ts"];
const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=()",
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function read(path) {
  return readFile(path, "utf8");
}

function matchesGlob(pattern, path) {
  if (typeof pattern !== "string") return false;
  let expression = "";
  for (let index = 0; index < pattern.length; index += 1) {
    if (pattern[index] === "*" && pattern[index + 1] === "*") {
      if (pattern[index + 2] === "/") {
        expression += "(?:.*/)?";
        index += 2;
      } else {
        expression += ".*";
        index += 1;
      }
    } else if (pattern[index] === "*") {
      expression += "[^/]*";
    } else {
      expression += pattern[index].replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
    }
  }
  return new RegExp(`^${expression}$`).test(path);
}

function environmentNames(environment) {
  return environment && typeof environment === "object" && !Array.isArray(environment)
    ? Object.keys(environment)
    : [];
}

const config = JSON.parse(await read("vercel.json"));
const readme = await read("README.md");
const environmentExample = await read(".env.example");
const headers = config.headers ?? [];

const spaRewrites = (config.rewrites ?? []).filter((rewrite) => rewrite.destination === "/index.html");
assert(
  spaRewrites.length === 1 && spaRewrites[0].source === "/((?!api(?:/|$)).*)",
  "SPA rewrite must exactly match the archive fallback.",
);

for (const entrypoint of apiEntrypoints) {
  assert(
    Object.entries(config.functions ?? {}).some(([pattern, value]) => (
      matchesGlob(pattern, entrypoint) && Array.isArray(value?.regions) && value.regions.includes("sin1")
    )),
    `${entrypoint} must run in the sin1 region.`,
  );
}

const sitewideHeaders = headers.filter((entry) => (
  entry.source === "/:path*" || entry.source === "/(.*)"
));
for (const [name, value] of Object.entries(securityHeaders)) {
  assert(
    sitewideHeaders.some((entry) => entry.headers?.some((header) => (
      header.key === name && header.value === value
    ))),
    `${name} must use a sitewide header rule.`,
  );
}

for (const source of ["/api/:path*", "/uploads/:path*", "/private-source/:path*"]) {
  const entry = headers.find((candidate) => candidate.source === source);
  assert(
    entry?.headers?.some((header) => header.key.toLowerCase() === "cache-control" && header.value === "no-store"),
    `${source} must send Cache-Control: no-store.`,
  );
}

for (const name of requiredEnvironment) {
  assert(readme.includes(name), `README.md must document ${name}.`);
  assert(environmentExample.includes(`${name}=`), `.env.example must document ${name}.`);
}

const exampleEnvironment = [...environmentExample.matchAll(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/gm)]
  .map((match) => match[1]);
for (const name of [
  ...environmentNames(config.env),
  ...environmentNames(config.build?.env),
  ...exampleEnvironment,
]) {
  assert(!name.startsWith("VITE_"), `${name} must not be declared.`);
}

console.log("Deployment configuration is valid.");
