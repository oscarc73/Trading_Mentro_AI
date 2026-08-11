import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Dataset, SimulationSession } from "@/domain/types";
import { initialSimulationState } from "@/domain/simulation";
import { SimulatorLoader } from "./simulator-loader";

const createSession = vi.fn();
const fetchDataset = vi.fn();
const listSessions = vi.fn();

vi.mock("@/domain/session-api", () => ({
  createSession: (...arguments_: unknown[]) => createSession(...arguments_),
  fetchDataset: (...arguments_: unknown[]) => fetchDataset(...arguments_),
  listSessions: (...arguments_: unknown[]) => listSessions(...arguments_),
  getSession: vi.fn(),
}));

vi.mock("./simulator", () => ({
  Simulator: () => <div>Active simulator</div>,
}));

const dataset: Dataset = {
  metadata: {
    id: "btc-usd-1h",
    asset: "BTC/USD",
    timeframe: "1h",
    currency: "USD",
    data_kind: "historical-generated",
    source: "test",
    generated_at: "2026-08-01T00:00:00Z",
  },
  candles: Array.from({ length: 12 }, (_, index) => ({
    timestamp: new Date(Date.UTC(2025, 0, 1, index)).toISOString(),
    open: "100",
    high: "101",
    low: "99",
    close: "100",
    volume: "10",
  })),
};

describe("new-session strategy configuration", () => {
  beforeEach(() => {
    createSession.mockReset();
    fetchDataset.mockResolvedValue(dataset);
    listSessions.mockResolvedValue([]);
  });

  it("blocks invalid values and starts with normalized locked context", async () => {
    const session: SimulationSession = {
      schemaVersion: 1,
      id: "new",
      status: "active",
      dataset: dataset.metadata,
      checkpoint: {
        schemaVersion: 2,
        revision: 0,
        operationId: "create",
        executionConfig: { quantity: "1", feeBps: "0", slippageBps: "0" },
        strategyContext: {
          model: "sma_deviation_v1",
          config: { lookback: 10, deviationThresholdPercent: "1" },
        },
        state: initialSimulationState(11),
      },
      createdAt: "2026-08-10T00:00:00Z",
      updatedAt: "2026-08-10T00:00:00Z",
      completedAt: null,
      abandonedAt: null,
    };
    createSession.mockResolvedValue(session);
    render(<SimulatorLoader />);

    const start = await screen.findByRole("button", {
      name: "Start new session",
    });
    fireEvent.change(screen.getByLabelText("Lookback (candles)"), {
      target: { value: "1" },
    });
    expect((start as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("alert").textContent).toContain("2 to 100");

    fireEvent.change(screen.getByLabelText("Lookback (candles)"), {
      target: { value: "10" },
    });
    fireEvent.change(screen.getByLabelText("Deviation threshold (%)"), {
      target: { value: "1.00" },
    });
    fireEvent.click(start);
    await waitFor(() => expect(createSession).toHaveBeenCalledTimes(1));
    expect(createSession.mock.calls[0][0].strategyContext).toEqual({
      model: "sma_deviation_v1",
      config: { lookback: 10, deviationThresholdPercent: "1" },
    });
    expect(await screen.findByText("Active simulator")).toBeTruthy();
  });
});
