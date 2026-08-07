"use client";

import Image from "next/image";
import type { MouseEvent, ReactNode } from "react";
import { useEffect, useId, useRef } from "react";

import styles from "./quick-estimate-dialog.module.css";
import { QUICK_ESTIMATE_ASSETS } from "../constants/quick-estimate-assets";

type QuickEstimateDialogProps = {
  children: ReactNode;
  open: boolean;
  title: string;
  titleVariant?: "contact" | "estimate";
  closeDisabled?: boolean;
  onClose: () => void;
};

/**
 * 단계별 간단 견적 내용을 native modal dialog로 감싸고 focus와 배경 scroll을 관리합니다.
 */
export function QuickEstimateDialog({
  children,
  open,
  title,
  titleVariant = "estimate",
  closeDisabled = false,
  onClose,
}: QuickEstimateDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog || !open) {
      return;
    }

    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    if (!dialog.open) {
      dialog.showModal();
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.querySelector<HTMLElement>("[data-dialog-initial-focus]")?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;

      if (dialog.open) {
        dialog.close();
      }

      returnFocusRef.current?.focus();
    };
  }, [open]);

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (!closeDisabled && event.target === event.currentTarget) {
      onClose();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className={styles.dialog}
      onCancel={(event) => {
        event.preventDefault();

        if (!closeDisabled) {
          onClose();
        }
      }}
      onClick={handleBackdropClick}
    >
      <div className={styles.dialogCard}>
        <header className="flex shrink-0 items-center">
          <span aria-hidden="true" className="size-11" />
          <h2
            id={titleId}
            className={`min-w-0 flex-1 text-center font-bold text-[#111118] ${
              titleVariant === "contact" ? "text-[22px]" : "text-lg"
            }`}
          >
            {title}
          </h2>
          <button
            type="button"
            aria-label="간단 견적 닫기"
            disabled={closeDisabled}
            className={styles.closeButton}
            onClick={onClose}
          >
            <Image src={QUICK_ESTIMATE_ASSETS.icons.close} alt="" width={20} height={20} />
          </button>
        </header>
        <div className={styles.dialogBody}>{children}</div>
      </div>
    </dialog>
  );
}
