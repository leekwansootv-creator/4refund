import { verifyEmbedDeployment, assertPublishedDeployment } from "./embed-deployment-artifact.mjs";
import { normalizePublicBaseUrl } from "./embed-partner-kit.mjs";

// 네트워크 GET은 이 명시적 CLI에서만 수행합니다. 일반 빌드·단위 테스트는 호출하지 않습니다.
const url = normalizePublicBaseUrl(
  process.env.EMBED_PUBLIC_BASE_URL,
  process.env.PAGES_BASE_PATH ?? "",
);
const candidate = process.env.EMBED_ARTIFACT_DIRECTORY;
const previous = process.env.EMBED_PREVIOUS_ARTIFACT;
const verification = {
  production: true,
  expectedEndpoint: process.env.NEXT_PUBLIC_QUICK_ESTIMATE_APPS_SCRIPT_URL ?? "",
};
let expectedDigest = null;
if (candidate) {
  const result = await verifyEmbedDeployment(candidate, verification);
  if (result.manifest.publicBaseUrl !== url) throw new Error("public_url_mismatch");
  expectedDigest = process.argv.includes("--after")
    ? result.digest
    : result.manifest.previousDigest;
} else if (previous) {
  const result = await verifyEmbedDeployment(previous, verification);
  if (result.manifest.publicBaseUrl !== url) throw new Error("public_url_mismatch");
  expectedDigest = result.digest;
}
if (expectedDigest === null && process.env.EMBED_FIRST_RELEASE !== "1")
  throw new Error("explicit_first_release_required");
await assertPublishedDeployment({ publicBaseUrl: url, expectedDigest });
console.log("Published deployment identity verified (GET only).");
