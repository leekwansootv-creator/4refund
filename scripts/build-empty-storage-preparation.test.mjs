import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { buildEmptyStoragePreparationBundle } from "./build-empty-storage-preparation.mjs";

test("준비 bundle은 Google·브라우저 없는 VM에서 초기화되고 위험 서비스가 없다", async () => {
  const source = await buildEmptyStoragePreparationBundle();
  const sandbox = {};
  runInNewContext(source, sandbox);
  assert.equal(typeof sandbox.prepareEmptyQuickEstimateStorage, "function");
  assert.equal(typeof sandbox.verifyEmptyQuickEstimateStorage, "function");
  assert.doesNotMatch(
    source,
    /\b(?:MailApp|GmailApp|ScriptApp|UrlFetchApp|doPost|setupQuickEstimateStorage)\b/u,
  );
  assert.equal(sandbox.doPost, undefined);
});

test("출력 경로 실수로 기존 Code.gs를 덮어쓰지 않는다", () => {
  const directory = mkdtempSync(join(tmpdir(), "4refund-preparation-builder-"));
  const target = join(directory, "Code.gs");
  writeFileSync(target, "existing-production-bundle");
  const result = spawnSync(
    process.execPath,
    ["scripts/build-empty-storage-preparation.mjs", target],
    { encoding: "utf8" },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /출력 파일명은 Preparation.gs/u);
  assert.equal(readFileSync(target, "utf8"), "existing-production-bundle");
});

test("같은 이름의 준비 artifact도 묵시적으로 교체하지 않는다", () => {
  const directory = mkdtempSync(join(tmpdir(), "4refund-preparation-builder-"));
  const target = join(directory, "Preparation.gs");
  writeFileSync(target, "previous-reviewed-preparation");
  const result = spawnSync(
    process.execPath,
    ["scripts/build-empty-storage-preparation.mjs", target],
    { encoding: "utf8" },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /EEXIST/u);
  assert.equal(readFileSync(target, "utf8"), "previous-reviewed-preparation");
});
