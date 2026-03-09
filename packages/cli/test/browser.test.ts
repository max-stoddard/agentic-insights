import { describe, expect, it } from "vitest";
import { getBrowserLaunchSpec } from "../src/browser.js";
import { formatUrl, resolveBrowserHost } from "../src/config.js";

describe("browser launch selection", () => {
  it("uses platform-specific browser commands", () => {
    expect(getBrowserLaunchSpec("http://127.0.0.1:3001", "darwin")).toEqual({
      command: "open",
      args: ["http://127.0.0.1:3001"]
    });
    expect(getBrowserLaunchSpec("http://127.0.0.1:3001", "linux")).toEqual({
      command: "xdg-open",
      args: ["http://127.0.0.1:3001"]
    });
    expect(getBrowserLaunchSpec("http://127.0.0.1:3001", "win32")).toEqual({
      command: "cmd",
      args: ["/c", "start", "", "http://127.0.0.1:3001"]
    });
  });

  it("normalizes wildcard hosts for the browser URL", () => {
    expect(resolveBrowserHost("0.0.0.0")).toBe("127.0.0.1");
    expect(formatUrl("::1", 3001)).toBe("http://[::1]:3001");
  });
});
