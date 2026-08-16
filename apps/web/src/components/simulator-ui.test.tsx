import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Dataset, SimulationSession } from "@/domain/types";
import { initialSimulationState } from "@/domain/simulation";
import { Simulator } from "./simulator";
import { SessionReview } from "./session-review";

const saveCheckpoint = vi.fn();

vi.mock("@/domain/session-api", () => ({
  SessionApiError: class SessionApiError extends Error {},
  saveCheckpoint: (...arguments_: unknown[]) => saveCheckpoint(...arguments_),
  abandonSession: vi.fn(),
}));

vi.mock("./candle-chart", () => ({
  CandleChart: ({
    candles,
    movingAverage,
  }: {
    candles: unknown[];
    movingAverage: unknown[];
  }) => (
    <div data-testid="chart">
      {candles.length} candles Â· {movingAverage.length} SMA points
    </div>
  ),
}));

const dataset: Dataset = {
  fingerprint: "a".repeat(64),
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

function makeSession(): SimulationSession {
  return {
    schemaVersion: 1,
    id: "session-test",
    status: "active",
    dataset: dataset.metadata,
    checkpoint: {
      schemaVersion: 2,
      revision: 0,
      operationId: "create-test",
      executionConfig: { quantity: "1", feeBps: "0", slippageBps: "0" },
      strategyContext: {
        model: "sma_deviation_v1",
        config: { lookback: 10, deviationThresholdPercent: "1" },
      },
      state: initialSimulationState(11),
    },
    createdAt: "2026-08-03T00:00:00Z",
    updatedAt: "2026-08-03T00:00:00Z",
    completedAt: null,
    abandonedAt: null,
  };
}

function renderSimulator() {
  const session = makeSession();
  saveCheckpoint.mockImplementation(
    async ({ state, executionConfig, complete }) => ({
      ...session,
      status: complete ? "completed" : "active",
      checkpoint: {
        ...session.checkpoint,
        revision: 1,
        state,
        executionConfig,
      },
    }),
  );
  render(
    <Simulator
      dataset={dataset}
      session={session}
      onSessionChange={vi.fn()}
      onExit={vi.fn()}
    />,
  );
}

describe("Simulator critical flow", () => {
  beforeEach(() => {
    saveCheckpoint.mockReset();
  });

  it("applies configured quantity and costs to a complete long flow", async () => {
    renderSimulator();
    expect(screen.getByTestId("chart").textContent).toBe(
      "12 candles Â· 3 SMA points",
    );
    expect(
      screen.getByRole("heading", { name: "Above reference" }),
    ).toBeTruthy();
    expect(screen.getByText("+4.186%")).toBeTruthy();

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
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain("Saved locally"),
    );

    fireEvent.click(screen.getByRole("button", { name: "Reveal next candle" }));
    expect(screen.getByTestId("chart").textContent).toBe(
      "13 candles Â· 4 SMA points",
    );
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain("Saved locally"),
    );

    fireEvent.click(screen.getByRole("button", { name: "Close position" }));
    expect(screen.getByRole("heading", { name: "Long result" })).toBeTruthy();
    expect(screen.getByText("$0.33")).toBeTruthy();
    expect(screen.getByText("$0.11")).toBeTruthy();
    expect(screen.getByText(/order-1 → fill-1/)).toBeTruthy();
    await waitFor(() => expect(saveCheckpoint).toHaveBeenCalledTimes(3));
  });

  it("shows invalid settings and prevents order submission", () => {
    renderSimulator();
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

  it("prevents duplicate actions while a checkpoint is saving", () => {
    saveCheckpoint.mockImplementation(() => new Promise(() => undefined));
    const session = makeSession();
    render(
      <Simulator
        dataset={dataset}
        session={session}
        onSessionChange={vi.fn()}
        onExit={vi.fn()}
      />,
    );
    const buy = screen.getByRole("button", { name: "Buy Open long" });
    fireEvent.click(buy);
    fireEvent.click(buy);
    expect(saveCheckpoint).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Buy Open long" })).toBeNull();
    expect(
      (
        screen.getByRole("button", {
          name: "Close position",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(screen.getByRole("status").textContent).toContain("Saving");
  });

  it("keeps local state and retries the same failed save", async () => {
    saveCheckpoint.mockRejectedValueOnce(new Error("disk unavailable"));
    const session = makeSession();
    saveCheckpoint.mockResolvedValueOnce({
      ...session,
      checkpoint: { ...session.checkpoint, revision: 1 },
    });
    render(
      <Simulator
        dataset={dataset}
        session={session}
        onSessionChange={vi.fn()}
        onExit={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Buy Open long" }));
    expect(await screen.findByText("LONG · 1 BTC")).toBeTruthy();
    const retry = await screen.findByRole("button", { name: "Retry save" });
    const firstOperation = saveCheckpoint.mock.calls[0][0].operationId;
    fireEvent.click(retry);
    await waitFor(() => expect(saveCheckpoint).toHaveBeenCalledTimes(2));
    expect(saveCheckpoint.mock.calls[1][0].operationId).toBe(firstOperation);
  });

  it("keeps legacy sessions readable without strategy context", () => {
    const session = makeSession();
    const legacy: SimulationSession = {
      ...session,
      checkpoint: {
        schemaVersion: 1,
        revision: session.checkpoint.revision,
        operationId: session.checkpoint.operationId,
        executionConfig: session.checkpoint.executionConfig,
        state: session.checkpoint.state,
      },
    };
    render(
      <Simulator
        dataset={dataset}
        session={legacy}
        onSessionChange={vi.fn()}
        onExit={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Context not recorded" }),
    ).toBeTruthy();
  });

  it("shows final strategy context in read-only review", () => {
    const session = makeSession();
    render(
      <SessionReview
        dataset={dataset}
        session={{ ...session, status: "abandoned" }}
        onBack={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Above reference" }),
    ).toBeTruthy();
    expect(screen.getByText("SMA (10 closes)")).toBeTruthy();
    expect(screen.getByText(/Mean reversion is a hypothesis/)).toBeTruthy();
  });
});
