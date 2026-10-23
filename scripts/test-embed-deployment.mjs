import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { resolve, join, extname, relative, isAbsolute } from "node:path";
import { chromium, expect } from "@playwright/test";
import { verifyEmbedDeployment } from "./embed-deployment-artifact.mjs";

const directory = resolve(process.env.EMBED_ARTIFACT_DIRECTORY ?? ".embed-artifacts/candidate");
const { manifest } = await verifyEmbedDeployment(directory);
const previousDirectory = process.env.EMBED_BROWSER_PREVIOUS_ARTIFACT;
if (previousDirectory) {
  const previous = await verifyEmbedDeployment(previousDirectory);
  if (previous.manifest.publicBaseUrl !== manifest.publicBaseUrl)
    throw new Error("browser_previous_public_url_mismatch");
}
const base = manifest.publicBaseUrl;
const origin = new URL(base).origin;
const parent = "https://partner-embed.example";
const mime = {
  ".js": "text/javascript",
  ".css": "text/css",
  ".html": "text/html; charset=utf-8",
  ".txt": "text/plain",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};
const browser = await chromium.launch();
const missing = [];
const errors = [];
let posts = 0;
const results = [];
try {
  for (const width of [1440, 375]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      serviceWorkers: "block",
    });
    // 모든 URL을 로컬 파일/HTML로 처리합니다. 예상하지 못한 목적지나 POST는 외부로 보내지 않습니다.
    await context.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (request.method() === "POST") {
        posts++;
        return route.abort();
      }
      if (url.origin === parent) {
        const version = url.searchParams.get("release");
        const script = version
          ? `${base}/embed/releases/${version}/loader.js`
          : `${base}/embed/v1/loader.js`;
        return route.fulfill({
          contentType: "text/html; charset=utf-8",
          body: `<!doctype html><html lang="ko"><head><title>제휴 설치 확인</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><h1>제휴 설치 확인</h1><div id="estimate"><a href="${base}/embed/quick-estimate.html?mode=standalone">별도 조회</a></div><script async src="${script}" data-target="estimate"></script></body></html>`,
        });
      }
      if (url.origin !== origin || !url.pathname.startsWith(`${manifest.basePath}/`)) {
        missing.push(`${url.origin}${url.pathname}`);
        return route.abort();
      }
      // 배포 직전에 HTML을 받은 탭의 이후 자원 요청을 새 배포 파일로 처리합니다.
      if (
        previousDirectory &&
        url.pathname === `${manifest.basePath}/` &&
        url.searchParams.has("staleHomepage")
      ) {
        return route.fulfill({
          body: await readFile(join(previousDirectory, "index.html")),
          contentType: mime[".html"],
        });
      }
      const pathname = decodeURIComponent(url.pathname.slice(manifest.basePath.length));
      const target = resolve(directory, `.${pathname}`);
      const difference = relative(directory, target);
      if (difference.startsWith("..") || isAbsolute(difference)) return route.abort();
      for (const file of [target, `${target}.html`, join(target, "index.html")]) {
        try {
          if (!(await stat(file)).isFile()) continue;
          return route.fulfill({
            body: await readFile(file),
            contentType: mime[extname(file)] ?? "application/octet-stream",
          });
        } catch (error) {
          if (error.code !== "ENOENT" && error.code !== "ENOTDIR") throw error;
        }
      }
      missing.push(url.pathname);
      return route.fulfill({ status: 404, body: "Missing local artifact" });
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    const lookup = async (frame) => {
      await frame.getByLabel("업종").selectOption("N");
      await frame.getByLabel("직원 수").fill("25");
      await frame.getByRole("button", { name: "조회하기", exact: true }).click();
      await expect(frame.getByRole("region", { name: "간단 견적 조회 결과" })).toBeVisible();
    };
    for (const suffix of previousDirectory ? ["", "?staleHomepage=1"] : [""]) {
      await page.goto(`${base}/${suffix}`);
      await expect(page).toHaveTitle("4대보험경정청구센터");
      await page.getByRole("button", { name: "환급액 조회하기", exact: true }).click();
      await lookup(page);
      await page.getByRole("button", { name: "간단 견적 닫기" }).click();
      await expect(
        page.getByRole("button", { name: "환급액 조회하기", exact: true }),
      ).toBeFocused();
    }
    for (const release of [null, ...Object.keys(manifest.releases)]) {
      await page.goto(`${parent}/?${release ? `release=${release}` : "channel=v1"}`);
      const entry = page.frameLocator('iframe[title$="진입"]');
      await entry.getByRole("button", { name: "환급액 조회하기", exact: true }).click();
      const flow = page.frameLocator('iframe[title$="상담 신청"]');
      await lookup(flow);
      const actual = await page.locator('iframe[title$="상담 신청"]').getAttribute("src");
      assert.ok(actual.startsWith(`${base}/embed/releases/${release ?? manifest.activeRelease}/`));
      await flow.getByRole("button", { name: "간단 견적 닫기" }).click();
      await expect(
        entry.getByRole("button", { name: "환급액 조회하기", exact: true }),
      ).toBeFocused();
      results.push({
        width,
        installed: release ?? "v1",
        resolved: release ?? manifest.activeRelease,
      });
    }
    await page.goto(`${base}/embed/partner/demo.html`);
    const demo = page.frameLocator('iframe[title="조회 전용 예시"]');
    await demo.getByRole("button", { name: "환급액 조회하기", exact: true }).click();
    await lookup(demo);
    await expect(demo.getByRole("button", { name: "상세 견적 받기" })).toHaveCount(0);
    await context.close();
  }
  assert.equal(posts, 0);
  assert.deepEqual(missing, []);
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify(
      {
        results,
        homepage: "passed",
        staleHomepage: previousDirectory ? "passed" : "not requested",
        lookupOnlyDemo: "passed",
        posts,
        missingAssets: missing.length,
        browserErrors: errors.length,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
