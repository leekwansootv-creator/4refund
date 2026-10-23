import { resolve } from "node:path";
import { validateReleaseId } from "./embed-release-artifact.mjs";
import { describeEmbedSubmission } from "./embed-submission-config.mjs";

/** 사람이 확인한 운영 준비 기록과 입력 형식을 요구하며 Google 준비 상태를 추정하지 않습니다. */
export function validateEmbedReleaseInputs(environment) {
  if (environment.EMBED_SERVER_READY !== "attribution-v2-verified")
    throw new Error("compatible_server_not_confirmed");
  if (!/^\S.{2,198}\S$/u.test(environment.EMBED_OPERATIONS_RECORD ?? ""))
    throw new Error("operations_record_required");
  const previous = environment.EMBED_PREVIOUS_RUN ?? "";
  const rollback = environment.EMBED_ROLLBACK_RUN ?? "";
  if (
    !(previous === "first" || /^[1-9]\d*$/u.test(previous)) ||
    (rollback !== "" && (!/^[1-9]\d*$/u.test(rollback) || previous === "first"))
  )
    throw new Error("invalid_archive_run");
  if (!rollback) validateReleaseId(environment.EMBED_RELEASE ?? "");
  const endpoint = environment.NEXT_PUBLIC_QUICK_ESTIMATE_APPS_SCRIPT_URL ?? "";
  if (describeEmbedSubmission(endpoint).mode !== "enabled")
    throw new Error("production_endpoint_required");
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve("scripts/check-embed-release-inputs.mjs")
) {
  validateEmbedReleaseInputs(process.env);
  console.log(
    "Release prerequisites supplied; actual Google evidence must be reviewed separately.",
  );
}
