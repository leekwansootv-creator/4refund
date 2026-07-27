import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { checkComments } from "./check-comments.mjs";

/**
 * 각 주석 검사 테스트가 격리된 임시 저장소를 사용하도록 관리한다.
 */
function withFixture(source, run) {
  const root = mkdtempSync(join(tmpdir(), "4refund-comments-"));
  const sourceRoot = join(root, "src");

  try {
    mkdirSync(sourceRoot, { recursive: true });
    writeFileSync(join(sourceRoot, "example.ts"), source, "utf8");
    run(root);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
}

test("GitHub 이슈와 연결된 TODO를 허용한다", () => {
  withFixture("// TODO(#123): 외부 계약 변경 뒤 매핑을 확장한다.", (root) => {
    assert.deepEqual(checkComments(root), []);
  });
});

test("추적되지 않는 TODO와 임시 표식을 거부한다", () => {
  withFixture("// TODO: 나중에 수정\n/* FIXME 임시 처리 */", (root) => {
    const errors = checkComments(root);

    assert.ok(errors.some((error) => error.includes("TODO는 TODO(#이슈번호):")));
    assert.ok(errors.some((error) => error.includes("FIXME와 XXX 대신 이슈로 추적하세요")));
  });
});
