import {
  ESTIMATE_BENCHMARK_VERSION,
  ESTIMATE_RULE_VERSION,
  MARKETING_CONSENT_VERSION,
  MAX_SUBMISSION_ELAPSED_MS,
  MIN_SUBMISSION_ELAPSED_MS,
  PRIVACY_NOTICE_VERSION,
  SUBMISSION_PAYLOAD_MAX_BYTES,
  calculateEstimate,
  type MarketingChannel,
  type QuickEstimateSubmissionPayload,
  type QuickEstimateSubmissionValidationErrorCode,
} from "@/features/quick-estimate";

const ROOT_KEYS = [
  "requestId",
  "estimate",
  "lead",
  "privacy",
  "marketing",
  "antiSpam",
  "sourcePath",
];
const ESTIMATE_KEYS = [
  "industryCode",
  "employeeCount",
  "amount",
  "currency",
  "randomUpliftBps",
  "ruleVersion",
  "benchmarkVersion",
];
const LEAD_KEYS = ["companyName", "contactName", "email", "phone"];
const PRIVACY_KEYS = ["basis", "noticeVersion", "agreed"];
const MARKETING_KEYS = ["agreed", "channels", "consentVersion"];
const ANTI_SPAM_KEYS = ["honeypot", "elapsedMs"];
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f-\u009f]/u;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const PHONE_SEPARATOR_PATTERN = /[\s().-]/gu;
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const MARKETING_CHANNELS = new Set<MarketingChannel>(["EMAIL", "SMS"]);

type UnknownRecord = Record<string, unknown>;

type SubmissionValidationResult =
  | {
      ok: true;
      submission: QuickEstimateSubmissionPayload;
    }
  | {
      ok: false;
      code: QuickEstimateSubmissionValidationErrorCode;
    };

function failure(code: QuickEstimateSubmissionValidationErrorCode): SubmissionValidationResult {
  return { ok: false, code };
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: UnknownRecord, expectedKeys: readonly string[]): boolean {
  const actualKeys = Object.keys(value);

  return (
    actualKeys.length === expectedKeys.length &&
    actualKeys.every((key) => expectedKeys.includes(key))
  );
}

function calculateUtf8ByteLength(value: string): number {
  let bytes = 0;

  for (const character of value) {
    const codePoint = character.codePointAt(0);

    if (codePoint === undefined) {
      continue;
    }

    if (codePoint <= 0x7f) {
      bytes += 1;
    } else if (codePoint <= 0x7ff) {
      bytes += 2;
    } else if (codePoint <= 0xffff) {
      bytes += 3;
    } else {
      bytes += 4;
    }
  }

  return bytes;
}

function normalizeRequiredText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  if (
    normalized.length === 0 ||
    normalized.length > maxLength ||
    CONTROL_CHARACTER_PATTERN.test(normalized)
  ) {
    return null;
  }

  return normalized;
}

function normalizeEmail(value: unknown): string | null {
  const normalized = normalizeRequiredText(value, 254);

  if (normalized === null || !EMAIL_PATTERN.test(normalized)) {
    return null;
  }

  return normalized;
}

function normalizePhone(value: unknown): string | null {
  const normalized = normalizeRequiredText(value, 30)?.replace(PHONE_SEPARATOR_PATTERN, "");

  if (normalized === undefined || !/^\d{9,11}$/u.test(normalized)) {
    return null;
  }

  return normalized;
}

function normalizeMarketingChannels(value: unknown): MarketingChannel[] | null {
  if (!Array.isArray(value) || value.some((channel) => !MARKETING_CHANNELS.has(channel))) {
    return null;
  }

  const uniqueChannels = new Set<MarketingChannel>(value);

  if (uniqueChannels.size !== value.length) {
    return null;
  }

  return ["EMAIL", "SMS"].filter((channel): channel is MarketingChannel =>
    uniqueChannels.has(channel as MarketingChannel),
  );
}

function validateParsedSubmission(input: unknown): SubmissionValidationResult {
  if (!isRecord(input) || !hasExactKeys(input, ROOT_KEYS)) {
    return failure("INVALID_INPUT");
  }

  const { estimate, lead, privacy, marketing, antiSpam } = input;

  if (
    !isRecord(estimate) ||
    !hasExactKeys(estimate, ESTIMATE_KEYS) ||
    !isRecord(lead) ||
    !hasExactKeys(lead, LEAD_KEYS) ||
    !isRecord(privacy) ||
    !hasExactKeys(privacy, PRIVACY_KEYS) ||
    !isRecord(marketing) ||
    !hasExactKeys(marketing, MARKETING_KEYS) ||
    !isRecord(antiSpam) ||
    !hasExactKeys(antiSpam, ANTI_SPAM_KEYS)
  ) {
    return failure("INVALID_INPUT");
  }

  if (
    estimate.ruleVersion !== ESTIMATE_RULE_VERSION ||
    estimate.benchmarkVersion !== ESTIMATE_BENCHMARK_VERSION
  ) {
    return failure("UNSUPPORTED_RULE");
  }

  const calculated = calculateEstimate({
    industryCode: typeof estimate.industryCode === "string" ? estimate.industryCode : "",
    employeeCount: typeof estimate.employeeCount === "number" ? estimate.employeeCount : NaN,
    randomUpliftBps: typeof estimate.randomUpliftBps === "number" ? estimate.randomUpliftBps : NaN,
  });

  if (calculated.status === "unsupported") {
    return failure("UNSUPPORTED_RULE");
  }

  if (
    calculated.status !== "calculated" ||
    estimate.amount !== calculated.amount ||
    estimate.currency !== calculated.currency
  ) {
    return failure("INVALID_INPUT");
  }

  if (
    privacy.basis !== "CONSENT" ||
    privacy.noticeVersion !== PRIVACY_NOTICE_VERSION ||
    privacy.agreed !== true
  ) {
    return failure("INVALID_CONSENT");
  }

  if (
    antiSpam.honeypot !== "" ||
    !Number.isInteger(antiSpam.elapsedMs) ||
    (antiSpam.elapsedMs as number) < MIN_SUBMISSION_ELAPSED_MS ||
    (antiSpam.elapsedMs as number) > MAX_SUBMISSION_ELAPSED_MS
  ) {
    return failure("INVALID_INPUT");
  }

  const channels = normalizeMarketingChannels(marketing.channels);

  if (
    typeof marketing.agreed !== "boolean" ||
    marketing.consentVersion !== MARKETING_CONSENT_VERSION ||
    channels === null ||
    (marketing.agreed && channels.length === 0) ||
    (!marketing.agreed && channels.length > 0)
  ) {
    return failure("INVALID_CONSENT");
  }

  const companyName = normalizeRequiredText(lead.companyName, 100);
  const contactName = normalizeRequiredText(lead.contactName, 50);
  const email = normalizeEmail(lead.email);
  const phone = normalizePhone(lead.phone);

  if (
    !UUID_V4_PATTERN.test(typeof input.requestId === "string" ? input.requestId : "") ||
    companyName === null ||
    contactName === null ||
    email === null ||
    phone === null ||
    input.sourcePath !== "/"
  ) {
    return failure("INVALID_INPUT");
  }

  const submission: QuickEstimateSubmissionPayload = {
    requestId: input.requestId as string,
    estimate: {
      industryCode: calculated.industryCode,
      employeeCount: calculated.employeeCount,
      amount: calculated.amount,
      currency: calculated.currency,
      randomUpliftBps: calculated.randomUpliftBps,
      ruleVersion: calculated.ruleVersion,
      benchmarkVersion: calculated.benchmarkVersion,
    },
    lead: {
      companyName,
      contactName,
      email,
      phone,
    },
    privacy: {
      basis: "CONSENT",
      noticeVersion: PRIVACY_NOTICE_VERSION,
      agreed: true,
    },
    marketing: {
      agreed: marketing.agreed,
      channels,
      consentVersion: MARKETING_CONSENT_VERSION,
    },
    antiSpam: {
      honeypot: "",
      elapsedMs: antiSpam.elapsedMs as number,
    },
    sourcePath: "/",
  };

  return { ok: true, submission };
}

/** form field의 JSON 문자열을 크기 제한 안에서 parse하고 저장 가능한 값으로 정규화합니다. */
export function parseAndValidateSubmissionPayload(payload: unknown): SubmissionValidationResult {
  if (
    typeof payload !== "string" ||
    calculateUtf8ByteLength(payload) > SUBMISSION_PAYLOAD_MAX_BYTES
  ) {
    return failure("INVALID_INPUT");
  }

  try {
    return validateParsedSubmission(JSON.parse(payload) as unknown);
  } catch {
    return failure("INVALID_INPUT");
  }
}
