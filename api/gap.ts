import { calculateGap, type GapDependencies } from "./_lib/gap-service.js";
import { createQwenEmbeddingClient } from "./_lib/qwen-client.js";
import { createSupabaseAdmin } from "./_lib/supabase-admin.js";

function requiredEnvironment(name: string, environment: NodeJS.ProcessEnv) {
  const value = environment[name];
  if (!value) throw new Error(`Missing server environment variable: ${name}`);
  return value;
}

function dependencies(environment: NodeJS.ProcessEnv): GapDependencies {
  const admin = createSupabaseAdmin({
    url: requiredEnvironment("SUPABASE_URL", environment),
    serviceRoleKey: requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY", environment),
  });
  return {
    findAnalysis: admin.findAnalysis,
    embedTexts: createQwenEmbeddingClient({
      apiKey: requiredEnvironment("DASHSCOPE_API_KEY", environment),
      baseUrl: environment.DASHSCOPE_BASE_URL,
      model: environment.DASHSCOPE_EMBEDDING_MODEL,
    }),
    saveGap: admin.saveGap,
  };
}

export default {
  async fetch(request: Request, environment: NodeJS.ProcessEnv = process.env) {
    let serviceDependencies: GapDependencies;
    try {
      serviceDependencies = dependencies(environment);
    } catch {
      return Response.json({
        code: "SERVER_NOT_CONFIGURED",
        message: "语义距离服务尚未完成配置。",
        retryable: false,
      }, { status: 503, headers: { "cache-control": "no-store" } });
    }
    try {
      return await calculateGap(request, serviceDependencies);
    } catch {
      return Response.json({
        code: "GAP_UNAVAILABLE",
        message: "语义距离服务暂时不可用，请稍后重试。",
        retryable: true,
      }, { status: 500, headers: { "cache-control": "no-store" } });
    }
  },
};
