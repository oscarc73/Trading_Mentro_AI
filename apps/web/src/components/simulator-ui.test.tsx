import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Dataset } from "@/domain/types";
import { Simulator } from "./simulator";

vi.mock("./candle-chart", () => ({
  CandleChart: ({ candles }: { candles: unknown[] }) => (
    <div data-testid="chart">{candles.length} candles</div>
  ),
}));

const dataset: Dataset = {
  metadata: {
    id: "test",
    asset: "TEST/USD",
    timeframe: "1h",
    currency: "USD",
    data_kind: "historical-generated",
    source: "test",
    generated_at: "2026-08-01T00:00:00Z",
  },
  candles: Array.from({ length: 13 }, (_, index) => ({
    timestamp: new Date(Date.UTC(2025, 0, 1, index)).toISOString(),
    open: String(100 + index),
    high: String(102 + index),
    low: String(99 + index),
    close: String(101 + index),
    volume: "10",
  })),
};

describe("Simulator critical flow", () => {
  it("applies configured quantity and costs to a complete long flow", () => {
    render(<Simulator dataset={dataset} />);
    expect(screen.getByTestId("chart").textContent).toBe("12 candles");

    fireEvent.change(screen.getByLabelText("Quantity (BTC)"), {
      target: { value: "0.5" },
    });
    fireEvent.change(screen.getByLabelText("Fee (bps/fill)"), {
      target: { value: "5" },
    });
    fireEvent.change(screen.getByLabelText("Slippage (bps/fill)"), {
      target: { value: "10" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Buy Open long" }));
    expect(screen.getByText("LONG · 0.5 BTC")).toBeTruthy();
    expect(
      (screen.getByLabelText("Quantity (BTC)") as HTMLInputElement).disabled,
    ).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Reveal next candle" }));
    expect(screen.getByTestId("chart").textContent).toBe("13 candles");

    fireEvent.click(screen.getByRole("button", { name: "Close position" }));
    expect(screen.getByRole("heading", { name: "Long result" })).toBeTruthy();
    expect(screen.getByText("$0.33")).toBeTruthy();
    expect(screen.getByText("$0.11")).toBeTruthy();
    expect(screen.getByText(/order-1 → fill-1/)).toBeTruthy();
  });

  it("shows invalid settings and prevents order submission", () => {
    render(<Simulator dataset={dataset} />);
    fireEvent.change(screen.getByLabelText("Quantity (BTC)"), {
      target: { value: "0" },
    });
    expect(screen.getByRole("alert").textContent).toContain(
      "Quantity must be a positive finite decimal value.",
    );
    expect(
      (
        screen.getByRole("button", {
          name: "Buy Open long",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
});
