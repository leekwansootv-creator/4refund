import { createHash } from "node:crypto";
import { cp, mkdir, readdir, readFile, writeFile, access } from "node:fs/promises";
import { resolve, join, basename } from "node:path";
import { buildEmbedLoader } from "./build-embed-loader.mjs";
import { describeEmbedSubmission, verifyEmbedSubmission } from "./embed-submission-config.mjs";

/** 상대 경로를 포함할 수 없는 명시적 release ID만 자원 경로에 사용합니다. */
export function validateReleaseId(value) {
  if (!/^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/u.test(value)) throw new Error("invalid_release_id");
  return value;
}

/** 위젯 자원 prefix와 별도 공식 홈페이지의 문의 경로 설정을 구분합니다. */
export function createEmbedBuildEnvironment(environment, basePath, release, prefix) {
  return {
    ...environment,
    PAGES_BASE_PATH: prefix,
    NEXT_PUBLIC_SITE_BASE_PATH: environment.NEXT_PUBLIC_SITE_BASE_PATH ?? basePath,
    NEXT_PUBLIC_EMBED_RELEASE: release,
    // .env.local에 남은 운영 주소가 로컬 조회 전용 후보에 암묵적으로 포함되지 않게 합니다.
    NEXT_PUBLIC_QUICK_ESTIMATE_APPS_SCRIPT_URL:
      environment.NEXT_PUBLIC_QUICK_ESTIMATE_APPS_SCRIPT_URL?.trim() ?? "",
  };
}

async function hashes(root, relative = "") {
  const result = {};
  for (const entry of await readdir(join(root, relative), { withFileTypes: true })) {
    const path = [relative, entry.name].filter(Boolean).join("/");
    if (entry.isSymbolicLink()) throw new Error("release_symlink_rejected");
    if (entry.isDirectory()) Object.assign(result, await hashes(root, path));
    else if (path !== "manifest.json")
      result[path] = createHash("sha256")
        .update(await readFile(join(root, path)))
        .digest("hex");
  }
  return Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)));
}

/** manifest와 모든 자원 해시를 대조하며 손상된 release 활성화를 막습니다. */
export async function verifyEmbedRelease(releaseDirectory) {
  const manifest = JSON.parse(await readFile(join(releaseDirectory, "manifest.json"), "utf8"));
  if (
    !manifest ||
    typeof manifest !== "object" ||
    manifest.release !== basename(resolve(releaseDirectory)) ||
    typeof manifest.basePath !== "string" ||
    !/^(?:\/[a-zA-Z0-9_-]+)*$/u.test(manifest.basePath) ||
    manifest.page !==
      `${manifest.basePath}/embed/releases/${manifest.release}/embed/quick-estimate.html` ||
    manifest.submissionVersion !== 2 ||
    manifest.minimumAppsScript !== "attribution-v2-compatible" ||
    manifest.privacyNoticeVersion !== "privacy-2026-10-23-v2" ||
    manifest.ruleVersion !== "estimate-rule-2026-08-25" ||
    !manifest.assets ||
    ["loader.js", "shell.css", "embed/quick-estimate.html"].some(
      (path) => typeof manifest.assets[path] !== "string",
    )
  )
    throw new Error("release_manifest_invalid");
  validateReleaseId(manifest.release);
  verifyEmbedSubmission(manifest.submission);
  const actualAssets = await hashes(releaseDirectory);
  if (
    manifest.protocol !== "fourrefund-embed-v1" ||
    Object.keys(actualAssets).length !== Object.keys(manifest.assets).length ||
    Object.entries(actualAssets).some(([path, hash]) => manifest.assets[path] !== hash)
  )
    throw new Error("release_integrity_failed");
  return manifest;
}

/** 이미 존재하는 release를 덮어쓰지 않고 자체 basePath로 빌드된 정적 자원을 보관합니다. */
export async function packageEmbedRelease({
  exportedDirectory,
  artifactDirectory,
  release,
  basePath,
  sourceSha,
  dirty,
  endpoint = "",
}) {
  validateReleaseId(release);
  const target = resolve(artifactDirectory, "embed/releases", release);
  try {
    await access(target);
    throw new Error("immutable_release_already_exists");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const html = await readFile(join(exportedDirectory, "embed/quick-estimate.html"), "utf8");
  const prefix = `${basePath}/embed/releases/${release}`;
  if (!html.includes(`${prefix}/_next/`)) throw new Error("release_base_path_mismatch");
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/gu)) {
    const url = match[1].replaceAll("&amp;", "&");
    if (url.startsWith(`${prefix}/`)) {
      const relative = url.slice(prefix.length + 1).split(/[?#]/u)[0];
      if (relative.includes("..")) throw new Error("release_asset_path_invalid");
      await access(join(exportedDirectory, relative));
    }
  }
  await mkdir(target, { recursive: true });
  await cp(exportedDirectory, target, { recursive: true });
  await buildEmbedLoader(target, "./embed/quick-estimate.html", release);
  const manifest = {
    release,
    protocol: "fourrefund-embed-v1",
    submissionVersion: 2,
    minimumAppsScript: "attribution-v2-compatible",
    privacyNoticeVersion: "privacy-2026-10-23-v2",
    ruleVersion: "estimate-rule-2026-08-25",
    sourceSha,
    dirty,
    submission: describeEmbedSubmission(endpoint),
    basePath,
    page: `${prefix}/embed/quick-estimate.html`,
    assets: await hashes(target),
  };
  await writeFile(join(target, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await verifyEmbedRelease(target);
  return manifest;
}

/** 기본 채널만 검증된 release로 전환하며 이전 release 자원은 삭제하지 않습니다. */
export async function activateEmbedRelease(artifactDirectory, release) {
  validateReleaseId(release);
  const manifest = await verifyEmbedRelease(resolve(artifactDirectory, "embed/releases", release));
  if (manifest.release !== release) throw new Error("release_identity_mismatch");
  const target = resolve(artifactDirectory, "embed/v1");
  await mkdir(target, { recursive: true });
  await writeFile(join(target, "loader.js"), createEmbedChannelLoader(release));
}

/** 채널의 실제 대상도 배포 manifest와 대조할 수 있도록 동일한 loader를 생성합니다. */
export function createEmbedChannelLoader(release) {
  validateReleaseId(release);
  return `(()=>{const s=document.currentScript;if(!s)return;const n=document.createElement("script");n.src=new URL("../releases/${release}/loader.js",s.src).href;n.async=true;n.dataset.target=s.dataset.target||"";document.head.append(n);})();\n`;
}
