import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { QuickEstimateConsents } from "./estimate-consents";
import { QuickEstimateContactStep } from "./contact-step";
import { QuickEstimateResultStep } from "./estimate-result-step";
import { QuickEstimateEstimateStep } from "./estimate-step";
import type {
  QuickEstimateContactValues,
  QuickEstimateConsentValues,
  QuickEstimateFormValues,
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
};

const EMPTY_CONSENT_VALUES: QuickEstimateConsentValues = {
  privacyAgreed: false,
  marketingAgreed: false,
};

function ContactHarness({ onNext }: { onNext: () => void }) {
  const [consents, setConsents] = useState(EMPTY_CONSENT_VALUES);
  const [values, setValues] = useState(EMPTY_CONTACT_VALUES);

  return (
    <QuickEstimateContactStep
      values={values}
      onChange={(field, value) => setValues((current) => ({ ...current, [field]: value }))}
      consentValues={consents}
      onConsentChange={(field, value) => setConsents((current) => ({ ...current, [field]: value }))}
      onBack={vi.fn()}
      onSubmit={onNext}
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

    const nextButton = screen.getByRole("button", { name: "상세 견적 신청하기" });
    expect(nextButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText("회사명"), { target: { value: "테스트 주식회사" } });
    fireEvent.change(screen.getByLabelText("담당자 이름"), { target: { value: "김테스트" } });
    fireEvent.change(screen.getByLabelText("이메일"), {
      target: { value: "contact@example.com" },
    });
    fireEvent.change(screen.getByLabelText("전화번호"), { target: { value: "010-1234-5678" } });

    expect(nextButton).toBeDisabled();
    fireEvent.click(screen.getByLabelText("개인정보 처리 동의 (필수)"));
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
        consentValues={EMPTY_CONSENT_VALUES}
        onConsentChange={vi.fn()}
        onBack={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    const email = screen.getByLabelText("이메일");
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveAccessibleDescription("이메일 형식을 확인해 주세요.");
  });
});

describe("QuickEstimateEstimateStep", () => {
  it.each(["0", "6001", "1.5", "잘못된 값"])(
    "직원 수 %s는 계산하지 않고 오류를 입력에 연결한다",
    (value) => {
      const onLookup = vi.fn();
      render(<EstimateHarness onLookup={onLookup} />);
      fireEvent.change(screen.getByLabelText("업종"), { target: { value: "N" } });
      fireEvent.change(screen.getByLabelText("직원 수"), { target: { value } });
      expect(screen.getByLabelText("직원 수")).toHaveAttribute("aria-invalid", "true");
      expect(screen.getByRole("button", { name: "조회하기" })).toBeDisabled();
      expect(onLookup).not.toHaveBeenCalled();
    },
  );
  it("용역·파견·시설관리업을 첫 번째로 둔 KSIC 대분류 21개를 표시한다", () => {
    render(<EstimateHarness onLookup={vi.fn()} />);

    const options = screen.getAllByRole("option");

    expect(options).toHaveLength(22);
    expect(options.slice(1).map((option) => option.getAttribute("value"))).toEqual([
      "N",
      "T",
      "F",
      "O",
      "B",
      "P",
      "U",
      "K",
      "A",
      "G",
      "Q",
      "L",
      "E",
      "I",
      "R",
      "H",
      "D",
      "M",
      "J",
      "C",
      "S",
    ]);
    expect(options[1]).toHaveTextContent("용역·파견·시설관리업");
  });

  it("연락처나 동의 없이 계산 조건만으로 조회를 허용한다", () => {
    const onLookup = vi.fn();
    render(<EstimateHarness onLookup={onLookup} />);

    const lookupButton = screen.getByRole("button", { name: "조회하기" });
    fireEvent.change(screen.getByLabelText("업종"), { target: { value: "N" } });
    fireEvent.change(screen.getByLabelText("직원 수"), { target: { value: "25" } });

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(lookupButton).toBeEnabled();
    fireEvent.click(lookupButton);
    expect(onLookup).toHaveBeenCalledOnce();
  });

  it("개인정보와 마케팅 전문을 별도로 펼쳐 승인 문구를 표시한다", () => {
    render(<QuickEstimateConsents values={EMPTY_CONSENT_VALUES} onChange={vi.fn()} />);

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
  it("접수 완료 없이 참고용 결과와 신청 진입을 표시한다", () => {
    const onApply = vi.fn();
    render(
      <QuickEstimateResultStep
        amount={2480000}
        employeeCount={25}
        industryLabel="용역·파견·시설관리업"
        onApply={onApply}
        onConsult={vi.fn()}
        onRestart={vi.fn()}
      />,
    );
    expect(screen.getByText("2,480,000원")).toBeVisible();
    expect(screen.getByText(/참고용 예상값/)).toBeVisible();
    expect(screen.queryByText(/접수되었습니다/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "상세 견적 받기" }));
    expect(onApply).toHaveBeenCalledOnce();
  });
});
