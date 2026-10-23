import { describe, expect, it } from "vitest";
import {
  normalizeSiteOrigin,
  observeAttribution,
  parseSubmissionAttribution,
} from "./submission-attribution";
import { EMBED_PROTOCOL, isEmbedMessage } from "./embed-protocol";

describe("출처 계약", () => {
  it.each([
    ["https://WWW.Partner.Example.:443", "https://www.partner.example"],
    ["https://xn--3e0b707e.example", "https://xn--3e0b707e.example"],
    ["https://a.partner.example", "https://a.partner.example"],
    ["http://partner.example", null],
    ["https://partner.example:8443", null],
    ["https://partner.example/path", null],
    ["https://partner.example?name=secret", null],
    ["https://user@partner.example", null],
    ["https://partner.example#secret", null],
    ["https://127.0.0.1", null],
    ["null", null],
    ["https://bad..example", null],
    ["https://-bad.example", null],
    ["https://partner.example\n", null],
  ])("%s을 %s로 판정한다", (input, expected) => expect(normalizeSiteOrigin(input)).toBe(expected));
  it("예외 origin은 명시된 서버 설정에서만 허용한다", () => {
    expect(normalizeSiteOrigin("http://localhost:3100", ["http://localhost:3100"])).toBe(
      "http://localhost:3100",
    );
    expect(normalizeSiteOrigin("http://localhost:3101", ["http://localhost:3100"])).toBeNull();
  });
  it("부모 origin과 미확인·홈페이지·전달값을 혼동하지 않는다", () => {
    expect(
      observeAttribution("embed", "parent_message", "https://Partner.example/path?q=secret"),
    ).toEqual({
      channel: "embed",
      siteOrigin: "https://partner.example",
      collectionMethod: "parent_message",
    });
    expect(observeAttribution("hosted", "configured", "").siteOrigin).toBeNull();
    expect(
      parseSubmissionAttribution({
        channel: "embed",
        siteOrigin: null,
        collectionMethod: "parent_message",
      }),
    ).toBeNull();
    expect(
      parseSubmissionAttribution({
        channel: "homepage",
        siteOrigin: "https://ours.example",
        collectionMethod: "self_location",
      }),
    ).toBeNull();
    expect(
      parseSubmissionAttribution(
        {
          channel: "homepage",
          siteOrigin: "https://ours.example",
          collectionMethod: "self_location",
        },
        { homepageOrigins: ["https://ours.example"] },
      ),
    ).not.toBeNull();
    expect(
      parseSubmissionAttribution({
        channel: "embed",
        siteOrigin: null,
        collectionMethod: "unknown",
        extra: true,
      }),
    ).toBeNull();
  });
  it("메시지에 임의 정보·무한 크기·다른 protocol을 허용하지 않는다", () => {
    const base = {
      protocol: EMBED_PROTOCOL,
      instanceId: "instance",
      sessionId: "session",
      type: "OPEN",
      data: null,
    };
    expect(isEmbedMessage(base)).toBe(true);
    for (const invalid of [
      { ...base, phone: "secret" },
      { ...base, protocol: "v2" },
      { ...base, data: { payload: "secret" } },
      { ...base, type: "RESIZE", data: { height: Infinity } },
      { ...base, type: "RESIZE", data: { height: 10000 } },
    ])
      expect(isEmbedMessage(invalid)).toBe(false);
  });
});
