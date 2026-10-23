/** 부모와 iframe이 함께 갱신해야 하는 개인정보 없는 제어 계약입니다. */
export const EMBED_PROTOCOL = "fourrefund-embed-v1";
/** 로컬 구현의 정적 release ID입니다. 같은 ID의 배포 자원은 덮어쓰지 않습니다. */
export const EMBED_RELEASE = process.env.NEXT_PUBLIC_EMBED_RELEASE ?? "1.0.0";
/** 페이지 콘텐츠·payload·연락처를 전달할 수 없는 허용 메시지 목록입니다. */
export type EmbedMessage = {
  protocol: typeof EMBED_PROTOCOL;
  instanceId: string;
  sessionId: string;
} & (
  | { type: "INIT"; data: { mode: "entry" | "flow"; siteOrigin: string } }
  | { type: "READY"; data: { release: string } }
  | { type: "RESIZE"; data: { height: number } }
  | {
      type:
        | "OPEN"
        | "REQUEST_CLOSE"
        | "CLOSE_ALLOWED"
        | "BUSY"
        | "UNCERTAIN"
        | "IDLE"
        | "RESTORE_FOCUS";
      data: null;
    }
);

/** 외부 window 입력을 키·버전·길이·유한한 크기까지 검사합니다. */
export function isEmbedMessage(value: unknown): value is EmbedMessage {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const message = value as Record<string, unknown>;
  if (
    Object.keys(message).length !== 5 ||
    message.protocol !== EMBED_PROTOCOL ||
    ![message.instanceId, message.sessionId].every(
      (id) => typeof id === "string" && /^[a-zA-Z0-9-]{1,80}$/u.test(id),
    )
  )
    return false;
  const data = message.data;
  if (
    [
      "OPEN",
      "REQUEST_CLOSE",
      "CLOSE_ALLOWED",
      "BUSY",
      "UNCERTAIN",
      "IDLE",
      "RESTORE_FOCUS",
    ].includes(String(message.type))
  )
    return data === null;
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  const record = data as Record<string, unknown>;
  if (message.type === "INIT")
    return (
      Object.keys(record).length === 2 &&
      (record.mode === "entry" || record.mode === "flow") &&
      typeof record.siteOrigin === "string" &&
      record.siteOrigin.length <= 300
    );
  if (message.type === "READY")
    return Object.keys(record).length === 1 && record.release === EMBED_RELEASE;
  if (message.type === "RESIZE")
    return (
      Object.keys(record).length === 1 &&
      typeof record.height === "number" &&
      Number.isFinite(record.height) &&
      record.height >= 200 &&
      record.height <= 900
    );
  return false;
}
