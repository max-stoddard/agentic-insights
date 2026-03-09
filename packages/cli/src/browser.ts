import { spawn } from "node:child_process";

export interface BrowserLaunchSpec {
  args: string[];
  command: string;
}

export function getBrowserLaunchSpec(url: string, platform = process.platform): BrowserLaunchSpec | null {
  switch (platform) {
    case "darwin":
      return {
        command: "open",
        args: [url]
      };
    case "win32":
      return {
        command: "cmd",
        args: ["/c", "start", "", url]
      };
    case "linux":
      return {
        command: "xdg-open",
        args: [url]
      };
    default:
      return null;
  }
}

export async function openBrowser(url: string, platform = process.platform): Promise<boolean> {
  const spec = getBrowserLaunchSpec(url, platform);
  if (!spec) {
    return false;
  }

  return new Promise((resolve) => {
    const child = spawn(spec.command, spec.args, {
      detached: true,
      stdio: "ignore"
    });

    child.once("error", () => {
      resolve(false);
    });

    child.once("spawn", () => {
      child.unref();
      resolve(true);
    });
  });
}
