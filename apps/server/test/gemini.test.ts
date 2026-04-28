import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parseGeminiSessionFile } from "../src/gemini.js";
import { listGeminiSessionFiles } from "../src/discovery.js";

const TEST_GEMINI_HOME = path.join(process.cwd(), "test-gemini-home-server");

function cleanup() {
  if (fs.existsSync(TEST_GEMINI_HOME)) {
    fs.rmSync(TEST_GEMINI_HOME, { recursive: true, force: true });
  }
}

describe("Gemini Integration", () => {
  afterEach(cleanup);

  it("should discover and parse Gemini session files", () => {
    cleanup();
    fs.mkdirSync(path.join(TEST_GEMINI_HOME, "tmp", "hash123", "chats"), { recursive: true });
    
    const sessionContent = {
      sessionId: "test-session-1",
      messages: [
        {
          id: "msg-1",
          timestamp: "2024-03-15T10:00:00.000Z",
          type: "user",
          content: "Hello Gemini",
          tokens: {
            input: 0,
            output: 0,
            cached: 0,
            thoughts: 0,
            tool: 0,
            total: 0
          }
        },
        {
          id: "msg-2",
          timestamp: "2024-03-15T10:00:05.000Z",
          type: "gemini",
          model: "gemini-1.5-pro",
          content: "Hello User",
          tokens: {
            input: 10,
            output: 20,
            cached: 0,
            thoughts: 0,
            tool: 0,
            total: 30
          }
        }
      ]
    };

    const filePath = path.join(TEST_GEMINI_HOME, "tmp", "hash123", "chats", "session-1.json");
    fs.writeFileSync(filePath, JSON.stringify(sessionContent));

    const files = listGeminiSessionFiles(TEST_GEMINI_HOME);
    expect(files).toHaveLength(1);
    expect(files[0]!.path).toBe(filePath);

    const result = parseGeminiSessionFile(filePath);
    expect(result.events).toHaveLength(1);
    expect(result.prompts).toHaveLength(1);
    
    expect(result.events[0]!).toMatchObject({
      sessionId: "test-session-1",
      provider: "google",
      model: "gemini-1.5-pro",
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 30,
      transport: "gemini_cli"
    });

    expect(result.prompts[0]!.sessionId).toBe("test-session-1");
    expect(result.prompts[0]!.ts).toBe(Date.parse("2024-03-15T10:00:00.000Z"));
    expect(result.prompts[0]!.previewText).toBe("Hello Gemini");
  });

  it("should return empty results for invalid files", () => {
    const filePath = path.join(process.cwd(), "invalid.json");
    fs.writeFileSync(filePath, "invalid json");
    
    const result = parseGeminiSessionFile(filePath);
    expect(result.events).toHaveLength(0);
    expect(result.prompts).toHaveLength(0);
    
    fs.unlinkSync(filePath);
  });
});
