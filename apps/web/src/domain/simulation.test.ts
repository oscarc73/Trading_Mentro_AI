import { describe, expect, it } from "vitest";
import { initialSimulationState, simulationReducer } from "./simulation";
import type { Candle } from "./types";

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
  it("prevents a second position", () => {
    const state = simulationReducer(initialSimulationState(1), {
      type: "OPEN",
      direction: "long",
      candle,
    });
    expect(() =>
      simulationReducer(state, { type: "OPEN", direction: "short", candle }),
    ).toThrow();
  });
  it("prevents closing without a position", () => {
    expect(() =>
      simulationReducer(initialSimulationState(1), { type: "CLOSE", candle }),
    ).toThrow();
  });
  it("hold records no trade and reset clears state", () => {
    let state = simulationReducer(initialSimulationState(1), { type: "HOLD" });
    expect(state.position).toBeNull();
    expect(state.trade).toBeNull();
    expect(state.holdCount).toBe(1);
    state = simulationReducer(state, { type: "RESET", initialCursor: 1 });
    expect(state).toEqual(initialSimulationState(1));
  });
});
