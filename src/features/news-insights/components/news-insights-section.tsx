import { NewsCardImage } from "./news-card-image";
import styles from "./news-insights.module.css";
import type { NewsInsightsState } from "../types/news-insights";

type NewsInsightsSectionProps = {
  state: NewsInsightsState;
  onRetry?: () => void;
};

/**
 * 이미 검토된 공개 카드와 조회 상태만 표시한다. 원문 추출·인증·게시 정렬은 공급자 책임이다.
 * 관리 시스템이 정해질 때까지 홈페이지에서는 unconfigured를 사용하며 예시 기사를 게시하지 않는다.
 */
export function NewsInsightsSection({ state, onRetry }: NewsInsightsSectionProps) {
  if (state.status === "unconfigured" || (state.status === "ready" && !state.articles.length)) {
    return null;
  }

  return (
    <section id="news" aria-labelledby="news-heading" className={styles.section}>
      <div className={styles.inner} aria-busy={state.status === "loading"}>
        <h2 id="news-heading">포리펀 뉴스와 인사이트</h2>
        {state.status === "loading" ? (
          <p role="status" className={styles.message}>
            뉴스와 인사이트를 불러오고 있습니다.
          </p>
        ) : state.status === "error" ? (
          <div className={styles.message}>
            <p role="alert">뉴스와 인사이트를 불러오지 못했습니다.</p>
            {onRetry ? (
              <button type="button" onClick={onRetry}>
                다시 시도
              </button>
            ) : null}
          </div>
        ) : (
          <>
            <ul className={styles.grid}>
              {state.articles.slice(0, 3).map((article) => (
                <li key={article.id}>
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${article.title} (새 창)`}
                    className={styles.card}
                  >
                    <NewsCardImage imageUrl={article.imageUrl} />
                    <h3 title={article.title}>{article.title}</h3>
                  </a>
                </li>
              ))}
            </ul>
            <p className={styles.note}>최근 보도자료를 최대 3건까지 소개합니다.</p>
          </>
        )}
      </div>
    </section>
  );
}
