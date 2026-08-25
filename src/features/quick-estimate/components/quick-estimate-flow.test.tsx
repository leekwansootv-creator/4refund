import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

import { QuickEstimateFlow } from "./quick-estimate-flow.client";
import type { submitEstimateLead } from "../api/submit-estimate-lead";
import type {
  QuickEstimateSubmissionPayload,
  QuickEstimateSubmissionTransportResult,
} from "../types/lead-submission";

const REQUEST_IDS = [
  "0fca3874-40bc-4ea9-a7ad-742a062736ea",
  "f7258fe7-4319-4f0c-8c2b-dc0950282a45",
] as const;
const LEAD_ID = "4d95c6c8-0217-44c7-9d84-e81842721767";
const originalShowModal = HTMLDialogElement.prototype.showModal;
const originalClose = HTMLDialogElement.prototype.close;
type SubmitLead = typeof submitEstimateLead;

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close() {
    this.open = false;
  };
});

afterAll(() => {
  HTMLDialogElement.prototype.showModal = originalShowModal;
  HTMLDialogElement.prototype.close = originalClose;
});

function createDependencies(
  results: QuickEstimateSubmissionTransportResult[],
  randomValues = [0, 1],
) {
  const requestIds = [...REQUEST_IDS];
  const upliftValues = [...randomValues];
  let currentTime = 0;
  const submitLead = vi.fn<SubmitLead>(async () => {
    const result = results.shift();

    if (result === undefined) {
      throw new Error("테스트 제출 결과가 부족합니다.");
    }

    return result;
  });

  return {
    dependencies: {
      now() {
        currentTime += 5_000;
        return currentTime;
      },
      randomUpliftSource: {
        getRandomValues(values: Uint32Array) {
          values[0] = upliftValues.shift() ?? 0;
          return values;
        },
      },
      requestIdSource: {
        randomUUID() {
          const requestId = requestIds.shift();

          if (requestId === undefined) {
            throw new Error("테스트 request_id가 부족합니다.");
          }

          return requestId;
        },
      },
      submitLead,
    },
    submitLead,
  };
}

function getSubmittedPayload(
  submitLead: Mock<SubmitLead>,
  callIndex = 0,
): QuickEstimateSubmissionPayload {
  const call = submitLead.mock.calls[callIndex];

  if (call === undefined) {
    throw new Error(`${callIndex + 1}번째 제출 호출이 없습니다.`);
  }

  return call[0];
}

function renderFlow(
  results: QuickEstimateSubmissionTransportResult[] = [
    { ok: true, leadId: LEAD_ID, duplicate: false },
  ],
  randomValues?: number[],
) {
  const fixture = createDependencies(results, randomValues);

  render(
    <QuickEstimateFlow
      endpoint="https://example.com/apps-script"
      consultHref="#contact"
      dependencies={fixture.dependencies}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "환급액 조회하기" }));
  return fixture;
}

function fillContact(companyName = "테스트 주식회사") {
  fireEvent.change(screen.getByLabelText("회사명"), { target: { value: companyName } });
  fireEvent.change(screen.getByLabelText("담당자 이름"), { target: { value: "김테스트" } });
  fireEvent.change(screen.getByLabelText("이메일"), {
    target: { value: "contact@example.com" },
  });
  fireEvent.change(screen.getByLabelText("전화번호"), { target: { value: "010-1234-5678" } });
}

function moveToEstimate() {
  fillContact();
  fireEvent.click(screen.getByRole("button", { name: "다음" }));
  expect(screen.getByLabelText("업종")).toHaveFocus();
}

function fillEstimate({ marketingAgreed = false }: { marketingAgreed?: boolean } = {}) {
  fireEvent.change(screen.getByLabelText("업종"), { target: { value: "N" } });
  fireEvent.change(screen.getByLabelText("직원 수"), { target: { value: "25" } });
  fireEvent.click(screen.getByLabelText("개인정보 처리 동의 (필수)"));

  if (marketingAgreed) {
    fireEvent.click(screen.getByLabelText("마케팅 활용 동의 (선택)"));
  }
}

function lookup() {
  fireEvent.click(screen.getByRole("button", { name: "조회하기" }));
}

describe("QuickEstimateFlow", () => {
  it("Apps Script endpoint가 없으면 CTA를 비활성화하고 dialog를 열지 않는다", () => {
    render(<QuickEstimateFlow endpoint="" consultHref="#contact" />);

    const action = screen.getByRole("button", { name: "환급액 조회하기" });

    expect(action).toBeDisabled();
    expect(action).toHaveAccessibleDescription("간단 견적 접수 환경을 준비하고 있습니다.");
    fireEvent.click(action);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("계산부터 마케팅 미동의 상담 접수까지 화면 금액과 같은 payload로 완료한다", async () => {
    const { submitLead } = renderFlow();
    moveToEstimate();
    fillEstimate();
    lookup();

    await waitFor(() => {
      expect(screen.getByText("상담 신청이 접수되었습니다.")).toBeInTheDocument();
    });

    expect(submitLead).toHaveBeenCalledOnce();
    const payload = getSubmittedPayload(submitLead);
    expect(submitLead.mock.calls[0]?.[1]).toEqual({
      endpoint: "https://example.com/apps-script",
    });

    expect(payload).toMatchObject({
      requestId: REQUEST_IDS[0],
      estimate: {
        industryCode: "N",
        ruleVersion: "estimate-rule-2026-08-25",
      },
      lead: { phone: "01012345678" },
      privacy: { agreed: true },
      marketing: { agreed: false, channels: [] },
      antiSpam: { honeypot: "", elapsedMs: 5_000 },
      sourcePath: "/",
    });
    expect(screen.getByText(`${payload.estimate.amount.toLocaleString("ko-KR")}원`)).toBeVisible();
    expect(screen.getByRole("region", { name: "간단 견적 조회 결과" })).toHaveFocus();
  });

  it("숨은 honeypot에 값이 있으면 제출 요청을 만들지 않는다", () => {
    const { submitLead } = renderFlow();
    const honeypot = document.querySelector<HTMLInputElement>('input[name="company-website"]');

    if (honeypot === null) {
      throw new Error("honeypot 입력을 찾지 못했습니다.");
    }

    fireEvent.change(honeypot, { target: { value: "https://spam.example" } });
    moveToEstimate();
    fillEstimate();
    lookup();

    expect(submitLead).not.toHaveBeenCalled();
    expect(screen.getByText(/입력 정보를 확인하지 못했습니다/)).toBeInTheDocument();
  });

  it("빠른 중복 click 중 한 요청만 전송하고 응답 전 닫기와 초기화를 막는다", async () => {
    let resolveSubmission: ((result: QuickEstimateSubmissionTransportResult) => void) | undefined;
    const submitLead = vi.fn<SubmitLead>(
      () =>
        new Promise<QuickEstimateSubmissionTransportResult>((resolve) => {
          resolveSubmission = resolve;
        }),
    );
    const fixture = createDependencies([]);
    fixture.dependencies.submitLead = submitLead;

    render(
      <QuickEstimateFlow
        endpoint="https://example.com/apps-script"
        consultHref="#contact"
        dependencies={fixture.dependencies}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "환급액 조회하기" }));
    moveToEstimate();
    fillEstimate();

    const lookupButton = screen.getByRole("button", { name: "조회하기" });
    fireEvent.click(lookupButton);
    fireEvent.click(lookupButton);

    expect(submitLead).toHaveBeenCalledOnce();
    expect(screen.getByText("상담 신청을 접수하고 있습니다.")).toBeInTheDocument();
    expect(screen.queryByText("상담 신청이 접수되었습니다.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "간단 견적 닫기" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "다시 조회하기" })).toBeDisabled();

    await act(async () => {
      resolveSubmission?.({ ok: true, leadId: LEAD_ID, duplicate: false });
    });

    expect(await screen.findByText("상담 신청이 접수되었습니다.")).toBeInTheDocument();
  });

  it("timeout 뒤 같은 request_id·금액·난수 payload로 재시도한다", async () => {
    const { submitLead } = renderFlow([
      { ok: false, kind: "timeout" },
      { ok: true, leadId: LEAD_ID, duplicate: true },
    ]);
    moveToEstimate();
    fillEstimate();
    lookup();

    expect(await screen.findByText(/접수 결과를 확인하지 못했습니다/)).toBeInTheDocument();
    const firstPayload = getSubmittedPayload(submitLead);
    expect(
      screen.getByText(`${firstPayload.estimate.amount.toLocaleString("ko-KR")}원`),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "접수 다시 시도" }));

    await waitFor(() => {
      expect(screen.getByText("상담 신청이 접수되었습니다.")).toBeInTheDocument();
    });
    expect(submitLead).toHaveBeenCalledTimes(2);
    expect(getSubmittedPayload(submitLead, 1)).toBe(firstPayload);
  });

  it("rate limit 응답을 재시도 가능한 제한 안내로 표시한다", async () => {
    renderFlow([{ ok: false, kind: "server", code: "RATE_LIMITED" }]);
    moveToEstimate();
    fillEstimate();
    lookup();

    expect(await screen.findByText(/신청이 많아 잠시 접수를 제한/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "접수 다시 시도" })).toBeEnabled();
  });

  it("연락처 수정 재제출은 기존 계산을 유지하고 새 request_id를 사용한다", async () => {
    const { submitLead } = renderFlow([
      { ok: false, kind: "server", code: "STORAGE_UNAVAILABLE" },
      { ok: true, leadId: LEAD_ID, duplicate: false },
    ]);
    moveToEstimate();
    fillEstimate({ marketingAgreed: true });
    lookup();

    expect(await screen.findByText(/상담 신청을 저장하지 못했습니다/)).toBeInTheDocument();
    const firstPayload = getSubmittedPayload(submitLead);
    fireEvent.click(screen.getByRole("button", { name: "연락처 수정" }));
    fireEvent.change(screen.getByLabelText("회사명"), {
      target: { value: "수정 주식회사" },
    });
    fireEvent.click(screen.getByRole("button", { name: "다음" }));

    await waitFor(() => {
      expect(screen.getByText("상담 신청이 접수되었습니다.")).toBeInTheDocument();
    });
    const secondPayload = getSubmittedPayload(submitLead, 1);

    expect(secondPayload.requestId).not.toBe(firstPayload.requestId);
    expect(secondPayload.estimate).toEqual(firstPayload.estimate);
    expect(secondPayload.lead.companyName).toBe("수정 주식회사");
    expect(secondPayload.marketing).toMatchObject({
      agreed: true,
      channels: ["EMAIL", "SMS"],
    });
  });

  it("계산 조건을 바꿔 다시 조회하면 새 난수와 새 계산을 만든다", async () => {
    const { submitLead } = renderFlow(
      [
        { ok: true, leadId: LEAD_ID, duplicate: false },
        { ok: true, leadId: LEAD_ID, duplicate: false },
      ],
      [0, 200],
    );
    moveToEstimate();
    fillEstimate();
    lookup();
    expect(await screen.findByText("상담 신청이 접수되었습니다.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "다시 조회하기" }));
    fireEvent.change(screen.getByLabelText("직원 수"), { target: { value: "26" } });
    lookup();

    await waitFor(() => {
      expect(submitLead).toHaveBeenCalledTimes(2);
    });
    expect(getSubmittedPayload(submitLead, 1).estimate.randomUpliftBps).not.toBe(
      getSubmittedPayload(submitLead).estimate.randomUpliftBps,
    );
    expect(getSubmittedPayload(submitLead, 1).requestId).not.toBe(
      getSubmittedPayload(submitLead).requestId,
    );
    expect(getSubmittedPayload(submitLead, 1).estimate.employeeCount).toBe(26);
  });
});
