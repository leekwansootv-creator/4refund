import { expect, it, vi } from "vitest";
import {
  configureAttributionSourceProtection,
  verifyAttributionSourceProtection,
  type AttributionProtectionPort,
} from "./attribution-source-protection";

function fixture() {
  const state = {
    editors: ["staff@example.test", "group@example.test"],
    audiences: ["department"],
    domain: true,
    warning: true,
    description: "",
    notation: "Q1:R1000",
    format: "General",
  };
  const protection: AttributionProtectionPort = {
    getDescription: () => state.description,
    getRange: () => ({ getA1Notation: () => state.notation }),
    isWarningOnly: () => state.warning,
    canEdit: () => true,
    canDomainEdit: () => state.domain,
    getEditors: () => state.editors.map((email) => ({ getEmail: () => email })),
    setDescription: (value) => {
      state.description = value;
    },
    setWarningOnly: (value) => {
      state.warning = value;
    },
    addEditors: (emails) => {
      state.editors = [...new Set([...state.editors, ...emails])];
    },
    removeEditors: (emails) => {
      state.editors = state.editors.filter((email) => !emails.includes(email));
    },
    setDomainEdit: (value) => {
      state.domain = value;
    },
    getTargetAudiences: () => state.audiences.map((id) => ({ getAudienceId: () => id })),
    removeTargetAudience: (id) => {
      state.audiences = state.audiences.filter((value) => value !== id);
    },
  };
  const range = {
    getA1Notation: () => "Q1:R1000",
    getNumberFormats: () => [[state.format, state.format]],
    setNumberFormat: (value: string) => {
      state.format = value;
    },
    protect: vi.fn(() => protection),
  };
  const allowed = ["runner@example.test", "owner@example.test"];
  return { range, protection, state, allowed };
}

it("새 출처 열만 실행 계정·소유자에게 제한하고 재실행해도 보호를 중복 생성하지 않는다", () => {
  const { range, protection, state, allowed } = fixture();
  configureAttributionSourceProtection(range, [], allowed);
  expect(state.editors.sort()).toEqual([...allowed].sort());
  expect(state.domain).toBe(false);
  expect(state.audiences).toEqual([]);
  expect(verifyAttributionSourceProtection(range, [protection], allowed)).toBe(true);
  configureAttributionSourceProtection(range, [protection], allowed);
  expect(range.protect).toHaveBeenCalledTimes(1);
});

it.each(["range", "editor", "domain", "audience", "format", "warning"])(
  "%s 불일치를 보호 완료로 판정하지 않는다",
  (kind) => {
    const { range, protection, state, allowed } = fixture();
    configureAttributionSourceProtection(range, [], allowed);
    if (kind === "range") state.notation = "Q1:Q2";
    if (kind === "editor") state.editors.push("other@example.test");
    if (kind === "domain") state.domain = true;
    if (kind === "audience") state.audiences.push("department");
    if (kind === "format") state.format = "General";
    if (kind === "warning") state.warning = true;
    expect(verifyAttributionSourceProtection(range, [protection], allowed)).toBe(false);
  },
);

it("실행 계정을 확인할 수 없으면 보호를 변경하지 않는다", () => {
  const { range } = fixture();
  expect(() => configureAttributionSourceProtection(range, [], [])).toThrow(
    "migration_editor_identity_missing",
  );
  expect(range.protect).not.toHaveBeenCalled();
});
