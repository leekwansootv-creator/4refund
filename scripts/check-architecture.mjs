import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const SOURCE_FILE_PATTERN = /\.(?:[cm]?[jt]sx?)$/u;
const KEBAB_CASE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const SOURCE_NAME_PATTERN =
  /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.(?:client|server|test|spec))?\.(?:ts|tsx)$/u;

const APP_FILE_PATTERNS = [
  /^(?:page|layout|loading|not-found|error|global-error|template|default)\.(?:js|jsx|ts|tsx)$/u,
  /^route\.(?:js|ts)$/u,
  /^(?:sitemap|robots|manifest)\.(?:js|ts)$/u,
  /^(?:icon|apple-icon|opengraph-image|twitter-image)\.(?:js|jsx|ts|tsx|ico|jpg|jpeg|png|svg|gif)$/u,
  /^favicon\.ico$/u,
  /^robots\.txt$/u,
  /^sitemap\.xml$/u,
  /^manifest\.webmanifest$/u,
];

const FEATURE_DIRECTORIES = new Set([
  "actions",
  "api",
  "components",
  "constants",
  "hooks",
  "lib",
  "schemas",
  "server",
  "types",
]);

const SHARED_DIRECTORIES = new Set([
  "components",
  "config",
  "constants",
  "hooks",
  "lib",
  "schemas",
  "server",
  "styles",
  "types",
]);

const INTEGRATION_PROVIDERS = new Set(["google-apps-script"]);
const INTEGRATION_DIRECTORIES = new Set(["src"]);
const INTEGRATION_ROOT_FILES = new Set(["Code.gs", "README.md", "appsscript.json"]);

/**
 * 운영체제와 무관하게 진단 경로를 슬래시 표기로 통일한다.
 */
function toPosixPath(value) {
  return value.split(sep).join("/");
}

/**
 * 대상 디렉터리 아래의 모든 파일을 재귀적으로 수집한다.
 */
function walkFiles(directory) {
  if (!existsSync(directory)) {
    return [];
  }

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);

    return entry.isDirectory() ? walkFiles(entryPath) : [entryPath];
  });
}

/**
 * TypeScript AST에서 import, export-from, 동적 import의 모듈 경로를 추출한다.
 */
function collectImportSpecifiers(source, fileName) {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith(".tsx") || fileName.endsWith(".jsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const specifiers = [];

  /**
   * 모듈 경로를 갖는 구문만 재귀적으로 방문한다.
   */
  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    }

    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      specifiers.push(node.arguments[0].text);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return specifiers;
}

/**
 * 소스 파일을 app, 특정 feature, shared 경계 중 하나로 분류한다.
 */
function classifySourcePath(sourceRelativePath) {
  const segments = toPosixPath(sourceRelativePath).split("/");

  if (segments[0] === "app") {
    return { layer: "app" };
  }

  if (segments[0] === "features" && segments[1]) {
    return { feature: segments[1], layer: "feature" };
  }

  if (segments[0] === "shared") {
    return { layer: "shared" };
  }

  return { layer: "unknown" };
}

/**
 * 로컬 import를 src 기준 경로로 해석한다. 외부 패키지는 null을 반환한다.
 */
function resolveLocalImport(specifier, sourceFile, sourceRoot) {
  if (specifier.startsWith("@/")) {
    return resolve(sourceRoot, specifier.slice(2));
  }

  if (specifier.startsWith(".")) {
    return resolve(dirname(sourceFile), specifier);
  }

  return null;
}

/**
 * src 바로 아래에는 Next.js 진입 파일과 합의된 세 레이어만 허용한다.
 */
function checkSourceRoot(sourceRoot, errors) {
  const allowedDirectories = new Set(["app", "features", "shared"]);
  const allowedFiles = new Set(["instrumentation-client.ts", "instrumentation.ts", "proxy.ts"]);

  for (const entry of readdirSync(sourceRoot, { withFileTypes: true })) {
    if (entry.isDirectory() && !allowedDirectories.has(entry.name)) {
      errors.push(`src/${entry.name}: src 최상위 디렉터리는 app, features, shared만 허용됩니다.`);
    }

    if (entry.isFile() && !allowedFiles.has(entry.name)) {
      errors.push(`src/${entry.name}: src 최상위 파일은 Next.js 진입 파일만 허용됩니다.`);
    }
  }
}

/**
 * app 디렉터리가 라우팅과 Next.js 특수 파일만 보유하는지 확인한다.
 */
function checkAppDirectory(sourceRoot, errors) {
  const appRoot = join(sourceRoot, "app");

  for (const file of walkFiles(appRoot)) {
    const relativeFile = toPosixPath(relative(appRoot, file));
    const fileName = relativeFile.split("/").at(-1);
    const isGlobalStyle = relativeFile === "globals.css";
    const isNextSpecialFile =
      fileName && APP_FILE_PATTERNS.some((pattern) => pattern.test(fileName));

    if (!isGlobalStyle && !isNextSpecialFile) {
      errors.push(
        `src/app/${relativeFile}: app에는 라우트와 Next.js 특수 파일만 두고 구현은 features/shared로 이동하세요.`,
      );
    }
  }
}

/**
 * feature 이름, feature 내부 디렉터리, 일반 소스 파일 이름을 검사한다.
 */
function checkFeatureDirectory(sourceRoot, errors) {
  const featuresRoot = join(sourceRoot, "features");

  if (!existsSync(featuresRoot)) {
    return;
  }

  for (const featureEntry of readdirSync(featuresRoot, { withFileTypes: true })) {
    const featurePath = join(featuresRoot, featureEntry.name);

    if (!featureEntry.isDirectory()) {
      errors.push(`src/features/${featureEntry.name}: features 바로 아래에는 기능 폴더만 두세요.`);
      continue;
    }

    if (!KEBAB_CASE_PATTERN.test(featureEntry.name)) {
      errors.push(`src/features/${featureEntry.name}: 기능 폴더 이름은 kebab-case여야 합니다.`);
    }

    for (const entry of readdirSync(featurePath, { withFileTypes: true })) {
      if (entry.isDirectory() && !FEATURE_DIRECTORIES.has(entry.name)) {
        errors.push(
          `src/features/${featureEntry.name}/${entry.name}: 허용되지 않은 feature 하위 디렉터리입니다.`,
        );
      }

      if (entry.isFile() && !["README.md", "index.ts"].includes(entry.name)) {
        errors.push(
          `src/features/${featureEntry.name}/${entry.name}: feature 루트 파일은 index.ts와 README.md만 허용됩니다.`,
        );
      }
    }

    checkSourceFileNames(featurePath, sourceRoot, errors);
  }
}

/**
 * shared가 비즈니스 기능과 섞이지 않도록 허용된 공용 디렉터리만 검사한다.
 */
function checkSharedDirectory(sourceRoot, errors) {
  const sharedRoot = join(sourceRoot, "shared");

  if (!existsSync(sharedRoot)) {
    return;
  }

  for (const entry of readdirSync(sharedRoot, { withFileTypes: true })) {
    if (entry.isDirectory() && !SHARED_DIRECTORIES.has(entry.name)) {
      errors.push(`src/shared/${entry.name}: 허용되지 않은 shared 하위 디렉터리입니다.`);
    }

    if (entry.isFile() && entry.name !== "README.md") {
      errors.push(`src/shared/${entry.name}: shared 루트에는 README.md 외의 파일을 두지 마세요.`);
    }
  }

  checkSourceFileNames(sharedRoot, sourceRoot, errors);
}

/**
 * Next.js 특수 파일 밖의 TypeScript 파일 이름을 kebab-case로 고정한다.
 */
function checkSourceFileNames(directory, sourceRoot, errors) {
  for (const file of walkFiles(directory)) {
    const fileName = file.split(sep).at(-1);

    if (!fileName || !SOURCE_FILE_PATTERN.test(fileName) || fileName === "index.ts") {
      continue;
    }

    if (!SOURCE_NAME_PATTERN.test(fileName)) {
      errors.push(
        `${toPosixPath(relative(sourceRoot, file))}: 소스 파일 이름은 kebab-case와 선택적 client/server/test/spec 접미사를 사용하세요.`,
      );
    }
  }
}

/**
 * app -> feature -> shared 단방향 의존성과 feature 공개 진입점 사용을 검사한다.
 */
function checkImportBoundaries(sourceRoot, errors) {
  for (const sourceFile of walkFiles(sourceRoot).filter((file) => SOURCE_FILE_PATTERN.test(file))) {
    const sourceRelativePath = relative(sourceRoot, sourceFile);
    const sourceClassification = classifySourcePath(sourceRelativePath);
    const source = readFileSync(sourceFile, "utf8");

    for (const specifier of collectImportSpecifiers(source, sourceFile)) {
      const targetPath = resolveLocalImport(specifier, sourceFile, sourceRoot);

      if (!targetPath) {
        continue;
      }

      const targetRelativePath = relative(sourceRoot, targetPath);

      if (targetRelativePath.startsWith("..") || targetRelativePath === "") {
        continue;
      }

      const targetClassification = classifySourcePath(targetRelativePath);
      const displayPath = toPosixPath(sourceRelativePath);

      if (specifier.startsWith(".") && sourceClassification.layer !== targetClassification.layer) {
        errors.push(
          `${displayPath}: 레이어를 넘는 import "${specifier}"는 @/ 절대 경로를 사용하세요.`,
        );
      }

      if (
        sourceClassification.layer === "shared" &&
        ["app", "feature"].includes(targetClassification.layer)
      ) {
        errors.push(`${displayPath}: shared는 app 또는 features를 import할 수 없습니다.`);
      }

      if (sourceClassification.layer === "feature" && targetClassification.layer === "app") {
        errors.push(`${displayPath}: feature는 app을 import할 수 없습니다.`);
      }

      if (
        sourceClassification.layer === "feature" &&
        targetClassification.layer === "feature" &&
        sourceClassification.feature !== targetClassification.feature
      ) {
        const publicSpecifier = `@/features/${targetClassification.feature}`;

        if (specifier !== publicSpecifier) {
          errors.push(
            `${displayPath}: 다른 feature는 공개 진입점 "${publicSpecifier}"로만 import하세요.`,
          );
        }
      }
    }
  }
}

/**
 * server와 actions 디렉터리가 실행 환경을 코드에 명시하는지 검사한다.
 */
function checkRuntimeBoundaries(sourceRoot, errors) {
  for (const file of walkFiles(sourceRoot).filter((entry) => SOURCE_FILE_PATTERN.test(entry))) {
    const relativeFile = toPosixPath(relative(sourceRoot, file));
    const segments = relativeFile.split("/");
    const source = readFileSync(file, "utf8");

    if (segments.includes("server") && !/^\s*import\s+["']server-only["'];?/mu.test(source)) {
      errors.push(`${relativeFile}: server 디렉터리의 모듈은 import "server-only"를 선언하세요.`);
    }

    if (segments.includes("actions") && !/^\s*["']use server["'];?/u.test(source)) {
      errors.push(`${relativeFile}: actions 디렉터리의 모듈은 "use server"로 시작해야 합니다.`);
    }
  }
}

/**
 * 별도 배포 integration의 provider, app 구조와 제품 feature 공개 경계를 검사한다.
 */
function checkIntegrationDirectory(projectRoot, sourceRoot, errors) {
  const integrationsRoot = join(projectRoot, "integrations");

  if (!existsSync(integrationsRoot)) {
    return;
  }

  for (const providerEntry of readdirSync(integrationsRoot, { withFileTypes: true })) {
    const providerPath = join(integrationsRoot, providerEntry.name);

    if (!providerEntry.isDirectory() || !INTEGRATION_PROVIDERS.has(providerEntry.name)) {
      errors.push(
        `integrations/${providerEntry.name}: 허용된 integration provider는 google-apps-script뿐입니다.`,
      );
      continue;
    }

    for (const appEntry of readdirSync(providerPath, { withFileTypes: true })) {
      const appPath = join(providerPath, appEntry.name);
      const displayRoot = `integrations/${providerEntry.name}/${appEntry.name}`;

      if (!appEntry.isDirectory() || !KEBAB_CASE_PATTERN.test(appEntry.name)) {
        errors.push(`${displayRoot}: integration 이름은 kebab-case 폴더여야 합니다.`);
        continue;
      }

      for (const entry of readdirSync(appPath, { withFileTypes: true })) {
        if (entry.isDirectory() && !INTEGRATION_DIRECTORIES.has(entry.name)) {
          errors.push(`${displayRoot}/${entry.name}: 허용되지 않은 integration 하위 폴더입니다.`);
        }

        if (entry.isFile() && !INTEGRATION_ROOT_FILES.has(entry.name)) {
          errors.push(`${displayRoot}/${entry.name}: 허용되지 않은 integration 루트 파일입니다.`);
        }
      }

      checkSourceFileNames(join(appPath, "src"), projectRoot, errors);

      for (const sourceFile of walkFiles(join(appPath, "src")).filter((file) =>
        SOURCE_FILE_PATTERN.test(file),
      )) {
        const source = readFileSync(sourceFile, "utf8");
        const displayPath = toPosixPath(relative(projectRoot, sourceFile));

        for (const specifier of collectImportSpecifiers(source, sourceFile)) {
          const targetPath = resolveLocalImport(specifier, sourceFile, sourceRoot);

          if (!targetPath) {
            continue;
          }

          const targetRelativePath = relative(sourceRoot, targetPath);

          if (targetRelativePath.startsWith("..") || targetRelativePath === "") {
            continue;
          }

          const targetClassification = classifySourcePath(targetRelativePath);

          if (targetClassification.layer === "app") {
            errors.push(`${displayPath}: integration은 app을 import할 수 없습니다.`);
          }

          if (targetClassification.layer === "feature") {
            const publicSpecifier = `@/features/${targetClassification.feature}`;

            if (specifier !== publicSpecifier) {
              errors.push(
                `${displayPath}: integration은 feature 공개 진입점 "${publicSpecifier}"로만 import하세요.`,
              );
            }
          }
        }
      }
    }
  }
}

/**
 * 저장소의 폴더 구조와 의존성 방향을 검사하고 진단 목록을 반환한다.
 */
export function checkArchitecture(
  projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), ".."),
) {
  const sourceRoot = join(projectRoot, "src");
  const errors = [];

  if (!existsSync(sourceRoot) || !statSync(sourceRoot).isDirectory()) {
    return ["src: 애플리케이션 소스 디렉터리가 없습니다."];
  }

  checkSourceRoot(sourceRoot, errors);
  checkAppDirectory(sourceRoot, errors);
  checkFeatureDirectory(sourceRoot, errors);
  checkSharedDirectory(sourceRoot, errors);
  checkImportBoundaries(sourceRoot, errors);
  checkRuntimeBoundaries(sourceRoot, errors);
  checkIntegrationDirectory(projectRoot, sourceRoot, errors);

  return errors;
}

const currentFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1] ? resolve(process.argv[1]) : "";

if (currentFile === invokedFile) {
  const errors = checkArchitecture();

  if (errors.length > 0) {
    console.error(
      ["Architecture check failed:", ...errors.map((error) => `- ${error}`)].join("\n"),
    );
    process.exitCode = 1;
  } else {
    console.log("Architecture check passed.");
  }
}
