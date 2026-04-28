import { describe, expect, it } from "vitest";
import { formatCarbon, formatCarbonIntensity, formatCompactNumber, formatCompactUsdCost, formatEnergy, formatScaledLitres, formatUsdCost } from "../src/lib/format";

describe("formatCompactNumber", () => {
  it("formats small values without suffixes", () => {
    expect(formatCompactNumber(1)).toBe("1");
    expect(formatCompactNumber(12)).toBe("12");
    expect(formatCompactNumber(123)).toBe("123");
  });

  it("formats larger values with compact suffixes and roughly three significant figures", () => {
    expect(formatCompactNumber(1234)).toBe("1.23K");
    expect(formatCompactNumber(12_345)).toBe("12.3K");
    expect(formatCompactNumber(1_234_567)).toBe("1.23M");
  });
});

describe("formatScaledLitres", () => {
  it("formats litre scales without splitting unit abbreviations", () => {
    expect(formatScaledLitres(0.24)).toBe("240 mL");
    expect(formatScaledLitres(2.25)).toBe("2.25 L");
    expect(formatScaledLitres(515_000)).toBe("515 KL");
    expect(formatScaledLitres(1_000_000)).toBe("1.0 ML");
    expect(formatScaledLitres(67_500)).toBe("67.5 KL");
  });
});

describe("formatUsdCost", () => {
  it("keeps sub-dollar values precise enough to avoid rounding them down to zero", () => {
    expect(formatUsdCost(0.0325)).toBe("$0.0325");
    expect(formatUsdCost(0.004567)).toBe("$0.004567");
  });

  it("formats multi-dollar values as standard currency", () => {
    expect(formatUsdCost(12.5)).toBe("$12.50");
  });
});

describe("formatCompactUsdCost", () => {
  it("keeps chart axis labels short while preserving small-value precision", () => {
    expect(formatCompactUsdCost(12.534)).toBe("$12.5");
    expect(formatCompactUsdCost(1.2534)).toBe("$1.25");
    expect(formatCompactUsdCost(0.004567)).toBe("$0.00457");
  });
});

describe("formatEnergy", () => {
  it("formats sub-kilowatt-hour values as watt-hours", () => {
    expect(formatEnergy(0.004)).toBe("4.0 Wh");
    expect(formatEnergy(0.168)).toBe("168 Wh");
  });

  it("formats larger values as kilowatt-hours", () => {
    expect(formatEnergy(1.25)).toBe("1.25 kWh");
    expect(formatEnergy(12.4)).toBe("12.4 kWh");
  });
});

describe("formatCarbon", () => {
  it("formats sub-kilogram values as grams of CO2", () => {
    expect(formatCarbon(0.00178)).toBe("1.8 g CO2");
    expect(formatCarbon(0.07476)).toBe("75 g CO2");
  });

  it("formats larger values as kilograms of CO2", () => {
    expect(formatCarbon(1.25)).toBe("1.25 kg CO2");
    expect(formatCarbon(12.4)).toBe("12.4 kg CO2");
  });
});

describe("formatCarbonIntensity", () => {
  it("formats electricity carbon intensity in grams per kilowatt-hour", () => {
    expect(formatCarbonIntensity(0.445)).toBe("445 g CO2/kWh");
  });
});
