import type { Candle, Direction, Position, Trade } from "./types";

export const ASSUMPTIONS = {
  quantity: 1 as const,
  fees: 0,
  slippage: 0,
  leverage: false,
  fillPrice: "current candle close",
};

export function calculateGrossPnl(
  direction: Direction,
  entry: number,
  exit: number,
  quantity = 1,
): number {
  if (
    ![entry, exit, quantity].every(Number.isFinite) ||
    entry <= 0 ||
    exit <= 0 ||
    quantity <= 0
  ) {
    throw new Error("Prices and quantity must be positive finite numbers.");
  }
  return direction === "long"
    ? (exit - entry) * quantity
    : (entry - exit) * quantity;
}

export function calculateReturnPercent(
  grossPnl: number,
  entryPrice: number,
  quantity = 1,
): number {
  const entryNotional = Math.abs(entryPrice * quantity);
  if (
    !Number.isFinite(grossPnl) ||
    !Number.isFinite(entryNotional) ||
    entryNotional <= 0
  ) {
    throw new Error("Entry notional must be a positive finite number.");
  }
  return (grossPnl / entryNotional) * 100;
}

export function openPosition(direction: Direction, candle: Candle): Position {
  const entryPrice = Number(candle.close);
  if (!Number.isFinite(entryPrice) || entryPrice <= 0)
    throw new Error("Current candle close is invalid.");
  return {
    direction,
    entryPrice,
    entryTime: candle.timestamp,
    quantity: ASSUMPTIONS.quantity,
  };
}

export function closePosition(position: Position, candle: Candle): Trade {
  const exitPrice = Number(candle.close);
  const grossPnl = calculateGrossPnl(
    position.direction,
    position.entryPrice,
    exitPrice,
    position.quantity,
  );
  return {
    ...position,
    exitPrice,
    exitTime: candle.timestamp,
    grossPnl,
    returnPercent: calculateReturnPercent(
      grossPnl,
      position.entryPrice,
      position.quantity,
    ),
  };
}
