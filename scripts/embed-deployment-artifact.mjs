import { createHash } from "node:crypto";
import { cp, mkdir, readdir, readFile, writeFile, lstat } from "node:fs/promises";
import { dirname, join, resolve, relative, isAbsolute, sep } from "node:path";
import {
  activateEmbedRelease,
  createEmbedChannelLoader,
  verifyEmbedRelease,
  validateReleaseId,
} from "./embed-release-artifact.mjs";
import { normalizePublicBaseUrl, writeEmbedPartnerKit } from "./embed-partner-kit.mjs";
import { verifyEmbedSubmission } from "./embed-submission-config.mjs";

const MANIFEST = "embed-deployment.json";
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

// archive를 다른 OS에서 검증해도 locale별 키 정렬 차이를 파일 변조로 취급하지 않습니다.
function sameHashes(left, right) {
  return (
    Object.keys(left).length === Object.keys(right).length &&
    Object.entries(left).every(([name, hash]) => right[name] === hash)
  );
}

async function fileHashes(root, prefix = "") {
  if ((await lstat(join(root, prefix))).isSymbolicLink())
    throw new Error("deployment_symlink_rejected");
  const result = {};
  for (const entry of await readdir(join(root, prefix), { withFileTypes: true })) {
    const name = [prefix, entry.name].filter(Boolean).join("/");
    if (entry.isSymbolicLink()) throw new Error("deployment_symlink_rejected");
    if (entry.isDirectory()) Object.assign(result, await fileHashes(root, name));
    else if (entry.isFile() && name !== MANIFEST)
      result[name] = digest(await readFile(join(root, name)));
    else if (!entry.isFile()) throw new Error("deployment_special_file_rejected");
  }
  return Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)));
}

async function releaseInventory(root, basePath, options = {}) {
  const inventory = {};
  for (const entry of await readdir(join(root, "embed/releases"), { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.isSymbolicLink())
      throw new Error("invalid_release_directory");
    const directory = join(root, "embed/releases", entry.name);
    const manifest = await verifyEmbedRelease(directory);
    if (manifest.basePath !== basePath) throw new Error("deployment_base_path_mismatch");
    if (
      options.production &&
      (manifest.dirty !== false || !/^[a-f0-9]{40}$/u.test(manifest.sourceSha))
    )
      throw new Error("uncommitted_release_rejected");
    verifyEmbedSubmission(manifest.submission, options);
    inventory[entry.name] = digest(await readFile(join(directory, "manifest.json")));
  }
  return Object.fromEntries(Object.entries(inventory).sort(([a], [b]) => a.localeCompare(b)));
}

function assertPreserved(previous, next) {
  for (const [release, hash] of Object.entries(previous.releases)) {
    if (next.releases[release] !== hash) throw new Error("previous_release_not_preserved");
  }
}

function assertStaticAssetsPreserved(previous, next) {
  for (const [name, hash] of Object.entries(previous.files)) {
    if (name.startsWith("_next/static/") && next.files[name] !== hash)
      throw new Error("previous_static_asset_not_preserved");
  }
}

/** 홈페이지·채널·모든 고정 release의 바이트와 배포 대상 정보를 함께 검증합니다. */
export async function verifyEmbedDeployment(
  directory,
  { production = false, expectedEndpoint } = {},
) {
  const bytes = await readFile(join(directory, MANIFEST));
  const manifest = JSON.parse(bytes.toString("utf8"));
  if (
    !manifest ||
    manifest.schemaVersion !== 1 ||
    typeof manifest.dirty !== "boolean" ||
    typeof manifest.sourceSha !== "string" ||
    !/^(?:local|[1-9]\d*)$/u.test(manifest.runId) ||
    !(manifest.previousDigest === null || /^[a-f0-9]{64}$/u.test(manifest.previousDigest)) ||
    !manifest.releases ||
    !manifest.files ||
    ![
      "index.html",
      "embed/quick-estimate.html",
      "embed/v1/loader.js",
      "embed/partner/demo.html",
    ].every((key) => typeof manifest.files[key] === "string")
  )
    throw new Error("deployment_manifest_invalid");
  validateReleaseId(manifest.activeRelease);
  if (normalizePublicBaseUrl(manifest.publicBaseUrl, manifest.basePath) !== manifest.publicBaseUrl)
    throw new Error("deployment_manifest_invalid");
  if (
    production &&
    (manifest.dirty ||
      !/^[a-f0-9]{40}$/u.test(manifest.sourceSha) ||
      /\.(invalid|example|test)$/u.test(new URL(manifest.publicBaseUrl).hostname))
  )
    throw new Error("local_candidate_not_publishable");
  verifyEmbedSubmission(manifest.submission, { production, expectedEndpoint });
  const releases = await releaseInventory(directory, manifest.basePath, {
    production,
    expectedEndpoint,
  });
  if (
    !releases[manifest.activeRelease] ||
    !sameHashes(releases, manifest.releases) ||
    !sameHashes(await fileHashes(directory), manifest.files) ||
    (await readFile(join(directory, "embed/v1/loader.js"), "utf8")) !==
      createEmbedChannelLoader(manifest.activeRelease)
  )
    throw new Error("deployment_integrity_failed");
  return { manifest, digest: digest(bytes) };
}

/** 읽기 검증을 마친 기존 자원을 포함한 새 배포본만 봉인하며 이전 파일은 변경하지 않습니다. */
export async function sealEmbedDeployment(directory, metadata, previousDirectory) {
  const releases = await releaseInventory(directory, metadata.basePath);
  const previous = previousDirectory ? await verifyEmbedDeployment(previousDirectory) : null;
  if (previous && previous.manifest.publicBaseUrl !== metadata.publicBaseUrl)
    throw new Error("previous_public_url_mismatch");
  const manifest = {
    schemaVersion: 1,
    ...metadata,
    previousDigest: previous?.digest ?? null,
    releases,
    files: await fileHashes(directory),
  };
  if (previous) {
    assertPreserved(previous.manifest, manifest);
    assertStaticAssetsPreserved(previous.manifest, manifest);
  }
  await writeFile(join(directory, MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`);
  return verifyEmbedDeployment(directory);
}

/** 새 출력 폴더가 입력 archive를 포함하거나 그 안에 생기는 복사를 거절합니다. */
export async function createEmptyDeployment(directory, sources = []) {
  const target = resolve(directory);
  for (const source of sources.filter(Boolean).map((value) => resolve(value))) {
    for (const [a, b] of [
      [target, source],
      [source, target],
    ]) {
      const difference = relative(a, b);
      if (
        difference === "" ||
        (difference !== ".." && !difference.startsWith(`..${sep}`) && !isAbsolute(difference))
      )
        throw new Error("artifact_directories_overlap");
    }
  }
  await mkdir(dirname(target), { recursive: true });
  await mkdir(target);
}

/** 고정 release와 열린 홈페이지가 요청할 Next 정적 자원을 보존하고 경로 충돌은 중단합니다. */
export async function preserveEmbedResources(previousDirectory, directory, basePath) {
  const previous = await verifyEmbedDeployment(previousDirectory);
  if (previous.manifest.basePath !== basePath)
    throw new Error("previous_release_base_path_mismatch");
  for (const release of Object.keys(previous.manifest.releases)) {
    const destination = join(directory, "embed/releases", release);
    try {
      const hash = digest(await readFile(join(destination, "manifest.json")));
      if (hash !== previous.manifest.releases[release])
        throw new Error("immutable_release_conflict");
      await verifyEmbedRelease(destination);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      await cp(join(previousDirectory, "embed/releases", release), destination, {
        recursive: true,
        force: false,
        errorOnExist: true,
      });
    }
  }
  for (const [name, hash] of Object.entries(previous.manifest.files)) {
    if (!name.startsWith("_next/static/")) continue;
    const destination = join(directory, name);
    try {
      if (digest(await readFile(destination)) !== hash)
        throw new Error("immutable_static_asset_conflict");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      await mkdir(dirname(destination), { recursive: true });
      await cp(join(previousDirectory, name), destination, { force: false, errorOnExist: true });
    }
  }
  return previous;
}

/** 홈페이지는 검증된 과거 배포본으로 복구하되 현재 제공 중인 고정 버전은 모두 남깁니다. */
export async function prepareEmbedRollback({
  currentDirectory,
  targetDirectory,
  artifactDirectory,
  runId = "local",
}) {
  const current = await verifyEmbedDeployment(currentDirectory);
  const target = await verifyEmbedDeployment(targetDirectory);
  if (current.manifest.publicBaseUrl !== target.manifest.publicBaseUrl)
    throw new Error("rollback_public_url_mismatch");
  // 다른 이력의 archive를 섞어 새 release를 복원하는 작업은 rollback으로 취급하지 않습니다.
  assertPreserved(target.manifest, current.manifest);
  await createEmptyDeployment(artifactDirectory, [currentDirectory, targetDirectory]);
  await cp(targetDirectory, artifactDirectory, { recursive: true });
  await preserveEmbedResources(currentDirectory, artifactDirectory, target.manifest.basePath);
  await activateEmbedRelease(artifactDirectory, target.manifest.activeRelease);
  await writeEmbedPartnerKit(artifactDirectory, target.manifest);
  return sealEmbedDeployment(
    artifactDirectory,
    {
      basePath: target.manifest.basePath,
      publicBaseUrl: target.manifest.publicBaseUrl,
      activeRelease: target.manifest.activeRelease,
      sourceSha: target.manifest.sourceSha,
      dirty: target.manifest.dirty,
      submission: target.manifest.submission,
      runId,
    },
    currentDirectory,
  );
}

/** 공개본이 예상 직전 배포와 같은지 GET만으로 확인해 오래된 archive의 배포를 막습니다. */
export async function assertPublishedDeployment({
  publicBaseUrl,
  expectedDigest,
  fetcher = fetch,
}) {
  const response = await fetcher(`${publicBaseUrl}/embed-deployment.json?verify=${Date.now()}`, {
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  });
  if (expectedDigest === null && response.status === 404) return;
  if (
    !response.ok ||
    expectedDigest === null ||
    digest(new Uint8Array(await response.arrayBuffer())) !== expectedDigest
  )
    throw new Error("published_deployment_mismatch");
}
