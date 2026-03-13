import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { WaterScaleChart } from "../src/components/WaterScaleChart";

afterEach(() => {
  cleanup();
});

describe("WaterScaleChart", () => {
  const waterLitres = {
    low: 0.5,
    central: 1.2,
    high: 2.1
  };

  it("shows a tooltip for a hovered comparison point with exact litres and description", () => {
    render(<WaterScaleChart waterLitres={waterLitres} />);

    fireEvent.mouseEnter(screen.getByTestId("water-scale-hit-cup-of-water"));

    const tooltip = screen.getByTestId("water-scale-tooltip");
    expect(tooltip).toHaveTextContent("A cup of water");
    expect(tooltip).toHaveTextContent("240.0 mL");
    expect(tooltip).toHaveTextContent("Direct Intake");
    expect(tooltip).toHaveTextContent("The volume of one metric cup of drinking water.");
    expect(tooltip).toHaveTextContent("Uses NIST's 1 cup = 240 mL conversion.");
  });

  it("shows the AI range tooltip when the AI marker is focused", () => {
    render(<WaterScaleChart waterLitres={waterLitres} />);

    fireEvent.focus(screen.getByTestId("water-scale-hit-ai"));

    const tooltip = screen.getByTestId("water-scale-tooltip");
    expect(tooltip).toHaveTextContent("Your AI usage");
    expect(tooltip).toHaveTextContent("1.20 L");
    expect(tooltip).toHaveTextContent("Between 500.0 mL and 2.10 L");
  });

  it("supports keyboard focus for fixed comparison points", () => {
    render(<WaterScaleChart waterLitres={waterLitres} />);

    fireEvent.focus(screen.getByTestId("water-scale-hit-manufacturing-a-car"));

    const tooltip = screen.getByTestId("water-scale-tooltip");
    expect(tooltip).toHaveTextContent("A car");
    expect(tooltip).toHaveTextContent("67,500 L");
    expect(tooltip).toHaveTextContent(/more than 95% occurs in the production phase/i);
  });
});
