import { EMBED_PROTOCOL, isEmbedMessage, type EmbedMessage } from "./embed-protocol";

declare const EMBED_PAGE_RELATIVE: string;
type Mount = { unmount: () => boolean };
type EmbedApi = { mount: (container: HTMLElement) => Mount };
declare global {
  interface Window {
    FourRefundEmbed?: EmbedApi;
  }
}

const script = document.currentScript;
if (!(script instanceof HTMLScriptElement)) throw new Error("embed_script_required");
const loaderUrl = script.src;
const pageUrl = new URL(EMBED_PAGE_RELATIVE, loaderUrl);
const mounts = new WeakMap<HTMLElement, Mount>();
let active: { requestClose: () => void } | null = null;

function mount(container: HTMLElement): Mount {
  const existing = mounts.get(container);
  if (existing) return existing;
  const originalNodes = [...container.childNodes];
  const originalHidden = new Map(
    originalNodes
      .filter((node): node is HTMLElement => node instanceof HTMLElement)
      .map((node) => [node, node.hidden]),
  );
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  status.textContent = "조회 화면을 준비하고 있습니다.";
  container.append(status);
  const fallback = document.createElement("a");
  fallback.href = `${pageUrl.href}?mode=standalone`;
  fallback.target = "_blank";
  fallback.rel = "noopener noreferrer";
  fallback.textContent = "별도 페이지에서 예상 환급액 조회하기";
  container.append(fallback);
  if (
    window.top !== window ||
    !window.crypto?.randomUUID ||
    !window.ResizeObserver ||
    typeof HTMLDialogElement === "undefined" ||
    !HTMLDialogElement.prototype.showModal
  ) {
    status.textContent = "이 설치 환경에서는 별도 페이지에서 조회해 주세요.";
    const unsupported = {
      unmount: () => {
        status.remove();
        fallback.remove();
        mounts.delete(container);
        return true;
      },
    };
    mounts.set(container, unsupported);
    return unsupported;
  }
  const instanceId = crypto.randomUUID();
  const shellHost = document.createElement("div");
  const shadow = shellHost.attachShadow({ mode: "open" });
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = new URL("./shell.css", loaderUrl).href;
  let cssReady = false;
  stylesheet.onload = () => {
    cssReady = true;
  };
  shadow.append(stylesheet);
  const dialog = document.createElement("dialog");
  dialog.setAttribute("aria-label", "포리펀드 예상 환급액 조회");
  const loading = document.createElement("p");
  loading.setAttribute("role", "status");
  loading.textContent = "조회 화면을 준비하고 있습니다.";
  const escape = document.createElement("button");
  escape.type = "button";
  escape.textContent = "화면 연결이 끊긴 경우 닫기";
  dialog.append(loading, escape);
  shadow.append(dialog);
  document.body.append(shellHost);

  let flow: FrameSession | null = null;
  let state: "IDLE" | "BUSY" | "UNCERTAIN" = "IDLE";
  let attempted = false;
  let previousFocus: HTMLElement | null = null;
  let restoreScroll = () => {};
  let closeWatchdog = 0;
  type FrameSession = {
    frame: HTMLIFrameElement;
    id: string;
    ready: boolean;
    valid: boolean;
    stop: () => void;
    dispose: () => void;
    mode: "entry" | "flow";
    send: (type: "REQUEST_CLOSE" | "RESTORE_FOCUS") => void;
  };
  function createFrame(mode: "entry" | "flow"): FrameSession {
    const frame = document.createElement("iframe");
    frame.title =
      mode === "entry" ? "포리펀드 예상 환급액 조회 진입" : "포리펀드 예상 환급액 조회·상담 신청";
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    const id = crypto.randomUUID();
    const url = new URL(pageUrl);
    url.searchParams.set("mode", mode);
    url.searchParams.set("instance", instanceId);
    url.searchParams.set("session", id);
    if (container.dataset.diagnostic === "1") url.searchParams.set("diagnostic", "1");
    frame.src = url.href;
    frame.hidden = true;
    frame.style.width = "100%";
    frame.style.border = "0";
    const send = (type: "REQUEST_CLOSE" | "RESTORE_FOCUS") =>
      frame.contentWindow?.postMessage(
        {
          protocol: EMBED_PROTOCOL,
          instanceId,
          sessionId: id,
          type,
          data: null,
        } satisfies EmbedMessage,
        pageUrl.origin,
      );
    let timer = 0;
    let deadline = 0;
    const stop = () => {
      window.clearInterval(timer);
      window.clearTimeout(deadline);
    };
    const result: FrameSession = {
      frame,
      id,
      ready: false,
      valid: true,
      mode,
      stop,
      send,
      dispose: () => {
        result.valid = false;
        stop();
        frame.remove();
      },
    };
    let loaded = false;
    const fail = () => {
      stop();
      result.valid = false;
      result.ready = false;
      frame.hidden = true;
      if (mode === "entry") {
        status.hidden = false;
        status.textContent =
          "조회 화면 연결에 실패했습니다. 페이지를 새로 고치거나 아래 링크를 이용해 주세요.";
        fallback.hidden = false;
      } else {
        state = "UNCERTAIN";
        loading.hidden = false;
        loading.textContent = "조회 화면을 연결하지 못했습니다. 닫은 뒤 다시 열어 주세요.";
        escape.hidden = false;
      }
    };
    frame.addEventListener("load", () => {
      // 실패 뒤 늦은 load/READY와 다른 document는 세션을 부활시키지 않습니다.
      if (!result.valid) return;
      if (loaded) {
        fail();
        return;
      }
      loaded = true;
      const init = () =>
        frame.contentWindow?.postMessage(
          {
            protocol: EMBED_PROTOCOL,
            instanceId,
            sessionId: id,
            type: "INIT",
            data: { mode, siteOrigin: window.location.origin },
          } satisfies EmbedMessage,
          pageUrl.origin,
        );
      init();
      timer = window.setInterval(init, 250);
    });
    deadline = window.setTimeout(fail, 15_000);
    return result;
  }
  const entry = createFrame("entry");
  entry.frame.style.height = "540px";
  const entryHost = document.createElement("div");
  entryHost.attachShadow({ mode: "open" }).append(entry.frame);
  container.append(entryHost);

  function close() {
    window.clearTimeout(closeWatchdog);
    flow?.dispose();
    flow = null;
    if (dialog.open) dialog.close();
    restoreScroll();
    previousFocus?.focus();
    entry.send("RESTORE_FOCUS");
    active = null;
    state = "IDLE";
    attempted = false;
  }
  function requestClose() {
    if (flow?.ready) {
      flow.send("REQUEST_CLOSE");
      window.clearTimeout(closeWatchdog);
      closeWatchdog = window.setTimeout(() => {
        if (flow) escape.hidden = false;
      }, 20_000);
    } else if (!attempted) close();
    else escape.hidden = false;
  }
  escape.onclick = () => {
    if (
      !attempted ||
      window.confirm(
        "이전 신청의 접수 여부를 확인할 수 없습니다. 닫으면 같은 요청을 다시 시도할 수 없으며 새 신청은 중복 접수될 수 있습니다. 닫으시겠습니까?",
      )
    )
      close();
  };
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    requestClose();
  });
  function open() {
    if (active) {
      active.requestClose();
      return;
    }
    if (!cssReady || container.getBoundingClientRect().width < 320) {
      status.hidden = false;
      fallback.hidden = false;
      status.textContent =
        "설치 폭 또는 스타일 연결을 확인해 주세요. 별도 페이지에서도 조회할 수 있습니다.";
      return;
    }
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const x = window.scrollX;
    const y = window.scrollY;
    const bodyProperties = ["position", "top", "left", "width"];
    const oldBody = bodyProperties.map(
      (property) =>
        [
          property,
          document.body.style.getPropertyValue(property),
          document.body.style.getPropertyPriority(property),
        ] as const,
    );
    const oldHtml = document.documentElement.style.overflow;
    document.body.style.position = "fixed";
    document.body.style.top = `-${y}px`;
    document.body.style.left = `-${x}px`;
    document.body.style.width = "100%";
    document.documentElement.style.overflow = "hidden";
    restoreScroll = () => {
      oldBody.forEach(([property, value, priority]) => {
        if (value) document.body.style.setProperty(property, value, priority);
        else document.body.style.removeProperty(property);
      });
      document.documentElement.style.overflow = oldHtml;
      window.scrollTo(x, y);
      restoreScroll = () => {};
    };
    loading.hidden = false;
    escape.hidden = false;
    flow = createFrame("flow");
    dialog.prepend(flow.frame);
    dialog.showModal();
    active = { requestClose };
  }
  const receive = (event: MessageEvent<unknown>) => {
    if (
      event.origin !== pageUrl.origin ||
      !isEmbedMessage(event.data) ||
      event.data.instanceId !== instanceId
    )
      return;
    const message = event.data;
    const target = [entry, flow].find(
      (candidate) =>
        candidate &&
        event.source === candidate.frame.contentWindow &&
        candidate.id === message.sessionId,
    );
    if (!target || !target.valid) return;
    if (message.type === "READY") {
      target.ready = true;
      target.stop();
      target.frame.hidden = false;
      if (target === entry) {
        status.hidden = true;
        fallback.hidden = true;
        originalNodes.forEach((node) => {
          if (node instanceof HTMLElement) node.hidden = true;
        });
      } else {
        loading.hidden = true;
        escape.hidden = true;
        target.frame.focus();
      }
    }
    if (!target.ready) return;
    if (target === entry && message.type === "RESIZE")
      entry.frame.style.height = `${message.data.height}px`;
    if (target === entry && message.type === "OPEN") open();
    if (target === flow && message.type === "CLOSE_ALLOWED") close();
    if (
      target === flow &&
      (message.type === "BUSY" || message.type === "UNCERTAIN" || message.type === "IDLE")
    ) {
      state = message.type;
      if (state === "BUSY") attempted = true;
    }
  };
  window.addEventListener("message", receive);
  const resize = new ResizeObserver(() => {
    if (container.getBoundingClientRect().width < 320) {
      entry.frame.hidden = true;
      fallback.hidden = false;
      status.hidden = false;
      status.textContent = "가로 320px 이상 공간에 설치해 주세요.";
    } else if (entry.ready) {
      entry.frame.hidden = false;
      status.hidden = true;
      fallback.hidden = true;
    }
  });
  resize.observe(container);
  const result = {
    unmount: () => {
      if (flow) {
        requestClose();
        return false;
      }
      entry.dispose();
      resize.disconnect();
      window.removeEventListener("message", receive);
      entryHost.remove();
      shellHost.remove();
      status.remove();
      fallback.remove();
      originalHidden.forEach((hidden, node) => {
        node.hidden = hidden;
      });
      mounts.delete(container);
      return true;
    },
  };
  mounts.set(container, result);
  return result;
}

// 같은 loader 재삽입과 SPA mount는 기존 인스턴스를 재사용합니다.
window.FourRefundEmbed ??= { mount };
const target = script.dataset.target;
if (target) {
  const container = document.getElementById(target);
  if (container) window.FourRefundEmbed.mount(container);
}
