import { describe, expect, it, vi } from "vitest";
import { findAvailablePort } from "../src/port.js";

describe("findAvailablePort", () => {
  it("falls forward when the preferred port is already in use", async () => {
    const probe = vi
      .fn<Parameters<typeof findAvailablePort>[3]>()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    await expect(findAvailablePort("127.0.0.1", 3001, 5, probe)).resolves.toBe(3002);
    expect(probe).toHaveBeenNthCalledWith(1, "127.0.0.1", 3001);
    expect(probe).toHaveBeenNthCalledWith(2, "127.0.0.1", 3002);
  });
});
