import { describe, expect, it } from "vitest";
import { initialSimulationState, simulationReducer } from "./simulation";
import type { Candle } from "./types";

const config = { quantity: "0.5", feeBps: "5", slippageBps: "10" };
const candle: Candle = {
  timestamp: "2025-01-01T00:00:00Z",
  open: "100",
  high: "110",
  low: "90",
  close: "105",
  volume: "10",
};

describe("simulation reducer", () => {
  it("reveals exactly one candle and cannot pass the end", () => {
    let state = initialSimulationState(1);
    state = simulationReducer(state, { type: "NEXT", total: 3 });
    expect(state.cursor).toBe(2);
    state = simulationReducer(state, { type: "NEXT", total: 3 });
    expect(state.cursor).toBe(2);
  });

  it("rejects a second position without mutating the open position", () => {
    const opened = simulationReducer(initialSimulationState(1), {
      type: "OPEN",
      direction: "long",
      candle,
      config,
    });
    const rejected = simulationReducer(opened, {
      type: "OPEN",
      direction: "short",
      candle,
      config,
    });
    expect(rejected.position).toEqual(opened.position);
    expect(rejected.latestError?.code).toBe("POSITION_ALREADY_OPEN");
    expect(rejected.events.at(-1)).toMatchObject({
      type: "action_rejected",
      errorCode: "POSITION_ALREADY_OPEN",
    });
  });

  it("prevents closing without a position", () => {
    const state = simulationReducer(initialSimulationState(1), {
      type: "CLOSE",
      candle,
    });
    expect(state.latestError?.code).toBe("NO_OPEN_POSITION");
    expect(state.trade).toBeNull();
  });

  it("rejects invalid execution configuration safely", () => {
    const state = simulationReducer(initialSimulationState(1), {
      type: "OPEN",
      direction: "long",
      candle,
      config: { ...config, quantity: "0" },
    });
    expect(state.position).toBeNull();
    expect(state.orders).toHaveLength(0);
    expect(state.latestError?.code).toBe("INVALID_QUANTITY");
  });

  it("hold records no trade and reset clears state", () => {
    let state = simulationReducer(initialSimulationState(1), {
      type: "HOLD",
      candle,
    });
    expect(state.position).toBeNull();
    expect(state.trade).toBeNull();
    expect(state.holdCount).toBe(1);
    expect(state.events[0]).toMatchObject({ id: "event-1", type: "hold" });
    state = simulationReducer(state, { type: "RESET", initialCursor: 1 });
    expect(state).toEqual(initialSimulationState(1));
  });

  it("links deterministic orders, fills, and events through completion", () => {
    let state = simulationReducer(initialSimulationState(1), {
      type: "OPEN",
      direction: "long",
      candle,
      config,
    });
    expect(state.position).toMatchObject({
      entryOrderId: "order-1",
      entryFillId: "fill-1",
      quantity: "0.5",
    });
    expect(state.assumptions).toMatchObject(config);

    const exitCandle = {
      ...candle,
      close: "110",
      timestamp: "2025-01-01T01:00:00Z",
    };
    state = simulationReducer(state, { type: "CLOSE", candle: exitCandle });
    expect(state.orders.map((order) => order.id)).toEqual([
      "order-1",
      "order-2",
    ]);
    expect(state.fills.map((fill) => fill.id)).toEqual(["fill-1", "fill-2"]);
    expect(state.events.map((item) => item.type)).toEqual([
      "position_opened",
      "position_closed",
    ]);
    expect(state.trade).toMatchObject({
      entryOrderId: "order-1",
      exitOrderId: "order-2",
      entryFillId: "fill-1",
      exitFillId: "fill-2",
    });
  });

  it("replays identical actions to an identical state", () => {
    function run() {
      let state = simulationReducer(initialSimulationState(1), {
        type: "OPEN",
        direction: "short",
        candle,
        config,
      });
      state = simulationReducer(state, { type: "HOLD", candle });
      return simulationReducer(state, {
        type: "CLOSE",
        candle: { ...candle, close: "100" },
      });
    }
    expect(run()).toEqual(run());
  });

  it("continues deterministic identifiers from a restored checkpoint", () => {
    const restored = simulationReducer(initialSimulationState(1), {
      type: "OPEN",
      direction: "short",
      candle,
      config,
    });
    const serialized = JSON.parse(JSON.stringify(restored)) as typeof restored;
    const completed = simulationReducer(serialized, {
      type: "CLOSE",
      candle: { ...candle, close: "100", timestamp: "2025-01-01T01:00:00Z" },
    });
    expect(completed.orders.at(-1)?.id).toBe("order-2");
    expect(completed.fills.at(-1)?.id).toBe("fill-2");
    expect(completed.events.at(-1)?.id).toBe("event-2");
    expect(completed.trade?.entryPrice).toBe(restored.position?.entryPrice);
  });
});
