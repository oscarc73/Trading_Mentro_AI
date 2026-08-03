import type {
  Candle,
  Direction,
  EngineEvent,
  ExecutionConfig,
  SimulationState,
  TradingError,
  TradingErrorCode,
} from "./types";
import { closePosition, openPosition, TradingDomainError } from "./execution";

export type SimulationAction =
  | { type: "PLAY" }
  | { type: "PAUSE" }
  | { type: "NEXT"; total: number }
  | { type: "RESET"; initialCursor: number }
  | {
      type: "OPEN";
      direction: Direction;
      candle: Candle;
      config: ExecutionConfig;
    }
  | { type: "HOLD"; candle: Candle }
  | { type: "CLOSE"; candle: Candle };

export function initialSimulationState(initialCursor: number): SimulationState {
  return {
    cursor: initialCursor,
    playback: "ready",
    position: null,
    trade: null,
    holdCount: 0,
    assumptions: null,
    orders: [],
    fills: [],
    events: [],
    latestError: null,
  };
}

function event(
  state: SimulationState,
  details: Omit<EngineEvent, "id" | "sequence">,
): EngineEvent {
  const sequence = state.events.length + 1;
  return { id: `event-${sequence}`, sequence, ...details };
}

function reject(
  state: SimulationState,
  code: TradingErrorCode,
  message: string,
  candle: Candle,
): SimulationState {
  const latestError: TradingError = { code, message };
  return {
    ...state,
    latestError,
    events: [
      ...state.events,
      event(state, {
        type: "action_rejected",
        timestamp: candle.timestamp,
        candleIndex: state.cursor,
        message,
        errorCode: code,
      }),
    ],
  };
}

function domainFailure(
  state: SimulationState,
  cause: unknown,
  candle: Candle,
): SimulationState {
  if (cause instanceof TradingDomainError) {
    return reject(state, cause.code, cause.message, candle);
  }
  return reject(
    state,
    "INVALID_PRICE",
    "The trading action could not be completed with the supplied values.",
    candle,
  );
}

export function simulationReducer(
  state: SimulationState,
  action: SimulationAction,
): SimulationState {
  switch (action.type) {
    case "PLAY":
      return state.playback === "completed"
        ? state
        : { ...state, playback: "playing", latestError: null };
    case "PAUSE":
      return state.playback === "playing"
        ? { ...state, playback: "paused", latestError: null }
        : state;
    case "NEXT": {
      if (state.cursor >= action.total - 1)
        return { ...state, playback: "completed" };
      const cursor = state.cursor + 1;
      return {
        ...state,
        cursor,
        playback: cursor >= action.total - 1 ? "completed" : state.playback,
        latestError: null,
      };
    }
    case "RESET":
      return initialSimulationState(action.initialCursor);
    case "OPEN": {
      if (state.trade) {
        return reject(
          state,
          "SESSION_COMPLETE",
          "Reset the completed session before opening another position.",
          action.candle,
        );
      }
      if (state.position) {
        return reject(
          state,
          "POSITION_ALREADY_OPEN",
          "Close the current position before opening another one.",
          action.candle,
        );
      }
      try {
        const opened = openPosition({
          direction: action.direction,
          candle: action.candle,
          candleIndex: state.cursor,
          config: action.config,
          orderSequence: state.orders.length + 1,
          fillSequence: state.fills.length + 1,
        });
        const openedEvent = event(state, {
          type: "position_opened",
          timestamp: opened.fill.timestamp,
          candleIndex: state.cursor,
          message: `${action.direction} position opened by ${opened.order.id}.`,
          orderId: opened.order.id,
          fillId: opened.fill.id,
        });
        return {
          ...state,
          position: opened.position,
          assumptions: opened.assumptions,
          orders: [...state.orders, opened.order],
          fills: [...state.fills, opened.fill],
          events: [...state.events, openedEvent],
          latestError: null,
          playback: state.playback === "playing" ? "playing" : "paused",
        };
      } catch (cause) {
        return domainFailure(state, cause, action.candle);
      }
    }
    case "HOLD": {
      if (state.trade) {
        return reject(
          state,
          "SESSION_COMPLETE",
          "Reset the completed session before recording another action.",
          action.candle,
        );
      }
      const holdEvent = event(state, {
        type: "hold",
        timestamp: action.candle.timestamp,
        candleIndex: state.cursor,
        message: "Hold recorded without creating an order or fill.",
      });
      return {
        ...state,
        holdCount: state.holdCount + 1,
        events: [...state.events, holdEvent],
        latestError: null,
      };
    }
    case "CLOSE": {
      if (!state.position) {
        return reject(
          state,
          "NO_OPEN_POSITION",
          "No open position is available to close.",
          action.candle,
        );
      }
      if (!state.assumptions) {
        return reject(
          state,
          "MISSING_ASSUMPTIONS",
          "The position has no execution assumptions and cannot be closed safely.",
          action.candle,
        );
      }
      try {
        const closed = closePosition({
          position: state.position,
          candle: action.candle,
          candleIndex: state.cursor,
          assumptions: state.assumptions,
          orderSequence: state.orders.length + 1,
          fillSequence: state.fills.length + 1,
        });
        const closedEvent = event(state, {
          type: "position_closed",
          timestamp: closed.fill.timestamp,
          candleIndex: state.cursor,
          message: `Position closed by ${closed.order.id}.`,
          orderId: closed.order.id,
          fillId: closed.fill.id,
          tradeId: "trade-1",
        });
        return {
          ...state,
          trade: closed.trade,
          position: null,
          orders: [...state.orders, closed.order],
          fills: [...state.fills, closed.fill],
          events: [...state.events, closedEvent],
          latestError: null,
          playback: "completed",
        };
      } catch (cause) {
        return domainFailure(state, cause, action.candle);
      }
    }
  }
}
