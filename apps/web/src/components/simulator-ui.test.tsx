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
  it("opens, advances, and closes a long position with a visible result", () => {
    render(<Simulator dataset={dataset} />);
    expect(screen.getByTestId("chart").textContent).toBe("12 candles");

    fireEvent.click(screen.getByRole("button", { name: "Buy Open long" }));
    expect(screen.getByText("LONG · 1 BTC")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Reveal next candle" }));
    expect(screen.getByTestId("chart").textContent).toBe("13 candles");

    fireEvent.click(screen.getByRole("button", { name: "Close position" }));
    expect(screen.getByRole("heading", { name: "Long result" })).toBeTruthy();
    expect(screen.getByText("$1.00")).toBeTruthy();
  });
});
