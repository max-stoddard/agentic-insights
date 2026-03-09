import net from "node:net";

export type PortAvailabilityProbe = (host: string, port: number) => Promise<boolean>;

function isRetryablePortError(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return false;
  }

  const code = (error as { code?: string }).code;
  return code === "EADDRINUSE" || code === "EACCES";
}

function canListen(host: string, port: number): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once("error", (error) => {
      server.close();
      if (isRetryablePortError(error)) {
        resolve(false);
        return;
      }

      reject(error);
    });

    server.once("listening", () => {
      server.close(() => resolve(true));
    });

    server.listen(port, host);
  });
}

export async function findAvailablePort(
  host: string,
  preferredPort: number,
  maxAttempts = 25,
  probe: PortAvailabilityProbe = canListen
): Promise<number> {
  for (let offset = 0; offset < maxAttempts; offset += 1) {
    const candidate = preferredPort + offset;
    if (candidate > 65_535) {
      break;
    }

    if (await probe(host, candidate)) {
      return candidate;
    }
  }

  throw new Error(`Could not find an available port starting from ${preferredPort}.`);
}
