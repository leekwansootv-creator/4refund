import { spawnSync } from "node:child_process";

// 일반 E2E는 실제 저장 주소 대신 각 테스트가 POST를 가로채는 전용 빌드를 사용합니다.
const live = process.env.QUICK_ESTIMATE_LIVE_E2E === "1";
const result = spawnSync(process.execPath, ["node_modules/next/dist/bin/next", "build"], {
  stdio: "inherit",
  env: {
    ...process.env,
    ...(live
      ? {}
      : {
          NEXT_PUBLIC_QUICK_ESTIMATE_APPS_SCRIPT_URL:
            "https://script.google.com/macros/s/E2E-INTERCEPT-ONLY/exec",
        }),
  },
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
