import { build } from "esbuild";
import { mkdir, copyFile } from "node:fs/promises";
import { resolve } from "node:path";

/** React를 포함하지 않는 loader와 외부 CSP용 stylesheet만 생성합니다. */
export async function buildEmbedLoader(
  destination = "public/embed/v1",
  pageRelative = "../quick-estimate.html",
  release = "1.0.0",
) {
  await mkdir(destination, { recursive: true });
  await build({
    entryPoints: ["src/features/quick-estimate/lib/embed-loader.ts"],
    bundle: true,
    outfile: resolve(destination, "loader.js"),
    format: "iife",
    target: "es2020",
    minify: true,
    define: {
      EMBED_PAGE_RELATIVE: JSON.stringify(pageRelative),
      "process.env.NEXT_PUBLIC_EMBED_RELEASE": JSON.stringify(release),
    },
  });
  await copyFile(
    "src/features/quick-estimate/components/embed-shell.css",
    resolve(destination, "shell.css"),
  );
}

if (process.argv[1] && resolve(process.argv[1]) === resolve("scripts/build-embed-loader.mjs"))
  await buildEmbedLoader();
