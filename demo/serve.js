import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

// Serve this repo's files, nothing else.
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const home = "/demo/staging.html";
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

createServer(async (request, response) => {
  const pathname = new URL(request.url, "http://localhost").pathname;
  if (pathname === "/" || pathname === "/demo/") {
    response.writeHead(302, { Location: home }).end();
    return;
  }
  const file = resolve(root, `.${pathname}`);
  if (!file.startsWith(`${root}${sep}`)) {
    response.writeHead(403).end();
    return;
  }
  try {
    const content = await readFile(file);
    response.writeHead(200, {
      "Content-Type": types[extname(file)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    response.end(content);
  } catch {
    response.writeHead(404).end();
  }
}).listen(4174, "127.0.0.1", () => {
  console.log(`Kennedyish Weather Card preview: http://127.0.0.1:4174${home}`);
});
