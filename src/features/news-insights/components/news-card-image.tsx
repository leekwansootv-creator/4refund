"use client";

import Image from "next/image";
import { useState } from "react";

import styles from "./news-insights.module.css";

const fallbackImage = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/assets/news/article-fallback.png`;

/**
 * 기사 이미지 로드 실패를 고정 크기의 브랜드 이미지로 대체한다.
 * URL별 key로 이미지 교체 후의 실패 상태를 격리하고, 기본 이미지 실패는 재요청하지 않는다.
 */
export function NewsCardImage({ imageUrl }: { imageUrl: string | null }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const source = imageUrl && imageUrl !== failedUrl ? imageUrl : fallbackImage;

  return (
    <div className={styles.image}>
      <Image
        key={source}
        src={source}
        alt=""
        fill
        sizes="(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 411px"
        unoptimized
        referrerPolicy="no-referrer"
        onError={source === fallbackImage ? undefined : () => setFailedUrl(imageUrl)}
      />
    </div>
  );
}
