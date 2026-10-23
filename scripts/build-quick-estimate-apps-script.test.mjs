import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

import { buildQuickEstimateAppsScriptBundle } from "./build-quick-estimate-apps-script.mjs";

test("Apps Script bundle에 전역 진입점과 저장 설정 함수를 생성한다", async () => {
  const bundle = await buildQuickEstimateAppsScriptBundle();

  assert.match(bundle, /function doPost\(e\)/u);
  assert.match(bundle, /QuickEstimateWebApp\.doPost\(e\)/u);
  assert.match(bundle, /function setupQuickEstimateStorage\(\)/u);
  assert.match(bundle, /function syncQuickEstimateConsultationRows\(\)/u);
  assert.match(bundle, /function onEditQuickEstimateConsultation\(e\)/u);
  assert.match(bundle, /function runQuickEstimateOperationsCheck\(\)/u);
  assert.doesNotMatch(bundle, /^\s*(?:import|export)\s/mu);
  assert.doesNotThrow(() => new vm.Script(bundle));
  assert.doesNotMatch(bundle, /__require\(|next\/image|react\/jsx/u);
  assert.doesNotThrow(() => vm.runInNewContext(bundle, {}));
  const manifest = JSON.parse(
    await readFile(
      new URL("../integrations/google-apps-script/quick-estimate/appsscript.json", import.meta.url),
      "utf8",
    ),
  );
  assert.ok(
    manifest.oauthScopes.includes("https://www.googleapis.com/auth/userinfo.email"),
    "migration 실행 계정 확인에 필요한 OAuth scope가 누락되면 안 됩니다.",
  );
});
