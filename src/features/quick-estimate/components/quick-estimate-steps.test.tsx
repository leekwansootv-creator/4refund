import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { QuickEstimateContactStep } from "./contact-step";
import { QuickEstimateResultStep } from "./estimate-result-step";
import { QuickEstimateEstimateStep } from "./estimate-step";
import type {
  QuickEstimateContactValues,
  QuickEstimateFormValues,
  QuickEstimateResultFeedback,
} from "../types/quick-estimate-ui";

const EMPTY_CONTACT_VALUES: QuickEstimateContactValues = {
  companyName: "",
  contactName: "",
  email: "",
  phone: "",
};

const EMPTY_ESTIMATE_VALUES: QuickEstimateFormValues = {
  industryCode: "",
  employeeCount: "",
  privacyAgreed: false,
  marketingAgreed: false,
};

function ContactHarness({ onNext }: { onNext: () => void }) {
  const [values, setValues] = useState(EMPTY_CONTACT_VALUES);

  return (
    <QuickEstimateContactStep
      values={values}
      onChange={(field, value) => setValues((current) => ({ ...current, [field]: value }))}
      onNext={onNext}
    />
  );
}

function EstimateHarness({ onLookup }: { onLookup: () => void }) {
  const [values, setValues] = useState(EMPTY_ESTIMATE_VALUES);

  function handleChange<Field extends keyof QuickEstimateFormValues>(
    field: Field,
    value: QuickEstimateFormValues[Field],
  ) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  return <QuickEstimateEstimateStep values={values} onChange={handleChange} onLookup={onLookup} />;
}

describe("QuickEstimateContactStep", () => {
  it("승인된 네 연락처 필드가 유효할 때만 다음 단계를 허용한다", () => {
    const onNext = vi.fn();
    render(<ContactHarness onNext={onNext} />);

    const nextButton = screen.getByRole("button", { name: "다음" });
    expect(nextButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText("회사명"), { target: { value: "테스트 주식회사" } });
    fireEvent.change(screen.getByLabelText("담당자 이름"), { target: { value: "김테스트" } });
    fireEvent.change(screen.getByLabelText("이메일"), {
      target: { value: "contact@example.com" },
    });
    fireEvent.change(screen.getByLabelText("전화번호"), { target: { value: "010-1234-5678" } });

    expect(nextButton).toBeEnabled();
    fireEvent.click(nextButton);
    expect(onNext).toHaveBeenCalledOnce();
  });

  it("오류 표시 상태에서 잘못된 이메일을 입력과 연결한다", () => {
    render(
      <QuickEstimateContactStep
        values={{ ...EMPTY_CONTACT_VALUES, email: "invalid-email" }}
        showErrors
        onChange={vi.fn()}
        onNext={vi.fn()}
      />,
    );

    const email = screen.getByLabelText("이메일");
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveAccessibleDescription("이메일 형식을 확인해 주세요.");
  });
});

describe("QuickEstimateEstimateStep", () => {
  it("마케팅에 동의하지 않아도 계산 조건과 개인정보 동의만으로 조회를 허용한다", () => {
    const onLookup = vi.fn();
    render(<EstimateHarness onLookup={onLookup} />);

    const lookupButton = screen.getByRole("button", { name: "조회하기" });
    fireEvent.change(screen.getByLabelText("업종"), { target: { value: "software_it" } });
    fireEvent.change(screen.getByLabelText("직원 수"), { target: { value: "25" } });

    expect(lookupButton).toBeDisabled();
    fireEvent.click(screen.getByLabelText("개인정보 처리 동의 (필수)"));

    expect(screen.getByLabelText("마케팅 활용 동의 (선택)")).not.toBeChecked();
    expect(lookupButton).toBeEnabled();
    fireEvent.click(lookupButton);
    expect(onLookup).toHaveBeenCalledOnce();
  });

  it("개인정보와 마케팅 전문을 별도로 펼쳐 승인 문구를 표시한다", () => {
    render(<EstimateHarness onLookup={vi.fn()} />);

    const disclosureButtons = screen.getAllByRole("button", { name: "[보기]" });
    const privacyDisclosure = disclosureButtons.at(0);
    const marketingDisclosure = disclosureButtons.at(1);

    if (!privacyDisclosure || !marketingDisclosure) {
      throw new Error("두 동의 전문 보기 버튼이 필요합니다.");
    }

    fireEvent.click(privacyDisclosure);
    fireEvent.click(marketingDisclosure);

    expect(screen.getByText("보유 기간: 접수일부터 1년")).toBeInTheDocument();
    expect(screen.getByText("이용 채널: 이메일, 문자(SMS)")).toBeInTheDocument();
    expect(screen.getByText(/동의하지 않아도 예상 견적 확인/)).toBeInTheDocument();
  });
});

describe("QuickEstimateResultStep", () => {
  function renderResult(feedback: QuickEstimateResultFeedback) {
    return render(
      <QuickEstimateResultStep
        amount={2_480_000}
        employeeCount={25}
        industryLabel="IT·소프트웨어"
        feedback={feedback}
        onConsult={vi.fn()}
        onRestart={vi.fn()}
      />,
    );
  }

  it("계산 근거를 과장하지 않은 참고용 결과를 표시한다", () => {
    renderResult({ status: "idle" });

    expect(screen.getByText("2,480,000원")).toBeInTheDocument();
    expect(screen.getByText(/참고용 예상값/)).toBeInTheDocument();
    expect(screen.queryByText(/3년/)).not.toBeInTheDocument();
  });

  it.each([
    ["submitting", "상담 신청을 접수하고 있습니다."],
    ["succeeded", "상담 신청이 접수되었습니다."],
  ] as const)("%s 접수 상태를 별도 feedback으로 표시한다", (status, message) => {
    renderResult({ status });
    expect(screen.getByText(message)).toBeInTheDocument();
  });

  it("실패 상태에서 입력 유지 안내와 재시도 action을 제공한다", () => {
    const onRetry = vi.fn();
    renderResult({ status: "failed", onRetry });

    expect(screen.getByText(/입력 내용은 유지됩니다/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "접수 다시 시도" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
