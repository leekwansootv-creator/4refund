import { afterEach, describe, expect, it, vi } from "vitest";

function collectAssetPaths(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  return Object.values(value).flatMap(collectAssetPaths);
}

describe("LANDING_ASSETS", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("기본 도메인에서는 루트 기준 자산 경로를 사용한다", async () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "");

    const { LANDING_ASSETS } = await import("./landing-assets");
    const assetPaths = collectAssetPaths(LANDING_ASSETS);

    expect(assetPaths.length).toBeGreaterThan(0);
    expect(assetPaths.every((path) => path.startsWith("/assets/landing/"))).toBe(true);
  });

  it("GitHub Pages에서는 저장소 basePath를 모든 자산 경로에 붙인다", async () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/4refund");

    const { LANDING_ASSETS } = await import("./landing-assets");
    const assetPaths = collectAssetPaths(LANDING_ASSETS);

    expect(assetPaths.length).toBeGreaterThan(0);
    expect(assetPaths.every((path) => path.startsWith("/4refund/assets/landing/"))).toBe(true);
  });
});
