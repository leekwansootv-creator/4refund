import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { validateReleaseId } from "./embed-release-artifact.mjs";

/** 전달 URL을 HTTPS origin과 빌드 prefix로 제한해 HTML·script 삽입을 차단합니다. */
export function normalizePublicBaseUrl(value, basePath) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    url.search ||
    url.hash ||
    !/^[a-z0-9.-]+$/u.test(url.hostname) ||
    !/^(?:\/[a-zA-Z0-9_-]+)*$/u.test(basePath) ||
    url.pathname.replace(/\/$/u, "") !== basePath
  )
    throw new Error("invalid_public_base_url");
  return `${url.origin}${basePath}`;
}

/** 소스·운영 설정을 포함하지 않는 설치 코드와 강제 조회 전용 데모를 만듭니다. */
export async function writeEmbedPartnerKit(directory, { publicBaseUrl, basePath, activeRelease }) {
  const base = normalizePublicBaseUrl(publicBaseUrl, basePath);
  validateReleaseId(activeRelease);
  const pinned = `${base}/embed/releases/${activeRelease}`;
  const snippet = (loader, page) =>
    `<div id="fourrefund-estimate">\n  <a href="${page}?mode=standalone" target="_blank" rel="noopener noreferrer">예상 환급액 조회하기</a>\n</div>\n<script async src="${loader}" data-target="fourrefund-estimate"></script>\n`;
  const target = join(directory, "embed/partner");
  await mkdir(target, { recursive: true });
  await writeFile(
    join(target, "install.html.txt"),
    snippet(`${base}/embed/v1/loader.js`, `${base}/embed/quick-estimate.html`),
  );
  await writeFile(
    join(target, "pinned.html.txt"),
    snippet(`${pinned}/loader.js`, `${pinned}/embed/quick-estimate.html`),
  );
  await writeFile(
    join(target, "iframe.html.txt"),
    `<iframe src="${base}/embed/quick-estimate.html?mode=inline" title="포리펀드 예상 환급액 조회" width="100%" height="760" referrerpolicy="strict-origin-when-cross-origin"></iframe>\n<a href="${base}/embed/quick-estimate.html?mode=standalone" target="_blank" rel="noopener noreferrer">넓은 화면에서 조회하기</a>\n`,
  );
  await writeFile(
    join(target, "demo.html"),
    `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>예상 환급액 조회 전용 예시</title></head><body><h1>예상 환급액 조회 전용 예시</h1><p>상담 신청·저장·알림이 발생하지 않습니다. 이 예시는 iframe 방식이며, 기본 script 설치는 부모 페이지 전체에 모달을 표시합니다.</p><iframe src="${pinned}/embed/quick-estimate.html?mode=inline&amp;demo=1" title="조회 전용 예시" width="100%" height="800" referrerpolicy="strict-origin-when-cross-origin"></iframe></body></html>\n`,
  );
  await writeFile(
    join(target, "README.md"),
    `# 포리펀드 예상 환급액 조회 설치 안내\n\n이 묶음은 설치용 자료입니다. 운영 공개와 실제 접수 검증 완료 여부는 포리펀드 담당자의 전달 안내를 확인해 주세요.\n\n- 기본 설치: install.html.txt의 코드를 HTTPS 페이지의 원하는 위치에 붙입니다. 가로 320px 이상 공간이 필요합니다.\n- 고정 버전: pinned.html.txt는 ${activeRelease}를 사용합니다. 기본 설치는 v1 호환 업데이트를 자동 적용합니다. 한 페이지에서 서로 다른 버전을 혼용하지 않습니다.\n- script를 허용하지 않는 환경: iframe.html.txt 또는 일반 링크를 사용합니다. iframe 모달은 프레임 안에서 스크롤합니다.\n- 조회 전용 예시: ${base}/embed/partner/demo.html (실제 접수 없음). 설치 코드의 최종 '상세 견적 신청하기'는 공개 후 실제 접수를 발생시킵니다.\n- CSP: script-src, frame-src, style-src에 ${new URL(base).origin}을 추가합니다. 기존 허용 목록은 유지합니다.\n- 정상 script 설치에서는 설치 사이트 도메인을 자동으로 구분합니다. 제휴처 ID, Google 설정, 저장소·npm·React 설치는 필요하지 않습니다.\n- 개인정보 없이 먼저 조회하며, 최종 신청에서만 회사·담당자 정보와 동의를 받습니다. 제휴 페이지에 상담 개인정보를 반환하지 않습니다.\n- UI·배포·수정·복구는 포리펀드가 관리합니다. 제휴사는 삽입 위치와 CMS/CSP의 자원 허용을 관리합니다.\n- 연결 실패 시 남아 있는 별도 조회 링크를 이용하거나 다시 열어 주세요. 신청 결과가 불명확하면 같은 화면의 재시도를 사용하고 새 신청을 반복하지 마세요.\n- 설치 진단: 컨테이너에 data-diagnostic="1"을 붙여 준비 완료와 사이트 주소를 확인합니다. 정상 확인 후 제거합니다. 진단만으로 접수하지 않습니다.\n- 설치 확인: 편지 표시 → 조회 → 모바일 모달·닫기 확인. 실제 저장 확인은 포리펀드 담당자와 합의한 범위에서만 합니다.\n\n검증 범위: 로컬 Chromium 자동 검사 기준. 실제 제휴 CMS, iOS Safari·Android 실기기와 Google 연동은 별도 확인합니다. 무제한 접수나 특정 수용량을 보장하는 문서가 아닙니다.\n`,
  );
}
