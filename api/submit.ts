import { randomUUID } from "node:crypto";

import { createSupabaseAdmin } from "./_lib/supabase-admin.js";
import { submitArchive, type SubmitDependencies } from "./_lib/submit-service.js";

function requiredEnvironment(name: string, environment: NodeJS.ProcessEnv) {
  const value = environment[name];
  if (!value) throw new Error(`Missing server environment variable: ${name}`);
  return value;
}

function dependencies(environment: NodeJS.ProcessEnv): SubmitDependencies {
  const admin = createSupabaseAdmin({
    url: requiredEnvironment("SUPABASE_URL", environment),
    serviceRoleKey: requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY", environment),
  });
  return {
    now: () => new Date(),
    createAttemptId: randomUUID,
    findAnalysis: admin.findSubmissionAnalysis,
    uploadPrivateObject: admin.uploadPrivateObject,
    removePrivateObjects: admin.removePrivateObjects,
    findArchiveByToken: admin.findArchiveByToken,
    createPendingArchive: admin.createPendingArchive,
  };
}

export default {
  async fetch(request: Request, environment: NodeJS.ProcessEnv = process.env) {
    let serviceDependencies: SubmitDependencies;
    try {
      serviceDependencies = dependencies(environment);
    } catch {
      return Response.json({
        code: "SERVER_NOT_CONFIGURED",
        message: "投稿服务尚未完成配置。",
        retryable: false,
      }, { status: 503, headers: { "cache-control": "no-store" } });
    }
    try {
      return await submitArchive(request, serviceDependencies);
    } catch {
      return Response.json({
        code: "SUBMISSION_UNAVAILABLE",
        message: "投稿服务暂时不可用，请稍后重试。",
        retryable: true,
      }, { status: 500, headers: { "cache-control": "no-store" } });
    }
  },
};
