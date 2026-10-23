const DESCRIPTION = "Apps Script 관리 출처 컬럼";

/** 출처 열만 보호하며 실제 Google service 없이 권한 경계를 검사하는 port입니다. */
export type AttributionProtectionPort = {
  getDescription: () => string;
  getRange: () => { getA1Notation: () => string };
  isWarningOnly: () => boolean;
  canEdit: () => boolean;
  canDomainEdit: () => boolean;
  getEditors: () => { getEmail: () => string }[];
  setDescription: (value: string) => unknown;
  setWarningOnly: (value: boolean) => unknown;
  addEditors: (emails: string[]) => unknown;
  removeEditors: (emails: string[]) => unknown;
  setDomainEdit: (value: boolean) => unknown;
  // 설치된 타입 패키지보다 새 API입니다. 지원 환경에서는 audience 권한도 제거합니다.
  getTargetAudiences?: () => { getAudienceId: () => string }[];
  removeTargetAudience?: (id: string) => unknown;
};

type SourceRangePort = {
  getA1Notation: () => string;
  getNumberFormats: () => string[][];
  setNumberFormat: (value: string) => unknown;
  protect: () => AttributionProtectionPort;
};

/** 새 출처 범위만 실행 계정·소유자에게 제한하고 기존 범위 권한은 건드리지 않습니다. */
export function configureAttributionSourceProtection(
  range: SourceRangePort,
  protections: AttributionProtectionPort[],
  allowedEditors: string[],
): void {
  if (!allowedEditors.length || allowedEditors.some((email) => !email.trim()))
    throw new Error("migration_editor_identity_missing");
  const protection =
    protections.find(
      (candidate) =>
        candidate.getDescription() === DESCRIPTION &&
        candidate.getRange().getA1Notation() === range.getA1Notation(),
    ) ?? range.protect();
  range.setNumberFormat("@");
  protection.setDescription(DESCRIPTION);
  protection.setWarningOnly(false);
  // group을 통해 권한을 받은 실행 계정을 먼저 명시해야 나머지 editor를 안전하게 제거할 수 있습니다.
  protection.addEditors(allowedEditors);
  protection.removeEditors(
    protection
      .getEditors()
      .map((user) => user.getEmail())
      .filter((email) => !allowedEditors.includes(email)),
  );
  if (protection.canDomainEdit()) protection.setDomainEdit(false);
  for (const audience of protection.getTargetAudiences?.() ?? []) {
    if (!protection.removeTargetAudience) throw new Error("migration_audience_permission");
    protection.removeTargetAudience(audience.getAudienceId());
  }
}

/** 이름만 같은 보호가 아닌 정확한 범위·실제 편집자·서식을 다시 읽어 확인합니다. */
export function verifyAttributionSourceProtection(
  range: SourceRangePort,
  protections: AttributionProtectionPort[],
  allowedEditors: string[],
): boolean {
  return (
    allowedEditors.length > 0 &&
    range.getNumberFormats().every((row) => row.every((format) => format === "@")) &&
    protections.some(
      (protection) =>
        protection.getDescription() === DESCRIPTION &&
        protection.getRange().getA1Notation() === range.getA1Notation() &&
        !protection.isWarningOnly() &&
        protection.canEdit() &&
        !protection.canDomainEdit() &&
        protection.getEditors().every((user) => allowedEditors.includes(user.getEmail())) &&
        (protection.getTargetAudiences?.().length ?? 0) === 0,
    )
  );
}
