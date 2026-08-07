import { ESTIMATE_BENCHMARK_VERSION, ESTIMATE_RULE_VERSION } from "../constants/estimate-rule-set";
import {
  MAX_SUBMISSION_ELAPSED_MS,
  MARKETING_CONSENT_VERSION,
  MIN_SUBMISSION_ELAPSED_MS,
  PRIVACY_NOTICE_VERSION,
  SUBMISSION_PAYLOAD_MAX_BYTES,
} from "../constants/lead-submission-contract";
import { calculateEstimate } from "../lib/calculate-estimate";
import type {
  MarketingChannel,
  QuickEstimateLeadDraft,
  QuickEstimateLeadValidationIssue,
  QuickEstimateLeadValidationResult,
  QuickEstimateSubmissionPayload,
} from "../types/lead-submission";

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f-\u009f]/u;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const PHONE_SEPARATOR_PATTERN = /[\s().-]/gu;
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const MARKETING_CHANNELS = new Set<MarketingChannel>(["EMAIL", "SMS"]);

function calculateUtf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function normalizeRequiredText(value: string, maxLength: number): string | null {
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

function normalizeEmail(value: string): string | null {
  const normalized = normalizeRequiredText(value, 254);

  return normalized !== null && EMAIL_PATTERN.test(normalized) ? normalized : null;
}

function normalizePhone(value: string): string | null {
  const normalized = normalizeRequiredText(value, 30)?.replace(PHONE_SEPARATOR_PATTERN, "");

  return normalized !== undefined && /^\d{9,11}$/u.test(normalized) ? normalized : null;
}

function normalizeMarketingChannels(
  channels: readonly MarketingChannel[],
): MarketingChannel[] | null {
  if (channels.some((channel) => !MARKETING_CHANNELS.has(channel))) {
    return null;
  }

  const uniqueChannels = new Set(channels);

  if (uniqueChannels.size !== channels.length) {
    return null;
  }

  return (["EMAIL", "SMS"] as const).filter((channel) => uniqueChannels.has(channel));
}

function isCurrentCalculatedEstimate(draft: QuickEstimateLeadDraft): boolean {
  if (draft.estimate.status !== "calculated") {
    return false;
  }

  const recalculated = calculateEstimate({
    industryCode: draft.estimate.industryCode,
    employeeCount: draft.estimate.employeeCount,
    randomUpliftBps: draft.estimate.randomUpliftBps,
  });

  return (
    recalculated.status === "calculated" &&
    draft.estimate.amount === recalculated.amount &&
    draft.estimate.currency === recalculated.currency &&
    draft.estimate.ruleVersion === ESTIMATE_RULE_VERSION &&
    draft.estimate.benchmarkVersion === ESTIMATE_BENCHMARK_VERSION
  );
}

/** 연락처·동의 초안을 검증하고 Apps Script에 전송할 payload로 정규화합니다. */
export function createQuickEstimateSubmissionPayload(
  draft: QuickEstimateLeadDraft,
  requestId: string,
): QuickEstimateLeadValidationResult {
  const issues: QuickEstimateLeadValidationIssue[] = [];
  const companyName = normalizeRequiredText(draft.lead.companyName, 100);
  const contactName = normalizeRequiredText(draft.lead.contactName, 50);
  const email = normalizeEmail(draft.lead.email);
  const phone = normalizePhone(draft.lead.phone);
  const marketingChannels = normalizeMarketingChannels(draft.marketing.channels);

  if (!UUID_V4_PATTERN.test(requestId)) {
    issues.push("invalid_request_id");
  }

  if (!isCurrentCalculatedEstimate(draft)) {
    issues.push("invalid_estimate");
  }

  if (companyName === null) {
    issues.push("invalid_company_name");
  }

  if (contactName === null) {
    issues.push("invalid_contact_name");
  }

  if (email === null) {
    issues.push("invalid_email");
  }

  if (phone === null) {
    issues.push("invalid_phone");
  }

  if (!draft.privacyAgreed) {
    issues.push("privacy_consent_required");
  }

  if (
    marketingChannels === null ||
    (draft.marketing.agreed && marketingChannels.length === 0) ||
    (!draft.marketing.agreed && marketingChannels.length > 0)
  ) {
    issues.push("invalid_marketing_consent");
  }

  if (
    draft.antiSpam.honeypot !== "" ||
    !Number.isInteger(draft.antiSpam.elapsedMs) ||
    draft.antiSpam.elapsedMs < MIN_SUBMISSION_ELAPSED_MS ||
    draft.antiSpam.elapsedMs > MAX_SUBMISSION_ELAPSED_MS
  ) {
    issues.push("suspicious_submission");
  }

  if (
    issues.length > 0 ||
    draft.estimate.status !== "calculated" ||
    companyName === null ||
    contactName === null ||
    email === null ||
    phone === null ||
    marketingChannels === null
  ) {
    return { ok: false, issues };
  }

  const payload: QuickEstimateSubmissionPayload = {
    requestId,
    estimate: {
      industryCode: draft.estimate.industryCode,
      employeeCount: draft.estimate.employeeCount,
      amount: draft.estimate.amount,
      currency: draft.estimate.currency,
      randomUpliftBps: draft.estimate.randomUpliftBps,
      ruleVersion: draft.estimate.ruleVersion,
      benchmarkVersion: draft.estimate.benchmarkVersion,
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
      agreed: draft.marketing.agreed,
      channels: marketingChannels,
      consentVersion: MARKETING_CONSENT_VERSION,
    },
    antiSpam: {
      honeypot: "",
      elapsedMs: draft.antiSpam.elapsedMs,
    },
    sourcePath: "/",
  };

  if (calculateUtf8ByteLength(JSON.stringify(payload)) > SUBMISSION_PAYLOAD_MAX_BYTES) {
    return { ok: false, issues: ["payload_too_large"] };
  }

  return { ok: true, payload };
}
