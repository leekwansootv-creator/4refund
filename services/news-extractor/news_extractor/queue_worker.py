"""일회성 GitHub 작업자. 서명된 뉴스 후보 큐만 호출하며 시트·GitHub 자격 증명은 없다."""

import argparse
import base64
import hashlib
import hmac
import http.client
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid


class WorkerUnavailable(Exception):
    """로그에는 원문 URL·서명·응답 본문 대신 이 고정 실패만 남긴다."""


class GoogleRedirect(urllib.request.HTTPRedirectHandler):
    """Apps Script 출력용 Google 호스트의 HTTPS GET 전환만 허용한다."""

    def redirect_request(self, request, response, code, message, headers, new_url):
        target = urllib.parse.urlsplit(new_url)
        if (
            code not in {302, 303}
            or target.scheme != "https"
            or target.hostname != "script.googleusercontent.com"
            or target.port not in {None, 443}
            or target.username
            or target.password
        ):
            raise WorkerUnavailable()
        # 요청 서명과 본문은 redirect 대상에 전달하지 않는다.
        return urllib.request.Request(new_url, headers={"Accept": "application/json"})


class QueueClient:
    """고정 Google endpoint의 짧은 서명 요청. URL이나 결과를 로그·artifact에 기록하지 않는다."""

    def __init__(self, endpoint, token, opener=None):
        if not re.fullmatch(
            r"https://script\.google\.com/macros/s/[A-Za-z0-9_-]{20,200}/exec", endpoint
        ) or not re.fullmatch(r"[a-f0-9]{64}", token):
            raise WorkerUnavailable()
        self.endpoint, self.token = endpoint, token
        self.opener = opener or urllib.request.build_opener(
            urllib.request.ProxyHandler({}), GoogleRedirect()
        )

    def call(self, action, body=None):
        payload = json.dumps(
            {
                "version": 1,
                "action": action,
                "body": body or {},
                "nonce": str(uuid.uuid4()),
                "timestamp": int(time.time() * 1000),
            },
            ensure_ascii=False,
            separators=(",", ":"),
        )
        signature = hmac.new(self.token.encode(), payload.encode(), hashlib.sha256).hexdigest()
        envelope = json.dumps({"payload": payload, "signature": signature}).encode()
        if len(envelope) > 120_000:
            raise WorkerUnavailable()
        request = urllib.request.Request(
            self.endpoint,
            data=envelope,
            headers={"Content-Type": "application/json", "Accept": "application/json"},
            method="POST",
        )
        try:
            with self.opener.open(request, timeout=25) as response:
                if response.status != 200:
                    raise WorkerUnavailable()
                raw = response.read(8193)
                if len(raw) > 8192:
                    raise WorkerUnavailable()
                value = json.loads(raw)
                if not isinstance(value, dict) or value.get("ok") is not True:
                    raise WorkerUnavailable()
                return value["data"]
        except (ValueError, KeyError, OSError, urllib.error.URLError, http.client.HTTPException):
            raise WorkerUnavailable() from None


def run_jobs(client, collector, maximum=3):
    """최대 3건의 후보만 반환한다. 수집 실패를 기록하며 게시 작업은 하지 않는다."""
    completed = 0
    for _ in range(maximum):
        job = client.call("claim")
        if job is None:
            return completed
        if (
            not isinstance(job, dict)
            or set(job) != {"jobId", "lease", "url", "imageOnly"}
            or not all(isinstance(job[key], str) for key in ("jobId", "lease", "url"))
            or not isinstance(job["imageOnly"], bool)
        ):
            raise WorkerUnavailable()
        body = {"jobId": job["jobId"], "lease": job["lease"]}
        try:
            result = collector(job["url"], image_only=job["imageOnly"])
            body["candidate"] = {
                "url": result.url,
                "title": result.title,
                "image": base64.b64encode(result.image).decode() if result.image else None,
                "warning": result.warning,
                "fingerprint": result.fingerprint,
            }
        except (ValueError, OSError):
            body["failed"] = True
        acknowledgement = client.call("complete", body)
        if not isinstance(acknowledgement, dict) or acknowledgement.get("accepted") is not True:
            raise WorkerUnavailable()
        completed += 1
    return completed


def main():
    """대기 작업이 없으면 의존성 설치를 생략한다. 비밀·기사는 표준출력에 포함하지 않는다."""
    parser = argparse.ArgumentParser()
    parser.add_argument("--probe", action="store_true")
    arguments = parser.parse_args()
    try:
        client = QueueClient(
            os.environ.get("NEWS_WORKER_URL", ""), os.environ.get("NEWS_WORKER_TOKEN", "")
        )
        if arguments.probe:
            value = client.call("probe")
            if not isinstance(value, dict) or type(value.get("pending")) is not bool:
                raise WorkerUnavailable()
            with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as output:
                output.write(f"has_work={'true' if value['pending'] else 'false'}\n")
        else:
            from news_extractor.fetching import extract

            run_jobs(client, extract)
        print("News collection check completed.")
    except (WorkerUnavailable, OSError, KeyError):
        print("News collection unavailable. Check worker configuration and queue status.")
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
