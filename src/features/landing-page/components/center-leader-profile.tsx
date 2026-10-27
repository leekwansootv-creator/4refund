import Image from "next/image";

import styles from "./center-leader-profile.module.css";

type CenterLeaderProfileProps = {
  heading: string;
  name: string;
  role: string;
  credentials: readonly string[];
  image: { src: string; position: "left" | "right"; crop?: "deputy" };
};

/**
 * 확정된 인물 소개 한 행을 표시한다. 인물 추가는 검증된 콘텐츠를 전달하는 쪽에서 결정한다.
 * 모바일은 항상 사진 뒤에 이름·경력을 읽도록 하고, 긴 경력 때문에 고정 높이로 잘리지 않게 한다.
 */
export function CenterLeaderProfile({
  heading,
  name,
  role,
  credentials,
  image,
}: CenterLeaderProfileProps) {
  return (
    <article
      className={styles.profile}
      data-image-position={image.position}
      aria-label={`${heading} ${name}`}
    >
      <h3 className={styles.heading}>{heading}</h3>
      <div className={styles.figure} data-crop={image.crop}>
        <div className={styles.artwork} data-crop={image.crop}>
          <Image
            src={image.src}
            alt={`${heading} ${name}`}
            fill
            sizes="(max-width: 767px) 100vw, 515px"
          />
        </div>
      </div>
      <div className={styles.details}>
        <p className={styles.name}>
          <strong>{name}</strong> {role}
        </p>
        <ul className={styles.credentials}>
          {credentials.map((credential) => (
            <li key={credential}>{credential}</li>
          ))}
        </ul>
      </div>
    </article>
  );
}
