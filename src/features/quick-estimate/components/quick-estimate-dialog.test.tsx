import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { QuickEstimateDialog } from "./quick-estimate-dialog";

const originalShowModal = HTMLDialogElement.prototype.showModal;
const originalClose = HTMLDialogElement.prototype.close;

function DialogHarness() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        견적 열기
      </button>
      <QuickEstimateDialog open={open} title="정보를 입력해 주세요" onClose={() => setOpen(false)}>
        <label htmlFor="dialog-test-input">회사명</label>
        <input id="dialog-test-input" data-dialog-initial-focus />
      </QuickEstimateDialog>
    </>
  );
}

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

describe("QuickEstimateDialog", () => {
  it("dialog를 열 때 첫 입력으로 이동하고 닫은 뒤 trigger에 focus를 돌려준다", () => {
    render(<DialogHarness />);

    const trigger = screen.getByRole("button", { name: "견적 열기" });
    trigger.focus();
    fireEvent.click(trigger);

    expect(screen.getByRole("dialog")).toHaveAttribute("open");
    expect(screen.getByLabelText("회사명")).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.click(screen.getByRole("button", { name: "간단 견적 닫기" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).toBe("");
  });

  it("native cancel event를 닫기 요청으로 처리한다", () => {
    render(<DialogHarness />);

    fireEvent.click(screen.getByRole("button", { name: "견적 열기" }));
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { bubbles: true, cancelable: true }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
