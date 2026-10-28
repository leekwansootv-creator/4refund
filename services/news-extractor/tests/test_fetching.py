"""외부 네트워크 없이 URL/DNS/이미지/추출 경계를 검증한다."""

import ipaddress
import socket
import subprocess
from io import BytesIO
from unittest.mock import patch

import pytest
from PIL import Image

from news_extractor import fetching


@pytest.mark.parametrize(
    "url",
    [
        "file:///etc/passwd",
        "http://localhost/",
        "http://127.0.0.1/",
        "http://10.1.2.3/",
        "http://169.254.169.254/latest",
        "http://[::1]/",
        "http://[::ffff:127.0.0.1]/",
        "https://a:b@news.example.org/",
        "https://news.example.org:8080/",
        "http://a.local/",
        "https://news.example.org/\r\nx",
        "http://[64:ff9b::7f00:1]/",
        "http://2130706433/",
        "http://0x7f000001/",
        "https://news.example.org\\@127.0.0.1/",
    ],
)
def test_non_public_url_rejected(url):
    with pytest.raises(fetching.FetchRejected):
        fetching.normalize_url(url)


def test_canonical_url_keeps_meaningful_queries():
    assert (
        fetching.normalize_url("HTTPS://News.Example.org:443/a?id=2#part")
        == "https://news.example.org/a?id=2"
    )


@pytest.mark.parametrize(
    "address",
    [
        "0.0.0.0",
        "127.0.0.1",
        "10.0.0.1",
        "100.64.0.1",
        "169.254.1.2",
        "224.0.0.1",
        "::1",
        "fc00::1",
        "fe80::1",
        "2002:7f00:1::",
    ],
)
def test_private_and_transition_addresses(address):
    assert not fetching.public_address(ipaddress.ip_address(address))


def test_mixed_dns_answers_reject_entire_destination():
    replies = [
        (socket.AF_INET, socket.SOCK_STREAM, 6, "", (ip, 443)) for ip in ["8.8.8.8", "127.0.0.1"]
    ]
    with (
        patch.object(socket, "getaddrinfo", return_value=replies),
        pytest.raises(fetching.FetchRejected),
    ):
        fetching.resolve_public("news.example.org", 443)


def test_pinned_socket_does_not_resolve_again_and_redirect_revalidates():
    from unittest.mock import MagicMock

    response = MagicMock(status=302)
    response.getheader.side_effect = lambda name, default=None: (
        "http://127.0.0.1/secret" if name == "Location" else default
    )
    connection = MagicMock()
    connection.getresponse.return_value = response
    with (
        patch.object(
            fetching,
            "resolve_public",
            return_value=(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("8.8.8.8", 80)),
        ) as resolve,
        patch.object(socket, "socket") as sock,
        patch.object(fetching.http.client, "HTTPConnection", return_value=connection),
        pytest.raises(fetching.FetchRejected),
    ):
        fetching.fetch_bytes("http://news.example.org/article")
    sock.return_value.connect.assert_called_once_with(("8.8.8.8", 80))
    resolve.assert_called_once()
    assert "Cookie" not in connection.request.call_args.kwargs["headers"]


def test_image_decode_reencode_and_script_rejection():
    raw = BytesIO()
    Image.new("RGB", (1600, 1200), "blue").save(raw, format="PNG")
    clean = fetching.clean_image(raw.getvalue())
    assert clean.startswith(b"\xff\xd8") and len(clean) < fetching.MAX_STORED
    with Image.open(BytesIO(clean)) as result:
        assert result.width <= 820 and result.height <= 550
    with pytest.raises((ValueError, OSError)):
        fetching.clean_image(b'<svg onload="alert(1)"/>')


def test_missing_title_image_and_unavailable_image_are_candidates():
    with patch.object(
        fetching,
        "fetch_bytes",
        return_value=("https://news.example.org/", b"<html></html>", "text/html"),
    ):
        result = fetching.collect("https://news.example.org/")
    assert result.title == "" and result.image is None and result.warning == "TITLE_MISSING"
    html = (
        b'<meta property="og:title" content="A &amp; B">'
        b'<meta property="og:image" content="/photo.png">'
    )
    with patch.object(
        fetching,
        "fetch_bytes",
        side_effect=[("https://news.example.org/", html, "text/html"), OSError()],
    ):
        result = fetching.collect("https://news.example.org/")
    assert result.title == "A & B" and result.warning == "IMAGE_UNAVAILABLE"


def test_total_deadline_covers_dns_body_and_decoder():
    with (
        patch.object(subprocess, "run", side_effect=subprocess.TimeoutExpired("worker", 20)) as run,
        pytest.raises(fetching.FetchRejected),
    ):
        fetching.extract("https://news.example.org/")
    assert run.call_args.kwargs["timeout"] == 20
    assert run.call_args.kwargs["capture_output"] is True
    assert set(run.call_args.kwargs["env"]).issubset(
        {"SYSTEMROOT", "SystemRoot", "WINDIR", "windir", "TEMP", "TMP", "PYTHONUTF8"}
    )


def test_gzip_is_bounded_after_decompression_and_rejects_truncation():
    import gzip

    assert (
        fetching.bounded_gzip(gzip.compress(b"<title>news</title>"), 100) == b"<title>news</title>"
    )
    with pytest.raises(fetching.FetchRejected, match="SIZE_LIMIT"):
        fetching.bounded_gzip(gzip.compress(b"a" * 10000), 100)
    with pytest.raises(fetching.FetchRejected, match="FETCH_FAILED"):
        fetching.bounded_gzip(gzip.compress(b"news")[:-4], 100)


def test_korean_article_url_matches_browser_encoding_without_double_encoding():
    url = fetching.normalize_url("https://news.example.org/뉴스?제목=환급")
    assert url.isascii()
    assert fetching.normalize_url(url) == url
    assert "%EB%89%B4%EC%8A%A4" in url


@pytest.mark.parametrize(
    "meta",
    [
        '<meta http-equiv="Content-Type" content="text/html; charset=euc-kr">',
        '<META CHARSET="EUC-KR">',
        '<!-- <meta charset="utf-8"> --><meta charset="windows-949">',
    ],
)
def test_korean_meta_encoding_without_http_charset(meta):
    title = "한국경비협회 4대보험 환급 똠"
    raw = (meta + f"<title>{title}</title>").encode("cp949")
    with patch.object(
        fetching, "fetch_bytes", return_value=("http://news.example.org/", raw, "text/html")
    ):
        result = fetching.collect("http://news.example.org/")
    assert result.title == title
    assert result.warning == "IMAGE_MISSING"


def test_encoding_priority_bom_http_meta_and_invalid_fallback():
    markup = '<meta charset="euc-kr"><title>환급 지원</title>'
    assert fetching.decode_html(markup.encode(), 'text/html; CHARSET="UTF-8"') == markup
    assert fetching.decode_html(markup.encode("utf-8-sig"), "text/html; charset=euc-kr") == markup
    assert fetching.decode_html(markup.encode("utf-16"), "text/html; charset=euc-kr") == markup
    unknown = '<meta charset="unknown"><title>뉴스</title>'
    assert fetching.decode_html(unknown.encode(), "text/html; charset=base64") == unknown
    late = " " * 1024 + markup
    assert fetching.decode_html(late.encode(), "text/html") == late


def test_manual_article_image_uses_same_decoder_and_url_validation():
    raw = BytesIO()
    Image.new("RGB", (900, 600), "white").save(raw, format="JPEG")
    with patch.object(
        fetching,
        "fetch_bytes",
        return_value=("https://news.example.org/photo.jpg", raw.getvalue(), "image/jpeg"),
    ) as fetch:
        result = fetching.collect("https://news.example.org/photo.jpg", image_only=True)
    assert result.image and result.warning is None and result.title == ""
    fetch.assert_called_once_with("https://news.example.org/photo.jpg", image=True)
