"use client";

import { useEffect, useState } from "react";
import { fetchPublicNews } from "../api/public-news";
import type { NewsInsightsState } from "../types/news-insights";
import { NewsInsightsSection } from "./news-insights-section";

const endpoint = process.env.NEXT_PUBLIC_NEWS_API_URL ?? "";

/** 정적 홈페이지에서 게시된 카드만 읽는다. 미설정은 숨기고 연결 실패는 재시도 UI로 표시한다. */
export function PublicNewsInsights() {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<NewsInsightsState>(
    endpoint ? { status: "loading" } : { status: "unconfigured" },
  );
  useEffect(() => {
    if (!endpoint) return;
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    void fetchPublicNews(endpoint, controller.signal)
      .then((articles) => {
        if (active) setState({ status: "ready", articles });
      })
      .catch(() => {
        if (active) setState({ status: "error" });
      })
      .finally(() => clearTimeout(timer));
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [attempt]);
  return (
    <NewsInsightsSection
      state={state}
      onRetry={() => {
        setState({ status: "loading" });
        setAttempt((value) => value + 1);
      }}
    />
  );
}
