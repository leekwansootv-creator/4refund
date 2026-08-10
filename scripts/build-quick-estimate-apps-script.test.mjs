import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

import { buildQuickEstimateAppsScriptBundle } from "./build-quick-estimate-apps-script.mjs";

test("Apps Script bundle에 전역 진입점과 저장 설정 함수를 생성한다", async () => {
  const bundle = await buildQuickEstimateAppsScriptBundle();

  assert.match(bundle, /function doPost\(e\)/u);
  assert.match(bundle, /QuickEstimateWebApp\.doPost\(e\)/u);
  assert.match(bundle, /function setupQuickEstimateStorage\(\)/u);
  assert.match(bundle, /function syncQuickEstimateConsultationRows\(\)/u);
  assert.match(bundle, /function onEditQuickEstimateConsultation\(e\)/u);
  assert.doesNotMatch(bundle, /^\s*(?:import|export)\s/mu);
  assert.doesNotThrow(() => new vm.Script(bundle));
});
