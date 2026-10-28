import { afterEach, expect, it, vi } from "vitest";
import { SIDEBAR_HTML } from "./sidebar";

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  document.documentElement.innerHTML = "<head></head><body></body>";
});

it("관리 화면은 후보를 수동 적용하고 저장 뒤 게시하며, 수집 실패시 입력값을 유지한다", async () => {
  const calls: { action: string; title?: string; imageChoice?: string }[] = [];
  const record = {
    id: "id",
    etag: "v1",
    url: "https://news.example.org/",
    status: "초안",
    title: "수동 제목",
    image: "",
    candidateTitle: "<img src=x onerror=alert(1)>",
    candidateImage: "",
    warning: "IMAGE_MISSING",
    firstPublishedAt: "",
  };
  document.documentElement.innerHTML = SIDEBAR_HTML;
  const runner = {
    callback: (value: unknown) => {
      void value;
    },
    withSuccessHandler(callback: (value: unknown) => void) {
      this.callback = callback;
      return this;
    },
    withFailureHandler() {
      return this;
    },
    newsList() {
      this.callback({ ok: true, data: [record] });
    },
    newsMutate(command: { action: string; title?: string; imageChoice?: string }) {
      calls.push(command);
      if (command.action === "fetch") {
        this.callback({ ok: false, message: "수집 실패" });
        return;
      }
      if (command.title !== undefined) record.title = command.title;
      this.callback({ ok: true, data: { ...record } });
    },
  };
  // 저장소의 정적 사이드바만 실행한다. 외부 원문이나 HTML 응답을 실행하지 않는다.
  new Function("google", document.querySelector("script")!.textContent)({
    script: { run: runner },
  });
  const settle = async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  };
  const button = (id: string) => document.getElementById(id) as HTMLButtonElement;
  await settle();
  const select = document.getElementById("articles") as HTMLSelectElement;
  select.value = "id";
  select.dispatchEvent(new Event("change"));
  expect(document.querySelector("#candidateTitle img")).toBeNull();
  button("useTitle").click();
  expect((document.getElementById("title") as HTMLTextAreaElement).value).toBe(
    record.candidateTitle,
  );
  button("publish").click();
  await settle();
  expect(calls.map((call) => call.action)).toEqual(["save", "publish"]);
  button("fetch").click();
  await settle();
  expect(document.getElementById("status")?.textContent).toBe("수집 실패");
  expect((document.getElementById("title") as HTMLTextAreaElement).value).toBe(
    record.candidateTitle,
  );
  expect(button("fetch").disabled).toBe(false);
  document.documentElement.innerHTML = "<head></head><body></body>";
});

async function queuedSidebar() {
  vi.useFakeTimers();
  let record = {
    id: "id",
    etag: "v1",
    url: "https://news.example.org/",
    status: "게시",
    title: "저장한 제목",
    image: "",
    candidateTitle: "이전 후보",
    candidateImage: "old",
    warning: "",
    firstPublishedAt: "2026-10-27",
    collection: { status: "queued" },
  };
  let reply: (value: unknown) => void = () => {};
  const collection = vi.fn();
  const calls: Record<string, string>[] = [];
  const runner = {
    withSuccessHandler(callback: (value: unknown) => void) {
      return {
        withFailureHandler() {
          return this;
        },
        newsList() {
          callback({ ok: true, data: [structuredClone(record)] });
        },
        newsCollectionStatus() {
          collection();
          reply = callback;
        },
        newsMutate(command: Record<string, string>) {
          calls.push(command);
          record = { ...record, title: command.title ?? record.title, etag: "saved" };
          callback({ ok: true, data: structuredClone(record) });
        },
      };
    },
  };
  document.documentElement.innerHTML = SIDEBAR_HTML;
  new Function("google", document.querySelector("script")!.textContent)({
    script: { run: runner },
  });
  await vi.advanceTimersByTimeAsync(0);
  const field = (id: string) => document.getElementById(id) as HTMLInputElement;
  field("articles").value = "id";
  field("articles").dispatchEvent(new Event("change"));
  return {
    field,
    calls,
    collection,
    poll: () => vi.advanceTimersByTimeAsync(15_000),
    finish: async (status = "succeeded", withRecord = true) => {
      reply({
        ok: true,
        data: {
          status,
          ...(withRecord
            ? {
                record: {
                  ...record,
                  etag: "collected",
                  candidateTitle: "새 후보",
                  candidateImage: "new",
                  collection: { status },
                },
              }
            : {}),
        },
      });
      await vi.advanceTimersByTimeAsync(0);
    },
  };
}

it("늦게 받은 후보는 저장하지 않은 제목을 유지하고 새 이미지의 재검토를 요구한다", async () => {
  const f = await queuedSidebar();
  await f.poll();
  f.field("title").value = "수집 중 입력한 제목";
  f.field("title").dispatchEvent(new Event("input"));
  f.field("imageChoice").value = "candidate";
  f.field("imageChoice").dispatchEvent(new Event("change"));
  await f.finish();
  expect(f.field("title").value).toBe("수집 중 입력한 제목");
  expect(f.field("candidateTitle").textContent).toBe("새 후보");
  expect(f.field("imageChoice").value).toBe("keep");
  expect(f.field("status").textContent).toContain("이미지 후보가 바뀌었습니다");
  expect(f.calls).toHaveLength(0);
});

it("상태 조회보다 나중에 저장한 편집본을 오래된 응답으로 덮어쓰지 않는다", async () => {
  const f = await queuedSidebar();
  await f.poll();
  f.field("title").value = "새로 저장한 제목";
  f.field("title").dispatchEvent(new Event("input"));
  f.field("save").click();
  await vi.advanceTimersByTimeAsync(0);
  await f.finish();
  expect(f.field("candidateTitle").textContent).toBe("이전 후보");
  expect(f.field("title").value).toBe("새로 저장한 제목");
  f.field("save").click();
  await vi.advanceTimersByTimeAsync(0);
  expect(f.calls[1]?.etag).toBe("saved");
});

it.each(["none", "failed"])("종료된 상태 %s는 무한히 다시 조회하지 않는다", async (status) => {
  const f = await queuedSidebar();
  await f.poll();
  await f.finish(status, false);
  await vi.advanceTimersByTimeAsync(60_000);
  expect(f.collection).toHaveBeenCalledTimes(1);
});
