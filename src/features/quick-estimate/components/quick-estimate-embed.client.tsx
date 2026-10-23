"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { QuickEstimateEnvelope } from "./quick-estimate-envelope";
import { QuickEstimateHeroAction } from "./quick-estimate-hero-action";
import { QuickEstimateFlow } from "./quick-estimate-flow.client";
import {
  EMBED_PROTOCOL,
  EMBED_RELEASE,
  isEmbedMessage,
  type EmbedMessage,
} from "../lib/embed-protocol";
import { observeAttribution, type SubmissionAttribution } from "../lib/submission-attribution";
import styles from "./quick-estimate-embed.module.css";

type Session = {
  mode: "entry" | "flow" | "inline" | "standalone";
  instanceId: string;
  sessionId: string;
  parentOrigin: string | null;
  attribution: SubmissionAttribution;
  consultHref: string;
  diagnostic: boolean;
  demo: boolean;
};

/** iframe의 실제 부모 origin만 관측하고 조회·상담 데이터는 부모에 반환하지 않습니다. */
export function QuickEstimateEmbed({ endpoint }: { endpoint: string }) {
  const [session, setSession] = useState<Session | null>(null);
  const [localOpen, setLocalOpen] = useState(false);
  const [hasClosedLocally, setHasClosedLocally] = useState(false);
  const [failed, setFailed] = useState(false);
  const current = useRef<Session | null>(null);
  const entryRef = useRef<HTMLElement>(null);
  const [closeListeners] = useState(() => new Set<() => void>());

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get("mode") ?? "standalone";
    const allowedOrigins = (process.env.NEXT_PUBLIC_EMBED_ALLOWED_ORIGINS ?? "")
      .split(",")
      .filter(Boolean);
    const consultHref = `${process.env.NEXT_PUBLIC_SITE_ORIGIN || window.location.origin}${process.env.NEXT_PUBLIC_SITE_BASE_PATH ?? process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/#contact`;
    document.documentElement.classList.add("fourrefund-embed-document");
    const initialize = (next: Session) => {
      current.current = next;
      setSession(next);
    };
    const timeout = window.setTimeout(() => {
      if (!current.current) setFailed(true);
    }, 15_000);
    if (mode === "inline" || mode === "standalone") {
      initialize({
        mode,
        instanceId: "local",
        sessionId: "local",
        parentOrigin: null,
        consultHref,
        diagnostic: params.get("diagnostic") === "1",
        demo: params.get("demo") === "1",
        attribution:
          mode === "inline"
            ? observeAttribution("embed", "referrer", document.referrer, { allowedOrigins })
            : observeAttribution("hosted", "configured", params.get("site_origin") ?? "", {
                allowedOrigins,
              }),
      });
    }
    const receive = (event: MessageEvent<unknown>) => {
      if (
        event.source !== window.parent ||
        window.parent === window ||
        event.origin === "null" ||
        !isEmbedMessage(event.data)
      )
        return;
      const message = event.data;
      if (
        message.instanceId !== params.get("instance") ||
        message.sessionId !== params.get("session")
      )
        return;
      if (
        !current.current &&
        message.type === "INIT" &&
        message.data.mode === mode &&
        (mode === "entry" || mode === "flow")
      ) {
        initialize({
          mode,
          instanceId: message.instanceId,
          sessionId: message.sessionId,
          parentOrigin: event.origin,
          consultHref,
          diagnostic: params.get("diagnostic") === "1",
          demo: params.get("demo") === "1",
          attribution: observeAttribution("embed", "parent_message", event.origin, {
            allowedOrigins,
          }),
        });
      }
      const active = current.current;
      if (!active || active.parentOrigin !== event.origin) return;
      if (message.type === "INIT")
        window.parent.postMessage(
          {
            protocol: EMBED_PROTOCOL,
            instanceId: active.instanceId,
            sessionId: active.sessionId,
            type: "READY",
            data: { release: EMBED_RELEASE },
          } satisfies EmbedMessage,
          active.parentOrigin,
        );
      if (message.type === "REQUEST_CLOSE") closeListeners.forEach((listener) => listener());
      if (message.type === "RESTORE_FOCUS") entryRef.current?.querySelector("button")?.focus();
    };
    window.addEventListener("message", receive);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("message", receive);
      document.documentElement.classList.remove("fourrefund-embed-document");
      current.current = null;
    };
  }, [closeListeners]);

  const bridge = useMemo(() => {
    if (!session) return undefined;
    const send = (type: "OPEN" | "CLOSE_ALLOWED" | "BUSY" | "UNCERTAIN" | "IDLE") => {
      if (session.parentOrigin)
        window.parent.postMessage(
          {
            protocol: EMBED_PROTOCOL,
            instanceId: session.instanceId,
            sessionId: session.sessionId,
            type,
            data: null,
          } satisfies EmbedMessage,
          session.parentOrigin,
        );
    };
    return {
      attribution: session.attribution,
      subscribeClose: (handler: () => void) => {
        closeListeners.add(handler);
        return () => {
          closeListeners.delete(handler);
        };
      },
      onClose: () => {
        send("CLOSE_ALLOWED");
        if (session.parentOrigin === null) setHasClosedLocally(true);
        setLocalOpen(false);
      },
      onStatus: (status: "BUSY" | "UNCERTAIN" | "IDLE") => send(status),
      open: () => {
        if (session.parentOrigin) send("OPEN");
        else setLocalOpen(true);
      },
    };
  }, [session, closeListeners]);

  useEffect(() => {
    if (!localOpen && hasClosedLocally) {
      entryRef.current?.querySelector("button")?.focus();
    }
  }, [localOpen, hasClosedLocally]);

  useEffect(() => {
    if (session?.mode !== "entry" || !session.parentOrigin || !entryRef.current) return;
    let lastHeight = 0;
    const observer = new ResizeObserver(([entry]) => {
      const height = Math.max(
        200,
        Math.min(900, Math.ceil(entry?.borderBoxSize[0]?.blockSize ?? 540)),
      );
      if (height === lastHeight) return;
      lastHeight = height;
      window.parent.postMessage(
        {
          protocol: EMBED_PROTOCOL,
          instanceId: session.instanceId,
          sessionId: session.sessionId,
          type: "RESIZE",
          data: { height },
        } satisfies EmbedMessage,
        session.parentOrigin ?? "",
      );
    });
    observer.observe(entryRef.current);
    return () => observer.disconnect();
  }, [session]);

  if (!session || !bridge)
    return (
      <p role="status">
        {failed
          ? "조회 화면을 연결하지 못했습니다. 원래 페이지에서 다시 열어 주세요."
          : "조회 화면을 준비하고 있습니다."}
      </p>
    );
  const showingFlow = session.mode === "flow" || localOpen;
  return (
    <main ref={entryRef}>
      {showingFlow ? (
        <QuickEstimateFlow
          endpoint={session.demo ? "" : endpoint}
          consultHref={session.consultHref}
          embedded={bridge}
        />
      ) : (
        <div className={styles.entry}>
          <QuickEstimateEnvelope action={<QuickEstimateHeroAction onClick={bridge.open} />} />
        </div>
      )}
      {session.diagnostic && !showingFlow ? (
        <output>
          모듈 {EMBED_RELEASE} · {session.attribution.siteOrigin ?? "확인 불가"} ·{" "}
          {session.attribution.collectionMethod} · 준비 완료
        </output>
      ) : null}
    </main>
  );
}
