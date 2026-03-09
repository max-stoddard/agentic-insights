import { describe, expect, it } from "vitest";
import { CliArgumentError, parseCliArgs } from "../src/args.js";
import { resolveCodexHome } from "../src/config.js";

describe("parseCliArgs", () => {
  it("parses the supported launcher flags", () => {
    expect(
      parseCliArgs(["--port", "4100", "--host", "0.0.0.0", "--codex-home", "./custom", "--no-open"])
    ).toEqual({
      codexHome: "./custom",
      help: false,
      host: "0.0.0.0",
      openBrowser: false,
      preferredPort: 4100
    });
  });

  it("rejects unknown or invalid arguments", () => {
    expect(() => parseCliArgs(["--port", "0"])).toThrow(CliArgumentError);
    expect(() => parseCliArgs(["--unknown"])).toThrow(CliArgumentError);
  });
});

describe("resolveCodexHome", () => {
  it("prefers the CLI value over CODEX_HOME", () => {
    const resolved = resolveCodexHome("./cli-home", "/tmp/env-home");
    expect(resolved.endsWith("/cli-home")).toBe(true);
  });

  it("falls back to CODEX_HOME when the CLI flag is not present", () => {
    expect(resolveCodexHome(null, "/tmp/env-home")).toBe("/tmp/env-home");
  });
});
