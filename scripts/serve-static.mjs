import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, isAbsolute, relative, resolve } from "node:path";

const outputDirectory = resolve(process.cwd(), "out");
const host = process.env.STATIC_HOST ?? "127.0.0.1";
const port = Number.parseInt(process.env.STATIC_PORT ?? "3000", 10);

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error("STATIC_PORT must be an integer between 1 and 65535.");
}

async function findStaticFile(pathname) {
  const candidates =
    pathname === "/"
      ? ["/index.html"]
      : pathname.endsWith("/")
        ? [`${pathname}index.html`]
        : extname(pathname)
          ? [pathname]
          : [pathname, `${pathname}.html`, `${pathname}/index.html`];

  for (const candidate of candidates) {
    const absolutePath = resolve(outputDirectory, `.${candidate}`);
    const relativePath = relative(outputDirectory, absolutePath);

    // Requests must never escape the generated export directory.
    if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
      return null;
    }

    try {
      if ((await stat(absolutePath)).isFile()) {
        return absolutePath;
      }
    } catch (error) {
      if (error?.code !== "ENOENT") {
        throw error;
      }
    }
  }

  return null;
}

function sendFile(request, response, filePath, statusCode = 200) {
  response.writeHead(statusCode, {
    "Content-Type": contentTypes.get(extname(filePath).toLowerCase()) ?? "application/octet-stream",
  });

  if (request.method === "HEAD") {
    response.end();
    return;
  }

  createReadStream(filePath).pipe(response);
}

const server = createServer(async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end();
    return;
  }

  try {
    const requestUrl = new URL(request.url ?? "/", `http://${host}:${port}`);
    const pathname = decodeURIComponent(requestUrl.pathname);
    const filePath = await findStaticFile(pathname);

    if (filePath) {
      sendFile(request, response, filePath);
      return;
    }

    const notFoundPath = await findStaticFile("/404.html");

    if (notFoundPath) {
      sendFile(request, response, notFoundPath, 404);
      return;
    }

    response.writeHead(404);
    response.end();
  } catch {
    response.writeHead(400);
    response.end();
  }
});

server.listen(port, host, () => {
  console.log(`Serving ${outputDirectory} at http://${host}:${port}`);
});
