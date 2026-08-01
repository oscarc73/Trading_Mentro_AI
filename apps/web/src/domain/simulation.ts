import type { Candle, Direction, SimulationState } from "./types";
import { closePosition, openPosition } from "./trading";

export type SimulationAction =
  | { type: "PLAY" }
  | { type: "PAUSE" }
  | { type: "NEXT"; total: number }
  | { type: "RESET"; initialCursor: number }
  | { type: "OPEN"; direction: Direction; candle: Candle }
  | { type: "HOLD" }
  | { type: "CLOSE"; candle: Candle };

export function initialSimulationState(initialCursor: number): SimulationState {
  return {
    cursor: initialCursor,
    playback: "ready",
    position: null,
    trade: null,
    holdCount: 0,
  };
}

export function simulationReducer(
  state: SimulationState,
  action: SimulationAction,
): SimulationState {
  switch (action.type) {
    case "PLAY":
      return state.playback === "completed"
        ? state
        : { ...state, playback: "playing" };
    case "PAUSE":
      return state.playback === "playing"
        ? { ...state, playback: "paused" }
        : state;
    case "NEXT": {
      if (state.cursor >= action.total - 1)
        return { ...state, playback: "completed" };
      const cursor = state.cursor + 1;
      return {
        ...state,
        cursor,
        playback: cursor >= action.total - 1 ? "completed" : state.playback,
      };
    }
    case "RESET":
      return initialSimulationState(action.initialCursor);
    case "OPEN":
      if (state.position || state.trade)
        throw new Error("A position is already open or the trade is complete.");
      return {
        ...state,
        position: openPosition(action.direction, action.candle),
        playback: state.playback === "playing" ? "playing" : "paused",
      };
    case "HOLD":
      return { ...state, holdCount: state.holdCount + 1 };
    case "CLOSE":
      if (!state.position) throw new Error("No open position to close.");
      return {
        ...state,
        trade: closePosition(state.position, action.candle),
        position: null,
        playback: "completed",
      };
  }
}
