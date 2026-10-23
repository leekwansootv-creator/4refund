import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, cp, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { packageEmbedRelease, activateEmbedRelease } from "./embed-release-artifact.mjs";
import { normalizePublicBaseUrl, writeEmbedPartnerKit } from "./embed-partner-kit.mjs";
import { validateEmbedReleaseInputs } from "./check-embed-release-inputs.mjs";
import { describeEmbedSubmission } from "./embed-submission-config.mjs";
import {
  createEmptyDeployment,
  preserveEmbedResources,
  sealEmbedDeployment,
  verifyEmbedDeployment,
  prepareEmbedRollback,
  assertPublishedDeployment,
} from "./embed-deployment-artifact.mjs";

const basePath = "/project";
const publicBaseUrl = "https://widget.company.org/project";
const sourceSha = "a".repeat(40);
async function root() {
  return mkdtemp(join(tmpdir(), "4refund-deployment-test-"));
}
const endpoint = "https://script.google.com/macros/s/TEST-SYNTAX-ONLY/exec";
async function candidate(parent, release, previous, dirty = false, submissionEndpoint = endpoint) {
  const directory = join(parent, release);
  await createEmptyDeployment(directory, [previous]);
  const exported = join(parent, `export-${release}`);
  await mkdir(join(exported, "embed"), { recursive: true });
  await mkdir(join(exported, "_next/static"), { recursive: true });
  await writeFile(join(exported, "index.html"), `<h1>Homepage ${release}</h1>`);
  await writeFile(join(exported, "_next/static/test.js"), "/* local fixture */");
  await writeFile(join(exported, `_next/static/${release}.js`), `/* ${release} */`);
  await writeFile(
    join(exported, "embed/quick-estimate.html"),
    `<script src="/project/embed/releases/${release}/_next/static/test.js"></script>`,
  );
  await cp(exported, directory, { recursive: true });
  if (previous) await preserveEmbedResources(previous, directory, basePath);
  await packageEmbedRelease({
    exportedDirectory: exported,
    artifactDirectory: directory,
    release,
    basePath,
    sourceSha,
    dirty,
    endpoint: submissionEndpoint,
  });
  await activateEmbedRelease(directory, release);
  await writeEmbedPartnerKit(directory, { publicBaseUrl, basePath, activeRelease: release });
  await sealEmbedDeployment(
    directory,
    {
      publicBaseUrl,
      basePath,
      activeRelease: release,
      sourceSha,
      dirty,
      runId: "local",
      submission: describeEmbedSubmission(submissionEndpoint),
    },
    previous,
  );
  return directory;
}

test("업데이트와 전체 홈페이지 rollback은 현재 제공한 고정 버전을 모두 보존한다", async () => {
  const parent = await root();
  const first = await candidate(parent, "1.0.0");
  const firstBytes = await readFile(join(first, "embed-deployment.json"));
  const second = await candidate(parent, "1.0.1", first);
  const before = await verifyEmbedDeployment(second, { production: true });
  const output = join(parent, "rollback");
  const result = await prepareEmbedRollback({
    currentDirectory: second,
    targetDirectory: first,
    artifactDirectory: output,
  });
  assert.equal(await readFile(join(output, "index.html"), "utf8"), "<h1>Homepage 1.0.0</h1>");
  assert.equal(result.manifest.activeRelease, "1.0.0");
  assert.equal(result.manifest.previousDigest, before.digest);
  assert.deepEqual(result.manifest.releases, before.manifest.releases);
  for (const directory of [second, output]) {
    for (const release of ["1.0.0", "1.0.1"]) {
      assert.equal(
        await readFile(join(directory, `_next/static/${release}.js`), "utf8"),
        `/* ${release} */`,
      );
    }
  }
  assert.deepEqual(await readFile(join(first, "embed-deployment.json")), firstBytes);
  assert.equal((await verifyEmbedDeployment(second)).digest, before.digest);
  await verifyEmbedDeployment(output, { production: true });
  const third = await candidate(parent, "1.0.2", output);
  assert.deepEqual(Object.keys((await verifyEmbedDeployment(third)).manifest.releases), [
    "1.0.0",
    "1.0.1",
    "1.0.2",
  ]);
});

test("손상된 홈페이지·채널·고정 버전은 다음 배포와 rollback에 사용할 수 없다", async () => {
  const parent = await root();
  const first = await candidate(parent, "1.0.0");
  for (const name of ["index.html", "embed/v1/loader.js", "embed/releases/1.0.0/loader.js"]) {
    const path = join(first, name);
    const bytes = await readFile(path);
    await writeFile(path, "corrupted");
    await assert.rejects(verifyEmbedDeployment(first), /integrity_failed/u);
    await assert.rejects(
      prepareEmbedRollback({
        currentDirectory: first,
        targetDirectory: first,
        artifactDirectory: join(parent, "bad-output"),
      }),
      /integrity_failed/u,
    );
    await writeFile(path, bytes);
  }
  await verifyEmbedDeployment(first);
});

test("이전 버전 누락·다른 공개 주소·중복 출력·입력 안의 출력은 거절한다", async () => {
  const parent = await root();
  const first = await candidate(parent, "1.0.0");
  const unrelated = await candidate(parent, "2.0.0");
  const metadata = (await verifyEmbedDeployment(unrelated)).manifest;
  await assert.rejects(
    sealEmbedDeployment(unrelated, metadata, first),
    /previous_release_not_preserved/u,
  );
  await assert.rejects(
    sealEmbedDeployment(
      unrelated,
      { ...metadata, publicBaseUrl: "https://other.company.org/project" },
      first,
    ),
    /previous_public_url_mismatch/u,
  );
  await assert.rejects(createEmptyDeployment(first), /EEXIST/u);
  await assert.rejects(
    createEmptyDeployment(join(first, "nested"), [first]),
    /artifact_directories_overlap/u,
  );
  await assert.rejects(createEmptyDeployment(parent, [first]), /artifact_directories_overlap/u);
  await assert.rejects(
    createEmptyDeployment(join(first, "..nested"), [first]),
    /artifact_directories_overlap/u,
  );
  await assert.rejects(
    preserveEmbedResources(first, join(parent, "other"), "/other"),
    /base_path_mismatch/u,
  );
  await assert.rejects(
    prepareEmbedRollback({
      currentDirectory: first,
      targetDirectory: unrelated,
      artifactDirectory: join(parent, "bad"),
    }),
    /previous_release_not_preserved/u,
  );
});

test("접수 불가·테스트 endpoint 또는 승인 주소와 다른 archive는 공개할 수 없다", async () => {
  const parent = await root();
  const first = await candidate(parent, "1.0.0");
  await verifyEmbedDeployment(first, { production: true, expectedEndpoint: endpoint });
  await assert.rejects(
    verifyEmbedDeployment(first, {
      production: true,
      expectedEndpoint: endpoint.replace("TEST-SYNTAX-ONLY", "OTHER"),
    }),
    /submission_endpoint_mismatch/u,
  );
  for (const [release, value] of [
    ["1.0.1", ""],
    ["1.0.2", "https://script.google.com/macros/s/E2E-INTERCEPT-ONLY/exec"],
  ]) {
    const directory = await candidate(parent, release, undefined, false, value);
    await verifyEmbedDeployment(directory);
    await assert.rejects(
      verifyEmbedDeployment(directory, { production: true }),
      /submission_not_publishable/u,
    );
  }
  const second = await candidate(
    parent,
    "1.0.3",
    first,
    false,
    endpoint.replace("TEST-SYNTAX-ONLY", "OTHER"),
  );
  // 현재 홈페이지만 정상이어도 보존한 pinned 버전이 다른 주소를 사용하면 실패해야 합니다.
  await assert.rejects(
    verifyEmbedDeployment(second, {
      production: true,
      expectedEndpoint: endpoint.replace("TEST-SYNTAX-ONLY", "OTHER"),
    }),
    /submission_endpoint_mismatch/u,
  );
  const restored = await prepareEmbedRollback({
    currentDirectory: second,
    targetDirectory: first,
    artifactDirectory: join(parent, "rollback"),
  });
  assert.deepEqual(restored.manifest.submission, describeEmbedSubmission(endpoint));
  await assert.rejects(
    verifyEmbedDeployment(join(parent, "rollback"), {
      production: true,
      expectedEndpoint: endpoint.replace("TEST-SYNTAX-ONLY", "OTHER"),
    }),
    /submission_endpoint_mismatch/u,
  );
});

test("홈페이지 정적 자원 누락과 동일 경로의 바이트 변경은 재봉인으로 우회할 수 없다", async () => {
  const parent = await root();
  const first = await candidate(parent, "1.0.0");
  const second = await candidate(parent, "1.0.1", first);
  const metadata = (await verifyEmbedDeployment(second)).manifest;
  await unlink(join(second, "_next/static/1.0.0.js"));
  await assert.rejects(
    sealEmbedDeployment(second, metadata, first),
    /previous_static_asset_not_preserved/u,
  );
  await writeFile(join(second, "_next/static/test.js"), "different bytes at same path");
  await assert.rejects(
    preserveEmbedResources(first, second, basePath),
    /immutable_static_asset_conflict/u,
  );
});

test("접수 설정 증거가 없는 이전 로컬 archive는 공개용으로 승격하지 않는다", async () => {
  const parent = await root();
  const first = await candidate(parent, "1.0.0");
  const file = join(first, "embed-deployment.json");
  const manifest = JSON.parse(await readFile(file, "utf8"));
  delete manifest.submission;
  await writeFile(file, JSON.stringify(manifest));
  await verifyEmbedDeployment(first);
  await assert.rejects(
    verifyEmbedDeployment(first, { production: true }),
    /submission_not_publishable/u,
  );
});

test("배포 manifest의 활성 버전과 실제 채널이 다르면 해시를 다시 써도 거절한다", async () => {
  const parent = await root();
  const first = await candidate(parent, "1.0.0");
  const second = await candidate(parent, "1.0.1", first);
  const metadata = (await verifyEmbedDeployment(second)).manifest;
  await activateEmbedRelease(second, "1.0.0");
  await assert.rejects(
    sealEmbedDeployment(second, metadata, first),
    /deployment_integrity_failed/u,
  );
});

test("미커밋 로컬 후보는 검증할 수 있지만 운영 배포 후보로는 거절한다", async () => {
  const parent = await root();
  const first = await candidate(parent, "1.0.0", undefined, true);
  await verifyEmbedDeployment(first);
  await assert.rejects(
    verifyEmbedDeployment(first, { production: true }),
    /local_candidate_not_publishable/u,
  );
});

test("archive 파일 목록은 JSON 키 정렬과 무관하게 경로와 해시로 검증한다", async () => {
  const parent = await root();
  const first = await candidate(parent, "1.0.0");
  const file = join(first, "embed-deployment.json");
  const manifest = JSON.parse(await readFile(file, "utf8"));
  manifest.files = Object.fromEntries(Object.entries(manifest.files).reverse());
  await writeFile(file, JSON.stringify(manifest));
  await verifyEmbedDeployment(first);
});

test("공개본 GET 대조는 오래된 archive·404·5xx·응답 변형을 안전하게 구분한다", async () => {
  const parent = await root();
  const first = await candidate(parent, "1.0.0");
  const verified = await verifyEmbedDeployment(first);
  const bytes = await readFile(join(first, "embed-deployment.json"));
  const fetcher = async (url, options) => {
    assert.ok(url.startsWith(`${publicBaseUrl}/embed-deployment.json?`));
    assert.equal(options.method, undefined);
    assert.equal(options.redirect, "error");
    return new Response(bytes);
  };
  await assertPublishedDeployment({ publicBaseUrl, expectedDigest: verified.digest, fetcher });
  for (const expectedDigest of [null, "f".repeat(64)]) {
    await assert.rejects(
      assertPublishedDeployment({ publicBaseUrl, expectedDigest, fetcher }),
      /published_deployment_mismatch/u,
    );
  }
  await assertPublishedDeployment({
    publicBaseUrl,
    expectedDigest: null,
    fetcher: async () => new Response(null, { status: 404 }),
  });
  for (const status of [404, 500]) {
    await assert.rejects(
      assertPublishedDeployment({
        publicBaseUrl,
        expectedDigest: verified.digest,
        fetcher: async () => new Response(null, { status }),
      }),
      /published_deployment_mismatch/u,
    );
  }
  await assert.rejects(
    assertPublishedDeployment({
      publicBaseUrl,
      expectedDigest: null,
      fetcher: async () => {
        throw new Error("network_failed");
      },
    }),
    /network_failed/u,
  );
});

test("전달 묶음은 prefix와 고정 버전을 보존하고 데모만 강제 조회 전용으로 제공한다", async () => {
  const parent = await root();
  const first = await candidate(parent, "1.0.0");
  const directory = join(first, "embed/partner");
  const automatic = await readFile(join(directory, "install.html.txt"), "utf8");
  const pinned = await readFile(join(directory, "pinned.html.txt"), "utf8");
  const demo = await readFile(join(directory, "demo.html"), "utf8");
  assert.ok(automatic.includes(`${publicBaseUrl}/embed/v1/loader.js`));
  assert.ok(pinned.includes(`${publicBaseUrl}/embed/releases/1.0.0/loader.js`));
  assert.ok(
    demo.includes(
      `${publicBaseUrl}/embed/releases/1.0.0/embed/quick-estimate.html?mode=inline&amp;demo=1`,
    ),
  );
  assert.doesNotMatch(automatic + pinned + demo, /script\.google\.com|Spreadsheet|api[_-]?key/iu);
  for (const value of [
    "http://widget.company.org/project",
    "https://user:pass@widget.company.org/project",
    "https://widget.company.org/project?x=1",
    "https://widget.company.org/other",
    "https://widget.company.org/project#x",
    "https://widget.company.org:444/project",
  ]) {
    assert.throws(() => normalizePublicBaseUrl(value, basePath), /invalid_public_base_url/u);
  }
});

test("운영 확인값·기록·archive·endpoint가 없으면 공개 작업을 시작할 수 없다", () => {
  const valid = {
    EMBED_SERVER_READY: "attribution-v2-verified",
    EMBED_OPERATIONS_RECORD: "internal-record-2026-10-23",
    EMBED_RELEASE: "1.0.0",
    EMBED_PREVIOUS_RUN: "first",
    EMBED_ROLLBACK_RUN: "",
    NEXT_PUBLIC_QUICK_ESTIMATE_APPS_SCRIPT_URL:
      "https://script.google.com/macros/s/TEST-SYNTAX-ONLY/exec",
  };
  validateEmbedReleaseInputs(valid);
  validateEmbedReleaseInputs({ ...valid, EMBED_PREVIOUS_RUN: "123", EMBED_ROLLBACK_RUN: "122" });
  for (const fields of [
    { EMBED_SERVER_READY: "" },
    { EMBED_OPERATIONS_RECORD: "" },
    { EMBED_PREVIOUS_RUN: "" },
    { EMBED_ROLLBACK_RUN: "123" },
    { EMBED_RELEASE: "../other" },
    { NEXT_PUBLIC_QUICK_ESTIMATE_APPS_SCRIPT_URL: "" },
    {
      NEXT_PUBLIC_QUICK_ESTIMATE_APPS_SCRIPT_URL:
        "https://script.google.com/macros/s/E2E-INTERCEPT-ONLY/exec",
    },
  ]) {
    assert.throws(() => validateEmbedReleaseInputs({ ...valid, ...fields }));
  }
});
