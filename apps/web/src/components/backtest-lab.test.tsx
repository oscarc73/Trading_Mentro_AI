import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BacktestRecord, Dataset } from "@/domain/types";
import { BacktestLab } from "./backtest-lab";

const createBacktest = vi.fn();
const fetchDataset = vi.fn();
const getBacktest = vi.fn();
const listBacktests = vi.fn();

vi.mock("@/domain/session-api", () => ({
  createBacktest: (...arguments_: unknown[]) => createBacktest(...arguments_),
  fetchDataset: (...arguments_: unknown[]) => fetchDataset(...arguments_),
  getBacktest: (...arguments_: unknown[]) => getBacktest(...arguments_),
  listBacktests: (...arguments_: unknown[]) => listBacktests(...arguments_),
}));

const dataset: Dataset = {
  fingerprint: "a".repeat(64),
  metadata: {
    id: "btc-usd-1h",
    asset: "BTC/USD",
    timeframe: "1h",
    currency: "USD",
    data_kind: "historical-generated",
    source: "test",
    generated_at: "2026-08-01T00:00:00Z",
  },
  candles: Array.from({ length: 12 }, (_, index) => {
    const close = index % 2 === 0 ? "90" : "110";
    return {
      timestamp: new Date(Date.UTC(2025, 0, 1, index)).toISOString(),
      open: "100",
      high: "115",
      low: "85",
      close,
      volume: "10",
    };
  }),
};

describe("BacktestLab", () => {
  beforeEach(() => {
    createBacktest.mockReset();
    fetchDataset.mockResolvedValue(dataset);
    getBacktest.mockReset();
    listBacktests.mockResolvedValue([]);
  });

  it("validates configuration, runs, and persists an auditable result", async () => {
    createBacktest.mockImplementation(
      async (candidate) =>
        ({
          ...candidate,
          schemaVersion: 1,
          createdAt: "2026-08-16T00:00:00Z",
        }) satisfies BacktestRecord,
    );
    render(<BacktestLab />);

    const run = await screen.findByRole("button", {
      name: "Run and save backtest",
    });
    fireEvent.change(screen.getByLabelText("Lookback"), {
      target: { value: "1" },
    });
    expect((run as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("alert").textContent).toContain("2 to 100");

    fireEvent.change(screen.getByLabelText("Lookback"), {
      target: { value: "2" },
    });
    fireEvent.click(run);

    await waitFor(() => expect(createBacktest).toHaveBeenCalledTimes(1));
    const saved = createBacktest.mock.calls[0][0];
    expect(saved.result.dataset.fingerprint).toBe(dataset.fingerprint);
    expect(saved.result.tradeCount).toBeGreaterThan(0);
    expect(saved.resultFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(await screen.findByText("Result SHA-256")).toBeTruthy();
    expect(screen.getByText("Trade audit")).toBeTruthy();
  });
});
