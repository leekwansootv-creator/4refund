import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { QuickEstimateFlow } from "./quick-estimate-flow.client";
import type { submitEstimateLead } from "../api/submit-estimate-lead";
import type { QuickEstimateSubmissionTransportResult } from "../types/lead-submission";

const REQUEST_IDS = [
  "0fca3874-40bc-4ea9-a7ad-742a062736ea",
  "f7258fe7-4319-4f0c-8c2b-dc0950282a45",
] as const;
const SUCCESS = {
  ok: true,
  leadId: "4d95c6c8-0217-44c7-9d84-e81842721767",
  duplicate: false,
} as const;
const originalShowModal = HTMLDialogElement.prototype.showModal;
const originalClose = HTMLDialogElement.prototype.close;
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

function renderFlow(
  results: QuickEstimateSubmissionTransportResult[] = [SUCCESS],
  endpoint = "https://example.test/submit",
  elapsed = 5_000,
) {
  let currentTime = 0;
  let requestIndex = 0;
  let randomValue = 0;
  const submitLead = vi.fn<typeof submitEstimateLead>(async () => {
    const result = results.shift();
    if (!result) throw new Error("테스트 결과가 부족합니다.");
    return result;
  });
  const randomSource = vi.fn((values: Uint32Array) => {
    values[0] = randomValue;
    randomValue += 100;
    return values;
  });
  const requestIdSource = vi.fn(() => REQUEST_IDS[requestIndex++ % 2] ?? REQUEST_IDS[0]);
  render(
    <QuickEstimateFlow
      endpoint={endpoint}
      consultHref="#contact"
      dependencies={{
        now: () => {
          currentTime += elapsed;
          return currentTime;
        },
        randomUpliftSource: { getRandomValues: randomSource },
        requestIdSource: { randomUUID: requestIdSource },
        submitLead,
      }}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "환급액 조회하기" }));
  return { submitLead, randomSource, requestIdSource };
}
function lookup(count = "25") {
  fireEvent.change(screen.getByLabelText("업종"), { target: { value: "N" } });
  fireEvent.change(screen.getByLabelText("직원 수"), { target: { value: count } });
  fireEvent.click(screen.getByRole("button", { name: "조회하기" }));
}
function fillContact(marketing = false) {
  fireEvent.change(screen.getByLabelText("회사명"), { target: { value: "검증 회사" } });
  fireEvent.change(screen.getByLabelText("담당자 이름"), { target: { value: "테스트" } });
  fireEvent.change(screen.getByLabelText("이메일"), { target: { value: "qa@example.test" } });
  fireEvent.change(screen.getByLabelText("전화번호"), { target: { value: "010-0000-0000" } });
  fireEvent.click(screen.getByLabelText("개인정보 처리 동의 (필수)"));
  if (marketing) fireEvent.click(screen.getByLabelText("마케팅 활용 동의 (선택)"));
}
function apply(marketing = false) {
  fireEvent.click(screen.getByRole("button", { name: "상세 견적 받기" }));
  fillContact(marketing);
}
function submit() {
  fireEvent.click(screen.getByRole("button", { name: "상세 견적 신청하기" }));
}

describe("선조회와 명시적인 상담 신청", () => {
  it("조회·재조회·신청 진입·입력·이전 이동은 전송과 요청 ID를 만들지 않는다", () => {
    const f = renderFlow();
    expect(screen.getByLabelText("업종")).toHaveFocus();
    expect(screen.queryByLabelText("회사명")).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    lookup();
    expect(screen.getByRole("region", { name: "간단 견적 조회 결과" })).toHaveFocus();
    const firstAmount = screen.getByText(/^[\d,]+원$/u).textContent;
    apply();
    expect(screen.getByText(firstAmount ?? "")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "결과로 돌아가기" }));
    fireEvent.click(screen.getByRole("button", { name: "상세 견적 받기" }));
    expect(screen.getByLabelText("회사명")).toHaveValue("검증 회사");
    expect(screen.getByLabelText("개인정보 처리 동의 (필수)")).toBeChecked();
    expect(f.randomSource).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "결과로 돌아가기" }));
    fireEvent.click(screen.getByRole("button", { name: "다시 조회하기" }));
    expect(screen.getByLabelText("직원 수")).toHaveValue("25");
    lookup("26");
    expect(f.randomSource).toHaveBeenCalledTimes(2);
    expect(f.requestIdSource).not.toHaveBeenCalled();
    expect(f.submitLead).not.toHaveBeenCalled();
    expect(screen.queryByText(/접수되었습니다/)).not.toBeInTheDocument();
  });

  it("필수 동의 후 한 번만 제출하며 화면의 금액·난수·버전을 그대로 전송한다", async () => {
    const f = renderFlow();
    lookup();
    const amount = screen.getByText(/^[\d,]+원$/u).textContent;
    apply();
    fireEvent.click(screen.getByLabelText("개인정보 처리 동의 (필수)"));
    expect(screen.getByRole("button", { name: "상세 견적 신청하기" })).toBeDisabled();
    expect(f.submitLead).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText("개인정보 처리 동의 (필수)"));
    submit();
    expect(await screen.findByText("상세 견적 신청이 접수되었습니다.")).toBeVisible();
    expect(f.submitLead).toHaveBeenCalledOnce();
    const payload = f.submitLead.mock.calls[0]?.[0];
    expect(payload).toMatchObject({
      requestId: REQUEST_IDS[0],
      estimate: {
        industryCode: "N",
        employeeCount: 25,
        randomUpliftBps: 100,
        ruleVersion: "estimate-rule-2026-08-25",
      },
      privacy: { agreed: true },
      marketing: { agreed: false, channels: [] },
      antiSpam: { honeypot: "", elapsedMs: 5000 },
      sourcePath: "/",
    });
    expect(`${payload?.estimate.amount.toLocaleString("ko-KR")}원`).toBe(amount);
    expect(f.randomSource).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "상세 견적 신청하기" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "다시 조회하기" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "상세 견적 접수 상태" })).toHaveFocus();
  });

  it("전송 중 중복 클릭·닫기·수정·이전 이동을 차단한다", async () => {
    const f = renderFlow();
    let resolve: ((v: QuickEstimateSubmissionTransportResult) => void) | undefined;
    f.submitLead.mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    lookup();
    apply();
    const button = screen.getByRole("button", { name: "상세 견적 신청하기" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(f.submitLead).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "간단 견적 닫기" })).toBeDisabled();
    expect(screen.queryByLabelText("회사명")).not.toBeInTheDocument();
    expect(screen.queryByText(/접수되었습니다/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "결과로 돌아가기" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("dialog"));
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(screen.getByRole("dialog")).toBeVisible();
    await act(async () => resolve?.(SUCCESS));
    expect(await screen.findByText("상세 견적 신청이 접수되었습니다.")).toBeVisible();
  });

  it.each(["timeout", "network", "unreadable_response"] as const)(
    "%s 후 동일 payload를 재시도하고 중복 성공을 완료로 표시한다",
    async (kind) => {
      const f = renderFlow([
        { ok: false, kind },
        { ...SUCCESS, duplicate: true },
      ]);
      lookup();
      apply(true);
      submit();
      expect(await screen.findByText(/접수 결과를 확인하지 못했습니다/)).toBeVisible();
      expect(screen.queryByRole("button", { name: "신청 정보 확인" })).not.toBeInTheDocument();
      const first = f.submitLead.mock.calls[0]?.[0];
      fireEvent.click(screen.getByRole("button", { name: "접수 다시 시도" }));
      expect(await screen.findByText("상세 견적 신청이 접수되었습니다.")).toBeVisible();
      expect(f.submitLead.mock.calls[1]?.[0]).toBe(first);
      expect(f.requestIdSource).toHaveBeenCalledOnce();
      expect(f.randomSource).toHaveBeenCalledOnce();
    },
  );

  it("미확인 요청이 다음 재시도에서 거절돼도 이전 불확실성과 닫기 경고를 유지한다", async () => {
    const f = renderFlow([
      { ok: false, kind: "timeout" },
      { ok: false, kind: "validation", code: "INVALID_INPUT" },
      SUCCESS,
    ]);
    lookup();
    apply();
    submit();
    await screen.findByText(/접수 결과를 확인하지 못했습니다/);
    fireEvent.click(screen.getByRole("button", { name: "접수 다시 시도" }));
    await waitFor(() => expect(f.submitLead).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "접수 다시 시도" })).toBeVisible(),
    );
    fireEvent.click(screen.getByRole("button", { name: "간단 견적 닫기" }));
    expect(screen.getByRole("alert")).toHaveTextContent("중복 접수될 수 있습니다");
    fireEvent.click(screen.getByRole("button", { name: "간단 견적 닫기" }));
    expect(screen.getByRole("dialog")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "돌아가서 접수 확인" }));
    fireEvent.click(screen.getByRole("button", { name: "접수 다시 시도" }));
    await screen.findByText("상세 견적 신청이 접수되었습니다.");
    expect(f.submitLead.mock.calls[2]?.[0]).toBe(f.submitLead.mock.calls[0]?.[0]);
  });

  it.each(["STORAGE_UNAVAILABLE", "RATE_LIMITED", "INTERNAL_ERROR"] as const)(
    "%s에서 완료로 오인하지 않고 같은 요청을 재시도한다",
    async (code) => {
      const f = renderFlow([{ ok: false, kind: "server", code }, SUCCESS]);
      lookup();
      apply();
      submit();
      await screen.findByRole("button", { name: "접수 다시 시도" });
      expect(screen.queryByText(/접수되었습니다/)).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "접수 다시 시도" }));
      await screen.findByText("상세 견적 신청이 접수되었습니다.");
      expect(f.submitLead.mock.calls[1]?.[0]).toBe(f.submitLead.mock.calls[0]?.[0]);
    },
  );

  it.each(["INVALID_INPUT", "INVALID_CONSENT"] as const)(
    "%s 거절 뒤 수정 신청은 같은 견적과 새 요청 ID를 쓴다",
    async (code) => {
      const f = renderFlow([{ ok: false, kind: "validation", code }, SUCCESS]);
      lookup();
      apply(true);
      submit();
      fireEvent.click(await screen.findByRole("button", { name: "신청 정보 확인" }));
      fireEvent.change(screen.getByLabelText("회사명"), { target: { value: "수정 회사" } });
      submit();
      await screen.findByText("상세 견적 신청이 접수되었습니다.");
      expect(f.submitLead.mock.calls[1]?.[0].estimate).toEqual(
        f.submitLead.mock.calls[0]?.[0].estimate,
      );
      expect(f.submitLead.mock.calls[1]?.[0].requestId).toBe(REQUEST_IDS[1]);
      expect(f.submitLead.mock.calls[1]?.[0].marketing).toMatchObject({
        agreed: true,
        channels: ["EMAIL", "SMS"],
      });
    },
  );

  it("규칙 거절은 새 결과를 먼저 확인한 후에만 신청할 수 있다", async () => {
    const f = renderFlow([{ ok: false, kind: "validation", code: "UNSUPPORTED_RULE" }, SUCCESS]);
    lookup();
    apply();
    submit();
    fireEvent.click(await screen.findByRole("button", { name: "다시 조회하기" }));
    lookup("26");
    expect(f.submitLead).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "상세 견적 받기" }));
    submit();
    await screen.findByText("상세 견적 신청이 접수되었습니다.");
    expect(f.submitLead.mock.calls[1]?.[0].estimate.employeeCount).toBe(26);
    expect(f.randomSource).toHaveBeenCalledTimes(2);
  });

  it("장시간 열린 폼은 전송 없이 새 시작을 요구한다", () => {
    const f = renderFlow([SUCCESS], undefined, 7_200_001);
    lookup();
    apply();
    submit();
    expect(f.submitLead).not.toHaveBeenCalled();
    expect(screen.getByText(/입력 가능 시간이 지났습니다/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "처음부터 다시 시작" }));
    expect(screen.getByLabelText("직원 수")).toHaveValue("");
  });

  it("3초 미만 제출과 허니팟 입력은 전송하지 않는다", () => {
    const f = renderFlow([SUCCESS], undefined, 100);
    lookup();
    apply();
    submit();
    expect(f.submitLead).not.toHaveBeenCalled();
    expect(screen.getByText(/잠시 후 신청해 주세요/)).toBeVisible();
  });

  it("허니팟을 시간 보정 없이 최종 검증한다", () => {
    const f = renderFlow();
    lookup();
    apply();
    const trap = document.querySelector('input[name="company-website"]');
    if (!trap) throw new Error("trap 없음");
    fireEvent.change(trap, { target: { value: "spam" } });
    submit();
    expect(f.submitLead).not.toHaveBeenCalled();
    expect(screen.getByText("입력 정보와 동의를 확인해 주세요.")).toBeVisible();
  });

  it("전송 port의 예기치 않은 예외도 미확인 요청으로 보존한다", async () => {
    const f = renderFlow();
    f.submitLead.mockRejectedValueOnce(new Error("failure"));
    lookup();
    apply();
    submit();
    await screen.findByText(/접수 결과를 확인하지 못했습니다/);
    fireEvent.click(screen.getByRole("button", { name: "접수 다시 시도" }));
    await screen.findByText("상세 견적 신청이 접수되었습니다.");
    expect(f.submitLead.mock.calls[1]?.[0]).toBe(f.submitLead.mock.calls[0]?.[0]);
  });

  it("닫고 재진입하면 조건·연락처·동의·견적을 초기화한다", () => {
    const f = renderFlow();
    lookup();
    apply();
    fireEvent.click(screen.getByRole("button", { name: "간단 견적 닫기" }));
    fireEvent.click(screen.getByRole("button", { name: "환급액 조회하기" }));
    expect(screen.getByLabelText("직원 수")).toHaveValue("");
    lookup();
    fireEvent.click(screen.getByRole("button", { name: "상세 견적 받기" }));
    expect(screen.getByLabelText("회사명")).toHaveValue("");
    expect(screen.getByLabelText("개인정보 처리 동의 (필수)")).not.toBeChecked();
    expect(f.submitLead).not.toHaveBeenCalled();
  });

  it("endpoint 없이도 조회하고 신청 입력 대신 문의 경로를 제공한다", () => {
    const f = renderFlow([], "");
    lookup();
    expect(screen.getByRole("region", { name: "간단 견적 조회 결과" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "상세 견적 받기" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "문의하기" }));
    expect(window.location.hash).toBe("#contact");
    expect(f.submitLead).not.toHaveBeenCalled();
  });
});
