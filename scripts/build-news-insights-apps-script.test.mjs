import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import {
  buildNewsInsightsBundle,
  buildNewsPublicBundle,
} from "./build-news-insights-apps-script.mjs";

test("뉴스 관리는 메뉴와 서명 작업자 POST만 연결하고 공개 GET·onEdit을 제공하지 않는다", async () => {
  const bundle = await buildNewsInsightsBundle();
  const context = vm.createContext({});
  vm.runInContext(bundle, context);
  for (const name of ["onOpenNews", "showNewsSidebar", "newsList", "newsMutate", "onOpen"])
    assert.equal(typeof context[name], "function");
  assert.equal(typeof context.doPost, "function");
  for (const name of ["doGet", "onEdit"]) assert.equal(context[name], undefined);
  assert.doesNotMatch(bundle, /__require\(|require\(/u);
});

test("공개 bundle은 관리·쓰기·수집·메일·트리거 없이 GET만 제공한다", async () => {
  const bundle = await buildNewsPublicBundle();
  const context = vm.createContext({});
  vm.runInContext(bundle, context);
  assert.equal(typeof context.doGet, "function");
  for (const name of ["doPost", "newsList", "newsMutate", "showNewsSidebar", "onOpen"])
    assert.equal(context[name], undefined);
  assert.doesNotMatch(
    bundle,
    /SpreadsheetApp|UrlFetchApp|Session\.|LockService|setValues|setNumberFormat|MailApp|ScriptApp|NEWS_EDITOR_EMAILS|NEWS_EXTRACTOR_TOKEN|HtmlService/u,
  );
  const manifest = JSON.parse(
    readFileSync("integrations/google-apps-script/news-public/appsscript.json", "utf8"),
  );
  assert.deepEqual(manifest.oauthScopes, ["https://www.googleapis.com/auth/spreadsheets.readonly"]);
});
