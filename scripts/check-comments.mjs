import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_FILE_PATTERN = /\.(?:css|[cm]?[jt]sx?)$/u;
const COMMENT_PATTERN = /\/\*[\s\S]*?\*\/|\/\/.*$/gmu;
const TRACKED_TODO_PATTERN = /\bTODO\(#\d+\):/u;

/**
 * 대상 디렉터리 아래의 검사 가능한 소스 파일을 수집한다.
 */
function walkSourceFiles(directory) {
  if (!existsSync(directory)) {
    return [];
  }

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      return walkSourceFiles(entryPath);
    }

    return SOURCE_FILE_PATTERN.test(entry.name) ? [entryPath] : [];
  });
}

/**
 * 추적되지 않는 TODO와 임시 표식을 찾아 진단 목록을 반환한다.
 */
export function checkComments(
  projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), ".."),
) {
  const sourceRoot = join(projectRoot, "src");
  const errors = [];

  for (const file of walkSourceFiles(sourceRoot)) {
    const source = readFileSync(file, "utf8");
    const displayPath = relative(projectRoot, file).split(sep).join("/");

    for (const match of source.matchAll(COMMENT_PATTERN)) {
      const comment = match[0];
      const line = source.slice(0, match.index).split(/\r?\n/u).length;

      if (/\b(?:FIXME|XXX)\b/iu.test(comment)) {
        errors.push(`${displayPath}:${line}: FIXME와 XXX 대신 이슈로 추적하세요.`);
      }

      if (/\bTODO\b/iu.test(comment) && !TRACKED_TODO_PATTERN.test(comment)) {
        errors.push(`${displayPath}:${line}: TODO는 TODO(#이슈번호): 형식으로 작성하세요.`);
      }
    }
  }

  return errors;
}

const currentFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1] ? resolve(process.argv[1]) : "";

if (currentFile === invokedFile) {
  const errors = checkComments();

  if (errors.length > 0) {
    console.error(["Comment check failed:", ...errors.map((error) => `- ${error}`)].join("\n"));
    process.exitCode = 1;
  } else {
    console.log("Comment check passed.");
  }
}
