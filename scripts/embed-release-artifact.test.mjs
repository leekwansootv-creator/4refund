import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  packageEmbedRelease,
  activateEmbedRelease,
  verifyEmbedRelease,
  createEmbedBuildEnvironment,
} from "./embed-release-artifact.mjs";

test("release 경로·불변 자원·이전 버전 활성화·손상 실패를 검증한다", async () => {
  const root = await mkdtemp(join(tmpdir(), "4refund-embed-release-test-"));
  const exported = join(root, "export");
  const artifact = join(root, "artifact");
  await mkdir(join(exported, "embed"), { recursive: true });
  await mkdir(join(exported, "_next/static"), { recursive: true });
  await writeFile(join(exported, "_next/static/example.js"), "/* local fixture */");
  for (const release of ["1.0.0", "1.0.1"]) {
    await writeFile(
      join(exported, "embed/quick-estimate.html"),
      `<script src="/project/embed/releases/${release}/_next/static/example.js"></script>`,
    );
    await packageEmbedRelease({
      exportedDirectory: exported,
      artifactDirectory: artifact,
      release,
      basePath: "/project",
      sourceSha: "local-test",
      dirty: true,
    });
  }
  await activateEmbedRelease(artifact, "1.0.1");
  await activateEmbedRelease(artifact, "1.0.0");
  assert.match(await readFile(join(artifact, "embed/v1/loader.js"), "utf8"), /releases\/1\.0\.0/u);
  await verifyEmbedRelease(join(artifact, "embed/releases/1.0.1"));
  const manifestPath = join(artifact, "embed/releases/1.0.1/manifest.json");
  const originalManifest = await readFile(manifestPath, "utf8");
  const manifest = JSON.parse(originalManifest);
  for (const invalid of [
    { ...manifest, page: "/embed/quick-estimate.html" },
    { ...manifest, release: "1.0.2" },
    { ...manifest, basePath: "/project/../other" },
    { ...manifest, minimumAppsScript: undefined },
  ]) {
    await writeFile(manifestPath, JSON.stringify(invalid));
    await assert.rejects(
      verifyEmbedRelease(join(artifact, "embed/releases/1.0.1")),
      /release_manifest_invalid/u,
    );
  }
  await writeFile(manifestPath, originalManifest);
  await assert.rejects(
    packageEmbedRelease({
      exportedDirectory: exported,
      artifactDirectory: artifact,
      release: "1.0.0",
      basePath: "/project",
    }),
    /immutable_release_already_exists/u,
  );
  await writeFile(join(artifact, "embed/releases/1.0.1/loader.js"), "corrupt");
  await assert.rejects(activateEmbedRelease(artifact, "1.0.1"), /release_integrity_failed/u);
  await assert.rejects(activateEmbedRelease(artifact, "../escape"), /invalid_release_id/u);
});

test("별도 공식 홈페이지 문의 경로를 위젯 release prefix로 덮어쓰지 않는다", () => {
  for (const sitePath of ["", "/official"]) {
    const env = createEmbedBuildEnvironment(
      { NEXT_PUBLIC_SITE_ORIGIN: "https://official.example", NEXT_PUBLIC_SITE_BASE_PATH: sitePath },
      "/widgets",
      "1.0.1",
      "/widgets/embed/releases/1.0.1",
    );
    assert.equal(env.NEXT_PUBLIC_SITE_ORIGIN, "https://official.example");
    assert.equal(env.NEXT_PUBLIC_SITE_BASE_PATH, sitePath);
    assert.equal(env.PAGES_BASE_PATH, "/widgets/embed/releases/1.0.1");
  }
  assert.equal(
    createEmbedBuildEnvironment({}, "/same-site", "1.0.1", "/same-site/embed/releases/1.0.1")
      .NEXT_PUBLIC_SITE_BASE_PATH,
    "/same-site",
  );
  assert.equal(
    createEmbedBuildEnvironment({}, "", "1.0.0", "").NEXT_PUBLIC_QUICK_ESTIMATE_APPS_SCRIPT_URL,
    "",
  );
  assert.equal(
    createEmbedBuildEnvironment(
      {
        NEXT_PUBLIC_QUICK_ESTIMATE_APPS_SCRIPT_URL:
          "  https://script.google.com/macros/s/EXPLICIT/exec  ",
      },
      "",
      "1.0.0",
      "",
    ).NEXT_PUBLIC_QUICK_ESTIMATE_APPS_SCRIPT_URL,
    "https://script.google.com/macros/s/EXPLICIT/exec",
  );
});
