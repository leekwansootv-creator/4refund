"""로컬 HTTP 경계 검증. 원문 네트워크는 명시적인 가짜 수집기로 대체한다."""

import http.client
import json
import threading
from unittest.mock import Mock

import pytest

from news_extractor.fetching import Extraction, FetchRejected
from news_extractor.server import ExtractorServer

TOKEN = "local-test-token-not-a-real-secret" * 2


@pytest.fixture
def service():
    collector = Mock(
        return_value=Extraction(
            "https://news.example.org/", "기사 제목", None, "IMAGE_MISSING", "a" * 64
        )
    )
    server = ExtractorServer(("127.0.0.1", 0), TOKEN, collector)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield server, collector
    server.shutdown()
    server.server_close()
    thread.join()


def request(server, body=None, token=TOKEN, **headers):
    connection = http.client.HTTPConnection(*server.server_address, timeout=3)
    payload = json.dumps(
        body if body is not None else {"url": "https://news.example.org/", "imageOnly": False}
    )
    connection.request(
        "POST",
        "/extract",
        payload,
        {"Content-Type": "application/json", "Authorization": "Bearer " + token, **headers},
    )
    response = connection.getresponse()
    result = response.status, json.loads(response.read())
    connection.close()
    return result


def test_auth_precedes_collection_and_response_has_only_candidate_fields(service):
    server, collector = service
    assert request(server, token="wrong")[0] == 401
    collector.assert_not_called()
    status, body = request(server)
    assert status == 200
    assert set(body) == {"url", "title", "image", "warning", "fingerprint"}
    collector.assert_called_once_with("https://news.example.org/", image_only=False)


@pytest.mark.parametrize(
    "body",
    [
        {},
        [],
        {"url": "https://a.org", "imageOnly": "false"},
        {"url": "https://a.org", "imageOnly": False, "token": "x"},
    ],
)
def test_bad_schema_never_collects(service, body):
    server, collector = service
    assert request(server, body)[0] == 400
    collector.assert_not_called()


def test_size_limit_and_sanitized_failure(service):
    server, collector = service
    assert request(server, {"url": "x" * 5000, "imageOnly": False})[0] == 400
    collector.assert_not_called()
    collector.side_effect = FetchRejected("sensitive upstream body")
    assert request(server) == (422, {"error": "EXTRACTION_FAILED"})


def test_global_rate_limit_counts_failed_attempts(service):
    server, collector = service
    collector.side_effect = FetchRejected("failed")
    for _ in range(10):
        assert request(server)[0] == 422
    assert request(server) == (429, {"error": "RATE_LIMIT"})
    assert collector.call_count == 10


def test_refuses_missing_service_secret():
    with pytest.raises(ValueError):
        ExtractorServer(("127.0.0.1", 0), "")
