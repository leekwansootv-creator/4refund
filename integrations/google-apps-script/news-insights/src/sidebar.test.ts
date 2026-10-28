import { expect, it } from "vitest";
import { SIDEBAR_HTML } from "./sidebar";

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
