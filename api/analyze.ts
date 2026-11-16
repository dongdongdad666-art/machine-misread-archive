import { createHash } from "node:crypto";

import { analyzeImage, type AnalyzeDependencies } from "./_lib/analyze-service.js";
import { createQwenClient } from "./_lib/qwen-client.js";
import { createSupabaseAdmin } from "./_lib/supabase-admin.js";

function requiredEnvironment(name: string, environment: NodeJS.ProcessEnv) {
  const value = environment[name];
  if (!value) throw new Error(`Missing server environment variable: ${name}`);
  return value;
}

function dependencies(environment: NodeJS.ProcessEnv): AnalyzeDependencies {
  const admin = createSupabaseAdmin({
    url: requiredEnvironment("SUPABASE_URL", environment),
    serviceRoleKey: requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY", environment),
  });
  const salt = requiredEnvironment("QUOTA_SALT", environment);

  return {
    now: () => new Date(),
    hashVisitor: async (identifier) => createHash("sha256").update(`${salt}:${identifier}`).digest("hex"),
    incrementQuota: admin.incrementQuota,
    analyzeWithModel: createQwenClient({
      apiKey: requiredEnvironment("DASHSCOPE_API_KEY", environment),
      baseUrl: environment.DASHSCOPE_BASE_URL,
      model: environment.DASHSCOPE_VISION_MODEL,
      modelSnapshot: environment.DASHSCOPE_MODEL_SNAPSHOT,
    }),
    saveRun: admin.saveRun,
  };
}

export default {
  async fetch(request: Request, environment: NodeJS.ProcessEnv = process.env) {
    try {
      return await analyzeImage(request, dependencies(environment));
    } catch {
      return Response.json({
        code: "SERVER_NOT_CONFIGURED",
        message: "实时分析服务尚未完成配置。你仍可使用种子档案体验。",
        retryable: false,
      }, { status: 503, headers: { "cache-control": "no-store" } });
    }
  },
};
