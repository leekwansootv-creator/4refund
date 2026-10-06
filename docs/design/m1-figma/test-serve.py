"""실제 HTTP 응답에서 한글 인코딩과 SVG 원본 보존을 검증한다."""

from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from unittest import TestCase, main
from urllib.request import urlopen

from serve import DesignHandler


class DesignServerTest(TestCase):
    def test_text_encoding_and_svg_bytes(self):
        root = Path(__file__).resolve().parent
        handler = partial(DesignHandler, directory=str(root))
        with ThreadingHTTPServer(("127.0.0.1", 0), handler) as server:
            worker = Thread(target=server.serve_forever, daemon=True)
            worker.start()
            try:
                for path, mime in (
                    ("screen-spec.md", "text/plain"),
                    ("text/work-detail.md", "text/plain"),
                    ("evidence/mcp/923-20145.txt", "text/plain"),
                    ("text/catalog.json", "application/json"),
                    ("index.html", "text/html"),
                    ("exports/p0/ICON.svg", "image/svg+xml"),
                ):
                    with self.subTest(path=path):
                        with urlopen(f"http://127.0.0.1:{server.server_port}/{path}") as response:
                            self.assertEqual(response.headers.get_content_type(), mime)
                            self.assertEqual(response.headers.get_content_charset(), "utf-8")
                            content = response.read()
                            self.assertEqual(content, (root / path).read_bytes())
                            decoded = content.decode("utf-8")
                            if path == "screen-spec.md":
                                self.assertIn("화면 명세", decoded)
            finally:
                server.shutdown()
                worker.join()


if __name__ == "__main__":
    main()
