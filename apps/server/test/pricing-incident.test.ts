import { describe, expect, it } from "vitest";

describe("pricing incident reminders", () => {
  it("suppresses repeats for seven days and allows weekly reminders", async () => {
    const moduleUrl = new URL("../../../scripts/report-pricing-incident.mjs", import.meta.url).href;
    const { shouldSendIncidentReminder } = (await import(moduleUrl)) as {
      shouldSendIncidentReminder: (lastReminderAt: string, now: Date) => boolean;
    };
    const lastReminderAt = "2026-08-01T06:17:00.000Z";

    expect(shouldSendIncidentReminder(lastReminderAt, new Date("2026-08-08T06:16:59.999Z"))).toBe(false);
    expect(shouldSendIncidentReminder(lastReminderAt, new Date("2026-08-08T06:17:00.000Z"))).toBe(true);
  });
});
