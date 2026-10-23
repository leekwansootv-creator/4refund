import { spawnSync, execFileSync } from "node:child_process";
import { cp, access } from "node:fs/promises";
import { resolve, join } from "node:path";
import { buildEmbedLoader } from "./build-embed-loader.mjs";
import {
  activateEmbedRelease,
  packageEmbedRelease,
  validateReleaseId,
  createEmbedBuildEnvironment,
} from "./embed-release-artifact.mjs";
import {
  createEmptyDeployment,
  preserveEmbedResources,
  sealEmbedDeployment,
  verifyEmbedDeployment,
  prepareEmbedRollback,
} from "./embed-deployment-artifact.mjs";
import { normalizePublicBaseUrl, writeEmbedPartnerKit } from "./embed-partner-kit.mjs";
import { describeEmbedSubmission } from "./embed-submission-config.mjs";

const release = validateReleaseId(process.env.EMBED_RELEASE ?? "1.0.0");
const basePath = process.env.PAGES_BASE_PATH ?? "";
if (!/^(?:\/[a-zA-Z0-9_-]+)*$/u.test(basePath)) throw new Error("invalid_base_path");
const artifact = resolve(process.env.EMBED_ARTIFACT_DIRECTORY ?? ".embed-artifacts/candidate");
const previous = process.env.EMBED_PREVIOUS_ARTIFACT;
if (process.argv.includes("--verify")) {
  const result = await verifyEmbedDeployment(artifact, {
    production: process.argv.includes("--production"),
    expectedEndpoint: process.argv.includes("--production")
      ? (process.env.NEXT_PUBLIC_QUICK_ESTIMATE_APPS_SCRIPT_URL ?? "")
      : undefined,
  });
  console.log(`Verified deployment SHA-256: ${result.digest}`);
} else if (process.argv.includes("--rollback")) {
  if (!previous || !process.env.EMBED_ROLLBACK_ARTIFACT)
    throw new Error("rollback_archives_required");
  await prepareEmbedRollback({
    currentDirectory: previous,
    targetDirectory: process.env.EMBED_ROLLBACK_ARTIFACT,
    artifactDirectory: artifact,
    runId: process.env.GITHUB_RUN_ID ?? "local",
  });
} else if (process.argv.includes("--activate")) {
  try {
    await access(join(artifact, "embed-deployment.json"));
    throw new Error("sealed_artifact_requires_rollback");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  await activateEmbedRelease(artifact, process.env.EMBED_ACTIVATE_RELEASE ?? release);
} else {
  const publicBaseUrl = normalizePublicBaseUrl(
    process.env.EMBED_PUBLIC_BASE_URL ?? `https://widget.example.invalid${basePath}`,
    basePath,
  );
  if (previous) await verifyEmbedDeployment(previous);
  await createEmptyDeployment(artifact, [previous, "out", "public"]);
  await buildEmbedLoader("public/embed/v1", "../quick-estimate.html", release);
  const runBuild = (prefix) => {
    const result = spawnSync(process.execPath, ["node_modules/next/dist/bin/next", "build"], {
      stdio: "inherit",
      env: createEmbedBuildEnvironment(
        {
          ...process.env,
          NEXT_PUBLIC_SITE_ORIGIN:
            process.env.NEXT_PUBLIC_SITE_ORIGIN ?? new URL(publicBaseUrl).origin,
        },
        basePath,
        release,
        prefix,
      ),
    });
    if (result.error || result.status !== 0) throw result.error ?? new Error("embed_build_failed");
  };
  runBuild(basePath);
  await cp("out", artifact, { recursive: true });
  if (previous) {
    await preserveEmbedResources(previous, artifact, basePath);
  }
  runBuild(`${basePath}/embed/releases/${release}`);
  const sourceSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const dirty =
    execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim().length > 0;
  await packageEmbedRelease({
    exportedDirectory: "out",
    artifactDirectory: artifact,
    release,
    basePath,
    sourceSha,
    dirty,
    endpoint: process.env.NEXT_PUBLIC_QUICK_ESTIMATE_APPS_SCRIPT_URL,
  });
  await activateEmbedRelease(artifact, release);
  await writeEmbedPartnerKit(artifact, { publicBaseUrl, basePath, activeRelease: release });
  await sealEmbedDeployment(
    artifact,
    {
      publicBaseUrl,
      basePath,
      activeRelease: release,
      sourceSha,
      dirty,
      submission: describeEmbedSubmission(process.env.NEXT_PUBLIC_QUICK_ESTIMATE_APPS_SCRIPT_URL),
      runId: process.env.GITHUB_RUN_ID ?? "local",
    },
    previous,
  );
}
console.log(`Local embed artifact prepared: ${artifact}`);
