"""Google 인증 후 서버 간 호출만 받는 독립 수집기. CMS·Sheet에 접근하지 않는다."""

import base64
import hmac
import json
import os
import socket
import threading
import time
from collections import deque
from http.server import BaseHTTPRequestHandler, HTTPServer

from news_extractor.fetching import FetchRejected, extract


class ExtractorServer(HTTPServer):
    """연결 스레드/큐를 늘리지 않고 동시 수집을 하나로 제한하는 로컬 HTTP 경계."""

    request_queue_size = 4

    def __init__(self, address, token, collector=extract):
        if (
            not isinstance(token, str)
            or not 32 <= len(token) <= 256
            or any(not 33 <= ord(character) <= 126 for character in token)
        ):
            raise ValueError("NEWS_EXTRACTOR_TOKEN must contain at least 32 ASCII characters")
        self.token = token
        self.collector = collector
        self.attempts = deque()
        self.deadlines = {}
        super().__init__(address, Handler)

    def get_request(self):
        connection, address = super().get_request()
        connection.settimeout(5)

        # 소켓 idle timeout 외에 느린 헤더/본문 전체 수신에도 절대 기한을 둔다.
        def expire():
            try:
                connection.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass
            connection.close()

        timer = threading.Timer(30, expire)
        timer.daemon = True
        timer.start()
        self.deadlines[connection] = timer
        return connection, address

    def shutdown_request(self, request):
        timer = self.deadlines.pop(request, None)
        if timer:
            timer.cancel()
        super().shutdown_request(request)


class Handler(BaseHTTPRequestHandler):
    """토큰·요청 한도 확인을 통과한 URL만 수집하며 세부 실패/원문을 로그하지 않는다."""

    server_version = "NewsExtractor"
    sys_version = ""

    def log_message(self, *_args):
        pass

    def reply(self, status, value):
        body = json.dumps(value, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Connection", "close")
        self.end_headers()
        self.wfile.write(body)
        self.close_connection = True

    def do_POST(self):
        """인증 전에는 본문 파싱·DNS·추출을 실행하지 않는다."""
        authorization = self.headers.get_all("Authorization") or []
        if len(authorization) != 1 or not hmac.compare_digest(
            authorization[0].encode(), ("Bearer " + self.server.token).encode()
        ):
            return self.reply(401, {"error": "UNAUTHORIZED"})
        if self.path != "/extract":
            return self.reply(404, {"error": "NOT_FOUND"})
        now = time.monotonic()
        while self.server.attempts and self.server.attempts[0] <= now - 60:
            self.server.attempts.popleft()
        if len(self.server.attempts) >= 10:
            return self.reply(429, {"error": "RATE_LIMIT"})
        self.server.attempts.append(now)
        lengths = self.headers.get_all("Content-Length") or []
        if (
            self.headers.get("Transfer-Encoding")
            or len(lengths) != 1
            or not lengths[0].isdecimal()
            or not 0 < int(lengths[0]) <= 4096
            or self.headers.get("Content-Type", "").split(";")[0] != "application/json"
        ):
            return self.reply(400, {"error": "INVALID_REQUEST"})
        try:
            body = self.rfile.read(int(lengths[0]))
            if len(body) != int(lengths[0]):
                raise ValueError()
            value = json.loads(body)
            if (
                not isinstance(value, dict)
                or set(value) != {"url", "imageOnly"}
                or not isinstance(value["url"], str)
                or not isinstance(value["imageOnly"], bool)
            ):
                raise ValueError()
        except (ValueError, TimeoutError, OSError):
            return self.reply(400, {"error": "INVALID_REQUEST"})
        try:
            result = self.server.collector(value["url"], image_only=value["imageOnly"])
            return self.reply(
                200,
                {
                    "url": result.url,
                    "title": result.title,
                    "image": base64.b64encode(result.image).decode() if result.image else None,
                    "warning": result.warning,
                    "fingerprint": result.fingerprint,
                },
            )
        except (FetchRejected, OSError):
            return self.reply(422, {"error": "EXTRACTION_FAILED"})


def main():
    """외부 노출은 별도 TLS/프록시 검토 전까지 허용하지 않는다."""
    server = ExtractorServer(
        ("127.0.0.1", int(os.environ.get("PORT", "8765"))),
        os.environ.get("NEWS_EXTRACTOR_TOKEN", ""),
    )
    server.serve_forever()


if __name__ == "__main__":
    main()
