import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { checkArchitecture } from "./check-architecture.mjs";

/**
 * 테스트용 저장소에 파일을 만들고 상위 디렉터리까지 준비한다.
 */
function writeFixture(root, filePath, contents = "") {
  const target = join(root, filePath);

  mkdirSync(join(target, ".."), { recursive: true });
  writeFileSync(target, contents, "utf8");
}

/**
 * 각 테스트가 격리된 임시 저장소를 사용하도록 생명주기를 관리한다.
 */
function withFixture(run) {
  const root = mkdtempSync(join(tmpdir(), "4refund-architecture-"));

  try {
    writeFixture(root, "src/app/page.tsx", "export default function Page() { return null; }");
    run(root);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
}

test("합의된 app, feature, shared 구조를 허용한다", () => {
  withFixture((root) => {
    writeFixture(root, "src/features/refund-request/index.ts", "");
    writeFixture(root, "src/features/refund-request/components/refund-form.tsx", "");
    writeFixture(root, "src/shared/lib/currency.ts", "");
    writeFixture(
      root,
      "integrations/google-apps-script/quick-estimate/src/web-app.ts",
      'import { calculateEstimate } from "@/features/refund-request";',
    );
    writeFixture(root, "integrations/google-apps-script/quick-estimate/Code.gs", "");
    writeFixture(root, "integrations/google-apps-script/quick-estimate/appsscript.json", "{}");
    writeFixture(root, "integrations/google-apps-script/quick-estimate/README.md", "");

    assert.deepEqual(checkArchitecture(root), []);
  });
});

test("integration의 미승인 구조와 feature 내부 경로 참조를 거부한다", () => {
  withFixture((root) => {
    writeFixture(root, "src/features/refund-request/index.ts", "");
    writeFixture(root, "src/features/refund-request/lib/calculate.ts", "");
    writeFixture(
      root,
      "integrations/google-apps-script/quick-estimate/src/web-app.ts",
      'import { calculate } from "@/features/refund-request/lib/calculate";',
    );
    writeFixture(root, "integrations/google-apps-script/quick-estimate/secrets.json", "{}");

    const errors = checkArchitecture(root);

    assert.ok(errors.some((error) => error.includes("feature 공개 진입점")));
    assert.ok(errors.some((error) => error.includes("허용되지 않은 integration 루트 파일")));
  });
});

test("app의 일반 구현 파일과 shared의 상향 의존성을 거부한다", () => {
  withFixture((root) => {
    writeFixture(root, "src/app/refund-form.tsx", "");
    writeFixture(
      root,
      "src/shared/lib/refund.ts",
      'import { requestRefund } from "@/features/refund-request";',
    );

    const errors = checkArchitecture(root);

    assert.ok(errors.some((error) => error.includes("app에는 라우트와 Next.js 특수 파일만")));
    assert.ok(
      errors.some((error) => error.includes("shared는 app 또는 features를 import할 수 없습니다")),
    );
  });
});

test("다른 feature의 내부 경로 대신 공개 진입점만 허용한다", () => {
  withFixture((root) => {
    writeFixture(root, "src/features/refund-request/index.ts", "");
    writeFixture(root, "src/features/refund-policy/index.ts", "");
    writeFixture(
      root,
      "src/features/refund-request/lib/policy.ts",
      'import { policy } from "@/features/refund-policy/server/policy";',
    );

    const errors = checkArchitecture(root);

    assert.ok(errors.some((error) => error.includes("공개 진입점")));
  });
});
