"""로컬 디자인 자료를 브라우저에 UTF-8로 전달한다."""

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class DesignHandler(SimpleHTTPRequestHandler):
    """OS별 MIME 추측에 의존하지 않고 원문 텍스트의 한글을 보존한다."""

    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".md": "text/plain; charset=utf-8",
        ".txt": "text/plain; charset=utf-8",
        ".py": "text/plain; charset=utf-8",
        ".html": "text/html; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".xml": "application/xml; charset=utf-8",
        ".svg": "image/svg+xml; charset=utf-8",
    }


if __name__ == "__main__":
    # 작업 디렉터리와 관계없이 자료 폴더만, 로컬 컴퓨터에만 제공한다.
    handler = partial(DesignHandler, directory=str(Path(__file__).resolve().parent))
    with ThreadingHTTPServer(("127.0.0.1", 8765), handler) as server:
        print("http://127.0.0.1:8765/index.html", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
