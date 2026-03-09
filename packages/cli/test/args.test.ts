import path from "node:path";
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
    const cliPath = "./cli-home";
    const resolved = resolveCodexHome(cliPath, path.join(path.sep, "tmp", "env-home"));
    expect(resolved).toBe(path.resolve(cliPath));
  });

  it("falls back to CODEX_HOME when the CLI flag is not present", () => {
    const envPath = path.join(path.sep, "tmp", "env-home");
    expect(resolveCodexHome(null, envPath)).toBe(path.resolve(envPath));
  });
});
