import fs from "node:fs";
import path from "node:path";
import type { FastifyInstance, FastifyReply } from "fastify";

const MIME_TYPES = new Map<string, string>([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"]
]);

function getContentType(filePath: string): string {
  return MIME_TYPES.get(path.extname(filePath)) ?? "application/octet-stream";
}

function isInsideDir(rootDir: string, candidatePath: string): boolean {
  return candidatePath === rootDir || candidatePath.startsWith(`${rootDir}${path.sep}`);
}

function sendFile(reply: FastifyReply, filePath: string): FastifyReply {
  reply.header("Cache-Control", filePath.endsWith(".html") ? "no-cache" : "public, max-age=31536000, immutable");
  reply.type(getContentType(filePath));
  return reply.send(fs.createReadStream(filePath));
}

export function registerStaticRoutes(app: FastifyInstance, webDistDir: string): void {
  const rootDir = path.resolve(webDistDir);
  const indexPath = path.join(rootDir, "index.html");

  if (!fs.existsSync(indexPath)) {
    throw new Error(`Web entrypoint was not found at ${indexPath}`);
  }

  app.get("/", async (_request, reply) => sendFile(reply, indexPath));

  app.get("/*", async (request, reply) => {
    const pathname = new URL(request.raw.url ?? "/", "http://127.0.0.1").pathname;
    if (pathname === "/" || pathname.startsWith("/api/")) {
      return reply.callNotFound();
    }

    let relativePath: string;
    try {
      relativePath = decodeURIComponent(pathname.slice(1));
    } catch {
      return reply.callNotFound();
    }

    const candidatePath = path.resolve(rootDir, relativePath);
    if (isInsideDir(rootDir, candidatePath) && fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile()) {
      return sendFile(reply, candidatePath);
    }

    return sendFile(reply, indexPath);
  });
}
