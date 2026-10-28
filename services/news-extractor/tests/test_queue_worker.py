"""서명·Google 응답 경계와 비공개 후보 전달을 가짜 큐로 검증한다."""

import hashlib
import hmac
import http.client
import io
import json
from unittest.mock import Mock
from urllib.request import Request

import pytest

from news_extractor.fetching import Extraction, FetchRejected
from news_extractor.queue_worker import GoogleRedirect, QueueClient, WorkerUnavailable, run_jobs

ENDPOINT = "https://script.google.com/macros/s/" + "example" * 5 + "/exec"
TOKEN = "a" * 64


def test_queue_signs_exact_unicode_payload_and_never_sends_secret_in_body():
    response = io.BytesIO(b'{"ok":true,"data":null}')
    response.status = 200
    opener = Mock()
    opener.open.return_value = response
    client = QueueClient(ENDPOINT, TOKEN, opener)
    assert client.call("complete", {"title": "제목"}) is None
    request = opener.open.call_args.args[0]
    envelope = json.loads(request.data)
    assert (
        envelope["signature"]
        == hmac.new(TOKEN.encode(), envelope["payload"].encode(), hashlib.sha256).hexdigest()
    )
    assert TOKEN.encode() not in request.data
    assert json.loads(envelope["payload"])["body"] == {"title": "제목"}


@pytest.mark.parametrize(
    "url",
    [
        "http://script.google.com/x",
        "https://evil.org/exec",
        "https://script.google.com.evil.org/exec",
    ],
)
def test_only_fixed_google_endpoint_allowed(url):
    with pytest.raises(WorkerUnavailable):
        QueueClient(url, TOKEN)


def test_redirect_drops_signature_body_and_rejects_other_hosts():
    redirect = GoogleRedirect()
    original = Request(ENDPOINT, data=b"signed-data", method="POST")
    result = redirect.redirect_request(
        original, None, 302, "", {}, "https://script.googleusercontent.com/macros/echo?x=1"
    )
    assert result.get_method() == "GET"
    assert result.data is None
    for url in [
        "https://evil.org/",
        "http://script.googleusercontent.com/",
        "https://user@script.googleusercontent.com/",
    ]:
        with pytest.raises(WorkerUnavailable):
            redirect.redirect_request(original, None, 302, "", {}, url)


@pytest.mark.parametrize("raw", [b"x" * 8193, b'{"ok":false,"error":"secret"}', b"not-json"])
def test_response_limit_and_errors_are_sanitized(raw):
    response = io.BytesIO(raw)
    response.status = 200
    opener = Mock()
    opener.open.return_value = response
    with pytest.raises(WorkerUnavailable) as error:
        QueueClient(ENDPOINT, TOKEN, opener).call("claim")
    assert "secret" not in str(error.value)


def test_worker_returns_only_candidate_and_no_publication_command():
    client = Mock()
    job = {"jobId": "id", "lease": "lease", "url": "https://news.example.org/", "imageOnly": False}
    client.call.side_effect = [job, {"accepted": True}, None]
    collector = Mock(return_value=Extraction(job["url"], "제목", None, "IMAGE_MISSING", "a" * 64))
    assert run_jobs(client, collector) == 1
    assert [call.args[0] for call in client.call.call_args_list] == ["claim", "complete", "claim"]
    result = client.call.call_args_list[1].args[1]
    assert set(result) == {"jobId", "lease", "candidate"}
    assert set(result["candidate"]) == {"url", "title", "image", "warning", "fingerprint"}


def test_fetch_failure_is_recorded_without_url_or_exception():
    client = Mock()
    client.call.side_effect = [
        {"jobId": "id", "lease": "lease", "url": "https://news.example.org/", "imageOnly": False},
        {"accepted": True},
        None,
    ]
    collector = Mock(side_effect=FetchRejected("private upstream detail"))
    assert run_jobs(client, collector) == 1
    assert client.call.call_args_list[1].args[1] == {
        "jobId": "id",
        "lease": "lease",
        "failed": True,
    }


def test_transport_failure_is_sanitized():
    opener = Mock()
    opener.open.side_effect = http.client.IncompleteRead(b"private response")
    with pytest.raises(WorkerUnavailable) as error:
        QueueClient(ENDPOINT, TOKEN, opener).call("claim")
    assert "private" not in str(error.value)


def test_completion_requires_explicit_acknowledgement():
    client = Mock()
    client.call.side_effect = [
        {"jobId": "id", "lease": "lease", "url": "https://news.example.org/", "imageOnly": False},
        {},
    ]
    with pytest.raises(WorkerUnavailable):
        run_jobs(client, Mock(side_effect=FetchRejected("failed")))
