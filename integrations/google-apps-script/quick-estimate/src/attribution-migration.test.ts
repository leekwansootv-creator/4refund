import { expect, it, vi } from "vitest";
import { migrateAttributionSchema, type AttributionMigrationPort } from "./attribution-migration";
import { ATTRIBUTED_LEAD_HEADERS, LEAD_SHEET_HEADERS } from "./sheet-schema";
import {
  ATTRIBUTED_CONSULTATION_HEADERS,
  CONSULTATION_SHEET_HEADERS,
} from "./consultation-sheet-schema";

function fixture() {
  let enabled = false;
  const row = Array<string>(24).fill("");
  row[0] = "lead";
  row[1] = "request";
  row[22] = "CONTACTING";
  const queue = Array<string>(16).fill("");
  queue[0] = "연락 중";
  queue[1] = "업무 담당자";
  queue[12] = "다시 연락 요청";
  queue[15] = "lead";
  const snapshot: ReturnType<AttributionMigrationPort["read"]> = {
    leadHeaders: [...LEAD_SHEET_HEADERS],
    consultationHeaders: [...CONSULTATION_SHEET_HEADERS],
    leadRows: [row],
    consultationRows: [queue],
    codebook: [
      ["category", "code", "description"],
      ["retention", "P1Y", "기존 보유 정책"],
    ],
  };
  const port: AttributionMigrationPort = {
    withLock: (operation) => operation(),
    read: () => structuredClone(snapshot),
    setEnabled: (value) => {
      enabled = value;
    },
    writeHeaders: () => {
      snapshot.leadHeaders = [...ATTRIBUTED_LEAD_HEADERS];
      snapshot.consultationHeaders = [...ATTRIBUTED_CONSULTATION_HEADERS];
    },
    appendCodebook: (rows) => {
      snapshot.codebook.push(...rows);
    },
    writeSource: (index, cells) => {
      snapshot.consultationRows[index - 2]?.splice(16, 2, ...cells);
    },
    configure: vi.fn(),
    flush: vi.fn(),
    verifyConfiguration: () => true,
  };
  return { port, snapshot, enabled: () => enabled };
}

it("migration은 출처 표시만 보강하고 과거 원본과 업무값을 보존하며 재실행 가능하다", () => {
  const { port, snapshot, enabled } = fixture();
  const original = structuredClone(snapshot);
  migrateAttributionSchema(port);
  const after = structuredClone(snapshot);
  migrateAttributionSchema(port);
  expect(snapshot).toEqual(after);
  expect(snapshot.leadRows).toEqual(original.leadRows);
  expect(snapshot.consultationRows[0]?.slice(0, 16)).toEqual(original.consultationRows[0]);
  expect(snapshot.consultationRows[0]?.slice(16)).toEqual(["미수집", "과거 미수집"]);
  expect(enabled()).toBe(true);
});
it("부분 실패는 v2를 닫고 같은 migration으로 재개한다", () => {
  const { port, enabled } = fixture();
  expect(() =>
    migrateAttributionSchema({
      ...port,
      configure: () => {
        throw new Error("partial");
      },
    }),
  ).toThrow("partial");
  expect(enabled()).toBe(false);
  migrateAttributionSchema(port);
  expect(enabled()).toBe(true);
});
it("기존 사용자 열·누락 ID·codebook 충돌은 첫 쓰기 전에 중단한다", () => {
  for (const kind of ["column", "id", "codebook"]) {
    const { port, snapshot } = fixture();
    const write = vi.fn();
    if (kind === "column") snapshot.leadHeaders.push("사용자 열");
    if (kind === "id") snapshot.consultationRows[0]![15] = "unmatched";
    if (kind === "codebook") snapshot.codebook.push(["column", "source_domain", "다른 의미"]);
    expect(() => migrateAttributionSchema({ ...port, writeHeaders: write })).toThrow();
    expect(write).not.toHaveBeenCalled();
  }
});

it.each(["deleted", "business_changed", "lead_changed"])(
  "readback에서 %s가 발견되면 v2를 활성화하지 않는다",
  (kind) => {
    const { port, snapshot, enabled } = fixture();
    expect(() =>
      migrateAttributionSchema({
        ...port,
        flush: () => {
          if (kind === "deleted") {
            snapshot.leadRows.length = 0;
            snapshot.consultationRows.length = 0;
          } else if (kind === "business_changed") {
            snapshot.consultationRows[0]![1] = "변경된 담당자";
          } else {
            snapshot.leadRows[0] = snapshot.leadRows[0]!.map((value, index) =>
              index === 22 ? "CLOSED" : value,
            );
          }
        },
      }),
    ).toThrow("migration_existing_data_changed");
    expect(enabled()).toBe(false);
  },
);

it("지원하지 않는 보호·필터 사전 검사 실패는 어떤 열도 변경하지 않는다", () => {
  const { port, enabled } = fixture();
  const write = vi.fn();
  expect(() =>
    migrateAttributionSchema({
      ...port,
      writeHeaders: write,
      preflightConfiguration: () => {
        throw new Error("migration_unrecognized_filter");
      },
    }),
  ).toThrow("migration_unrecognized_filter");
  expect(write).not.toHaveBeenCalled();
  expect(enabled()).toBe(false);
});
