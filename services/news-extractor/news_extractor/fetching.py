"""인증 뒤에만 실행하는 제한된 공개 HTTP 수집. DNS 결과로 소켓을 고정한다."""

import base64
import codecs
import hashlib
import http.client
import ipaddress
import json
import os
import socket
import ssl
import subprocess
import sys
import warnings
import zlib
from dataclasses import dataclass
from email.message import Message
from html.parser import HTMLParser
from io import BytesIO
from pathlib import Path
from urllib.parse import quote, urljoin, urlsplit, urlunsplit

from PIL import Image, ImageOps

MAX_IMAGE = 4 * 1024 * 1024
MAX_STORED = 70 * 1024
MAX_HTML = 1024 * 1024


class FetchRejected(ValueError):
    """원문/네트워크 상세를 사용자나 로그에 포함하지 않는 수집 실패."""


def normalize_url(value: str) -> str:
    """HTTP(S) 기본 포트의 공개 호스트 URL만 정규화한다. DNS는 연결 직전에 검사한다."""
    if (
        not isinstance(value, str)
        or len(value) > 2048
        or any(ord(char) < 33 or ord(char) == 127 or char == "\\" for char in value)
    ):
        raise FetchRejected("URL_INVALID")
    try:
        parts = urlsplit(value)
        host = (parts.hostname or "").encode("idna").decode("ascii").lower().rstrip(".")
        if (
            parts.scheme not in {"https", "http"}
            or parts.username is not None
            or parts.password is not None
            or parts.port not in {None, 443 if parts.scheme == "https" else 80}
            or not host
            or "%" in host
        ):
            raise ValueError()
        try:
            address = ipaddress.ip_address(host)
        except ValueError:
            if "." not in host or host.endswith((".localhost", ".local", ".internal", ".test")):
                raise ValueError() from None
        else:
            if not public_address(address):
                raise ValueError()
        authority = f"[{host}]" if ":" in host else host
        # 브라우저에서 복사한 한글 경로도 동일한 UTF-8 URL로 정규화한다.
        path = quote(parts.path or "/", safe="/%:@!$&'()*+,;=-._~")
        query = quote(parts.query, safe="/%?:@!$&'()*+,;=-._~")
        normalized = urlunsplit((parts.scheme, authority, path, query, ""))
        if len(normalized) > 2048:
            raise ValueError()
        return normalized
    except (ValueError, UnicodeError):
        raise FetchRejected("URL_INVALID") from None


def public_address(address) -> bool:
    """IPv4 매핑·전환 주소도 차단하여 로컬/사설 목적지의 다른 표기를 허용하지 않는다."""
    return (
        address.is_global
        and not address.is_multicast
        and not address.is_reserved
        and not getattr(address, "ipv4_mapped", None)
        and not getattr(address, "sixtofour", None)
        and not getattr(address, "teredo", None)
        and address not in ipaddress.ip_network("64:ff9b::/96")
        and address not in ipaddress.ip_network("64:ff9b:1::/48")
    )


def resolve_public(host: str, port: int):
    """모든 DNS 응답을 검사한다. 하나라도 비공개 주소이면 전체 요청을 거절한다."""
    answers = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    if not answers or any(not public_address(ipaddress.ip_address(a[4][0])) for a in answers):
        raise FetchRejected("DESTINATION_BLOCKED")
    return answers[0]


def fetch_bytes(value: str, *, image=False):
    """리다이렉트마다 URL/DNS를 재검증하고 고정 IP로 연결한다. 인증/프록시는 전달하지 않는다."""
    url = normalize_url(value)
    for _ in range(4):
        parts = urlsplit(url)
        port = 443 if parts.scheme == "https" else 80
        family, kind, proto, _, destination = resolve_public(parts.hostname, port)
        sock = socket.socket(family, kind, proto)
        connection = http.client.HTTPConnection(parts.hostname, port, timeout=4)
        try:
            sock.settimeout(4)
            sock.connect(destination)
            if parts.scheme == "https":
                sock = ssl.create_default_context().wrap_socket(
                    sock, server_hostname=parts.hostname
                )
            connection.sock = sock
            path = urlunsplit(("", "", parts.path, parts.query, ""))
            connection.request(
                "GET",
                path,
                headers={
                    "Host": parts.netloc,
                    "User-Agent": "4refund-NewsPreview/1.0",
                    "Accept": "image/*" if image else "text/html,application/xhtml+xml",
                    "Accept-Encoding": "identity",
                    "Connection": "close",
                },
            )
            response = connection.getresponse()
            if response.status in {301, 302, 303, 307, 308}:
                location = response.getheader("Location")
                if not location:
                    raise FetchRejected("FETCH_FAILED")
                url = normalize_url(urljoin(url, location))
                continue
            mime = response.getheader("Content-Type", "").split(";")[0].lower().strip()
            allowed = (
                {"image/jpeg", "image/png", "image/webp"}
                if image
                else {"text/html", "application/xhtml+xml"}
            )
            encoding = response.getheader("Content-Encoding", "identity").lower()
            if (
                response.status != 200
                or mime not in allowed
                or encoding not in {"identity", "gzip"}
            ):
                raise FetchRejected("FETCH_FAILED")
            maximum = MAX_IMAGE if image else MAX_HTML
            length = response.getheader("Content-Length")
            if length and (not length.isdecimal() or int(length) > maximum):
                raise FetchRejected("SIZE_LIMIT")
            data = response.read(maximum + 1)
            if len(data) > maximum:
                raise FetchRejected("SIZE_LIMIT")
            if encoding == "gzip":
                data = bounded_gzip(data, maximum)
            return url, data, response.getheader("Content-Type", "")
        finally:
            connection.close()
            sock.close()
    raise FetchRejected("REDIRECT_LIMIT")


def bounded_gzip(data, maximum):
    """identity 요청을 무시한 서버도 압축/해제 양쪽 제한 안에서만 읽는다."""
    try:
        decoder = zlib.decompressobj(16 + zlib.MAX_WBITS)
        result = decoder.decompress(data, maximum + 1)
        if len(result) > maximum or decoder.unconsumed_tail:
            raise FetchRejected("SIZE_LIMIT")
        if not decoder.eof or decoder.unused_data:
            raise FetchRejected("FETCH_FAILED")
        return result
    except zlib.error:
        raise FetchRejected("FETCH_FAILED") from None


def clean_image(data: bytes) -> bytes:
    """허용 래스터만 디코드·축소·JPEG 재인코딩한다. 메타데이터와 원본은 보존하지 않는다."""
    with warnings.catch_warnings():
        warnings.simplefilter("error", Image.DecompressionBombWarning)
        with Image.open(BytesIO(data), formats=["JPEG", "PNG", "WEBP"]) as source:
            if source.width * source.height > 12_000_000 or getattr(source, "n_frames", 1) != 1:
                raise FetchRejected("IMAGE_INVALID")
            source.load()
            clean = ImageOps.exif_transpose(source).convert("RGB")
            clean.thumbnail((820, 550))
            result = BytesIO()
            clean.save(result, format="JPEG", quality=72)
            if result.tell() > MAX_STORED:
                raise FetchRejected("SIZE_LIMIT")
            return result.getvalue()


class MetadataParser(HTMLParser):
    """실행/DOM 생성 없이 Open Graph, Twitter, title 텍스트만 읽는다."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.values = {}
        self.title = ""
        self.in_title = False
        self.charset = ""

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "meta":
            if not self.charset:
                if attrs.get("charset"):
                    self.charset = attrs["charset"]
                elif (attrs.get("http-equiv") or "").lower() == "content-type":
                    self.charset = content_charset(attrs.get("content") or "")
            key = attrs.get("property") or attrs.get("name") or ""
            if key.lower() in {"og:title", "og:image", "twitter:title", "twitter:image"}:
                self.values.setdefault(key.lower(), attrs.get("content") or "")
        if tag == "title":
            self.in_title = True

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False

    def handle_data(self, data):
        if self.in_title:
            self.title += data[:300]


@dataclass(frozen=True)
class Extraction:
    """수집 결과 후보. 서비스가 명시 저장하기 전 편집본/공개본을 바꾸지 않는다."""

    url: str
    title: str
    image: bytes | None
    warning: str | None
    fingerprint: str


def content_charset(value: str) -> str:
    """따옴표·대소문자 차이를 포함한 Content-Type의 charset 매개변수를 읽는다."""
    header = Message()
    header["Content-Type"] = value
    return header.get_content_charset() or ""


def html_encoding(label: str) -> str | None:
    """웹 문서용 텍스트 인코딩만 허용하며 EUC-KR의 확장 한글도 보존한다."""
    if label.strip().lower() in {"windows-949", "ks_c_5601-1987", "ks_c_5601-1989"}:
        return "cp949"
    try:
        encoding = codecs.lookup(label.strip()).name
    except LookupError:
        return None
    if encoding in {"euc_kr", "cp949"}:
        return "cp949"
    if encoding in {
        "utf-8",
        "utf-16-le",
        "utf-16-be",
        "cp1252",
        "iso8859-1",
        "shift_jis",
        "euc_jp",
        "gbk",
        "gb18030",
        "big5",
    }:
        return encoding
    return None


def decode_html(content: bytes, content_type: str) -> str:
    """BOM→HTTP→앞 1 KiB meta 순서로 디코드하여 헤더가 빠진 한국어 기사를 처리한다."""
    for marker, encoding in (
        (codecs.BOM_UTF8, "utf-8-sig"),
        (codecs.BOM_UTF16_LE, "utf-16"),
        (codecs.BOM_UTF16_BE, "utf-16"),
    ):
        if content.startswith(marker):
            return content.decode(encoding, errors="replace")
    encoding = html_encoding(content_charset(content_type))
    if not encoding:
        # 메타 선언만 판독한다. JS·외부 리소스 실행 없이 짧은 ASCII 호환 영역만 검사한다.
        probe = MetadataParser()
        probe.feed(content[:1024].decode("latin-1"))
        encoding = html_encoding(probe.charset)
    return content.decode(encoding or "utf-8", errors="replace")


def collect(url: str, *, image_only=False) -> Extraction:
    """자식 프로세스 안에서만 호출하는 수집 구현. 외부 전체 문서는 반환하지 않는다."""
    final, content, content_type = fetch_bytes(url, image=image_only)
    if image_only:
        cleaned = clean_image(content)
        return Extraction(final, "", cleaned, None, hashlib.sha256(cleaned).hexdigest())
    markup = decode_html(content, content_type)
    parser = MetadataParser()
    parser.feed(markup)
    title = " ".join(
        (
            parser.values.get("og:title") or parser.values.get("twitter:title") or parser.title
        ).split()
    )[:300]
    image_url = parser.values.get("og:image") or parser.values.get("twitter:image")
    cleaned, warning = None, None
    if image_url:
        try:
            _, data, _ = fetch_bytes(urljoin(final, image_url), image=True)
            cleaned = clean_image(data)
        except (
            ValueError,
            OSError,
            http.client.HTTPException,
            Image.DecompressionBombError,
            Image.DecompressionBombWarning,
        ):
            warning = "IMAGE_UNAVAILABLE"
    else:
        warning = "IMAGE_MISSING"
    if not title:
        warning = "TITLE_MISSING"
    fingerprint = hashlib.sha256(title.encode() + (cleaned or b"")).hexdigest()
    return Extraction(final, title, cleaned, warning, fingerprint)


def extract(url: str, *, image_only=False) -> Extraction:
    """DNS 대기·느린 본문·이미지 디코드까지 20초 전체 기한으로 종료한다."""
    normalize_url(url)
    try:
        result = subprocess.run(
            [sys.executable, "-m", "news_extractor.fetch_worker"],
            input=json.dumps({"url": url, "image_only": image_only}),
            capture_output=True,
            text=True,
            encoding="utf-8",
            env={
                **{
                    key: value
                    for key, value in os.environ.items()
                    if key.upper() in {"SYSTEMROOT", "WINDIR", "TEMP", "TMP"}
                },
                "PYTHONUTF8": "1",
            },
            timeout=20,
            cwd=Path(__file__).resolve().parent.parent,
            check=True,
            creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0,
        )
        value = json.loads(result.stdout)
        if value.get("error"):
            raise FetchRejected("FETCH_FAILED")
        return Extraction(
            value["url"],
            value["title"],
            base64.b64decode(value["image"], validate=True) if value["image"] else None,
            value["warning"],
            value["fingerprint"],
        )
    except (subprocess.SubprocessError, ValueError, KeyError, OSError):
        raise FetchRejected("FETCH_FAILED") from None
