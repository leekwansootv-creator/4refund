"""고정 모듈의 제한 수집 프로세스. 원문·URL·실패 상세를 stderr에 남기지 않는다."""

import base64
import json
import sys

from news_extractor.fetching import collect


def main():
    """상위 프로세스가 전달한 작은 JSON 요청 하나만 처리한다."""
    try:
        value = json.loads(sys.stdin.read(4096))
        result = collect(value["url"], image_only=value["image_only"])
        print(
            json.dumps(
                {
                    "url": result.url,
                    "title": result.title,
                    "image": base64.b64encode(result.image).decode() if result.image else None,
                    "warning": result.warning,
                    "fingerprint": result.fingerprint,
                }
            )
        )
    except Exception:
        print('{"error":"FETCH_FAILED"}')


if __name__ == "__main__":
    main()
