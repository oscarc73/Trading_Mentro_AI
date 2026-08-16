import Decimal from "decimal.js";
import type {
  Candle,
  Direction,
  ExecutionAssumptions,
  ExecutionConfig,
  ExecutionFill,
  Order,
  OrderIntent,
  OrderSide,
  Position,
  Trade,
  TradingErrorCode,
} from "./types";

const BPS_DIVISOR = new Decimal(10_000);

export const DEFAULT_EXECUTION_CONFIG: ExecutionConfig = {
  quantity: "1",
  feeBps: "0",
  slippageBps: "0",
};

export class TradingDomainError extends Error {
  constructor(
    readonly code: TradingErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "TradingDomainError";
  }
}

function parseDecimal(
  value: string,
  code: TradingErrorCode,
  message: string,
): Decimal {
  try {
    const parsed = new Decimal(value);
    if (!parsed.isFinite()) throw new Error("not finite");
    return parsed;
  } catch {
    throw new TradingDomainError(code, message);
  }
}

function positiveDecimal(
  value: string,
  code: TradingErrorCode,
  message: string,
): Decimal {
  const parsed = parseDecimal(value, code, message);
  if (!parsed.greaterThan(0)) throw new TradingDomainError(code, message);
  return parsed;
}

function nonNegativeRate(
  value: string,
  code: TradingErrorCode,
  label: string,
): Decimal {
  const message = `${label} must be a finite value from 0 to 10,000 basis points.`;
  const parsed = parseDecimal(value, code, message);
  if (parsed.isNegative() || parsed.greaterThan(10_000)) {
    throw new TradingDomainError(code, message);
  }
  return parsed;
}

export function normalizeExecutionConfig(
  config: ExecutionConfig,
  fillPriceRule: ExecutionAssumptions["fillPriceRule"] = "current candle close",
): ExecutionAssumptions {
  const quantity = positiveDecimal(
    config.quantity,
    "INVALID_QUANTITY",
    "Quantity must be a positive finite decimal value.",
  );
  const feeBps = nonNegativeRate(config.feeBps, "INVALID_FEE_RATE", "Fee rate");
  const slippageBps = nonNegativeRate(
    config.slippageBps,
    "INVALID_SLIPPAGE_RATE",
    "Slippage rate",
  );
  if (slippageBps.greaterThanOrEqualTo(10_000)) {
    throw new TradingDomainError(
      "INVALID_SLIPPAGE_RATE",
      "Slippage must be below 10,000 basis points so sell fills remain positive.",
    );
  }
  return {
    quantity: quantity.toString(),
    feeBps: feeBps.toString(),
    slippageBps: slippageBps.toString(),
    fillPriceRule,
    spreadBps: "0",
    leverage: false,
  };
}

function candlePrice(candle: Candle, field: "open" | "close"): Decimal {
  return positiveDecimal(
    candle[field],
    "INVALID_PRICE",
    `Candle ${field} must be a positive finite decimal value.`,
  );
}

function orderSide(direction: Direction, intent: OrderIntent): OrderSide {
  if (intent === "open") return direction === "long" ? "buy" : "sell";
  return direction === "long" ? "sell" : "buy";
}

function executionPrice(
  side: OrderSide,
  referencePrice: Decimal,
  slippageBps: Decimal,
): Decimal {
  const rate = slippageBps.dividedBy(BPS_DIVISOR);
  return side === "buy"
    ? referencePrice.times(new Decimal(1).plus(rate))
    : referencePrice.times(new Decimal(1).minus(rate));
}

function createMarketExecution({
  direction,
  intent,
  candle,
  candleIndex,
  assumptions,
  orderSequence,
  fillSequence,
  referencePriceField = "close",
}: {
  direction: Direction;
  intent: OrderIntent;
  candle: Candle;
  candleIndex: number;
  assumptions: ExecutionAssumptions;
  orderSequence: number;
  fillSequence: number;
  referencePriceField?: "open" | "close";
}): { order: Order; fill: ExecutionFill } {
  const side = orderSide(direction, intent);
  const referencePrice = candlePrice(candle, referencePriceField);
  const quantity = positiveDecimal(
    assumptions.quantity,
    "INVALID_QUANTITY",
    "Quantity must be a positive finite decimal value.",
  );
  const feeBps = nonNegativeRate(
    assumptions.feeBps,
    "INVALID_FEE_RATE",
    "Fee rate",
  );
  const slippageBps = nonNegativeRate(
    assumptions.slippageBps,
    "INVALID_SLIPPAGE_RATE",
    "Slippage rate",
  );
  const fillPrice = executionPrice(side, referencePrice, slippageBps);
  if (!fillPrice.greaterThan(0)) {
    throw new TradingDomainError(
      "INVALID_PRICE",
      "Execution assumptions produced a non-positive fill price.",
    );
  }
  const orderId = `order-${orderSequence}`;
  const fillId = `fill-${fillSequence}`;
  const order: Order = {
    id: orderId,
    intent,
    side,
    direction,
    quantity: quantity.toString(),
    submittedAt: candle.timestamp,
    candleIndex,
    status: "filled",
  };
  const fill: ExecutionFill = {
    id: fillId,
    orderId,
    side,
    quantity: quantity.toString(),
    referencePrice: referencePrice.toString(),
    executionPrice: fillPrice.toString(),
    fee: fillPrice
      .times(quantity)
      .abs()
      .times(feeBps)
      .dividedBy(BPS_DIVISOR)
      .toString(),
    slippageCost: fillPrice
      .minus(referencePrice)
      .abs()
      .times(quantity)
      .toString(),
    timestamp: candle.timestamp,
    candleIndex,
  };
  return { order, fill };
}

export function calculateGrossPnl(
  direction: Direction,
  entryPrice: string,
  exitPrice: string,
  quantity: string,
): string {
  const entry = positiveDecimal(
    entryPrice,
    "INVALID_PRICE",
    "Entry price must be a positive finite decimal value.",
  );
  const exit = positiveDecimal(
    exitPrice,
    "INVALID_PRICE",
    "Exit price must be a positive finite decimal value.",
  );
  const size = positiveDecimal(
    quantity,
    "INVALID_QUANTITY",
    "Quantity must be a positive finite decimal value.",
  );
  return (direction === "long" ? exit.minus(entry) : entry.minus(exit))
    .times(size)
    .toString();
}

export function calculateReturnPercent(
  netPnl: string,
  entryPrice: string,
  quantity: string,
): string {
  const pnl = parseDecimal(
    netPnl,
    "INVALID_PRICE",
    "Net P&L must be a finite decimal value.",
  );
  const entryNotional = positiveDecimal(
    entryPrice,
    "INVALID_PRICE",
    "Entry price must be a positive finite decimal value.",
  )
    .times(
      positiveDecimal(
        quantity,
        "INVALID_QUANTITY",
        "Quantity must be a positive finite decimal value.",
      ),
    )
    .abs();
  return pnl.dividedBy(entryNotional).times(100).toString();
}

export function openPosition({
  direction,
  candle,
  candleIndex,
  config,
  orderSequence,
  fillSequence,
  referencePriceField = "close",
  fillPriceRule = "current candle close",
}: {
  direction: Direction;
  candle: Candle;
  candleIndex: number;
  config: ExecutionConfig;
  orderSequence: number;
  fillSequence: number;
  referencePriceField?: "open" | "close";
  fillPriceRule?: ExecutionAssumptions["fillPriceRule"];
}) {
  const assumptions = normalizeExecutionConfig(config, fillPriceRule);
  const { order, fill } = createMarketExecution({
    direction,
    intent: "open",
    candle,
    candleIndex,
    assumptions,
    orderSequence,
    fillSequence,
    referencePriceField,
  });
  const position: Position = {
    direction,
    quantity: assumptions.quantity,
    entryOrderId: order.id,
    entryFillId: fill.id,
    entryReferencePrice: fill.referencePrice,
    entryPrice: fill.executionPrice,
    entryFee: fill.fee,
    entrySlippageCost: fill.slippageCost,
    entryTime: fill.timestamp,
  };
  return { assumptions, order, fill, position };
}

export function closePosition({
  position,
  candle,
  candleIndex,
  assumptions,
  orderSequence,
  fillSequence,
  referencePriceField = "close",
}: {
  position: Position;
  candle: Candle;
  candleIndex: number;
  assumptions: ExecutionAssumptions;
  orderSequence: number;
  fillSequence: number;
  referencePriceField?: "open" | "close";
}): { order: Order; fill: ExecutionFill; trade: Trade } {
  const { order, fill } = createMarketExecution({
    direction: position.direction,
    intent: "close",
    candle,
    candleIndex,
    assumptions,
    orderSequence,
    fillSequence,
    referencePriceField,
  });
  const grossPnl = calculateGrossPnl(
    position.direction,
    position.entryPrice,
    fill.executionPrice,
    position.quantity,
  );
  const totalFees = new Decimal(position.entryFee).plus(fill.fee);
  const slippageCost = new Decimal(position.entrySlippageCost).plus(
    fill.slippageCost,
  );
  const netPnl = new Decimal(grossPnl).minus(totalFees);
  const trade: Trade = {
    direction: position.direction,
    quantity: position.quantity,
    entryOrderId: position.entryOrderId,
    entryFillId: position.entryFillId,
    entryReferencePrice: position.entryReferencePrice,
    entryPrice: position.entryPrice,
    entryTime: position.entryTime,
    exitOrderId: order.id,
    exitFillId: fill.id,
    exitReferencePrice: fill.referencePrice,
    exitPrice: fill.executionPrice,
    exitTime: fill.timestamp,
    grossPnl,
    totalFees: totalFees.toString(),
    slippageCost: slippageCost.toString(),
    netPnl: netPnl.toString(),
    netReturnPercent: calculateReturnPercent(
      netPnl.toString(),
      position.entryPrice,
      position.quantity,
    ),
  };
  return { order, fill, trade };
}

export function previewPosition(
  position: Position,
  candle: Candle,
  assumptions: ExecutionAssumptions,
): { grossPnl: string; estimatedNetPnl: string; estimatedExitPrice: string } {
  const exitSide = orderSide(position.direction, "close");
  const referencePrice = candlePrice(candle, "close");
  const exitPrice = executionPrice(
    exitSide,
    referencePrice,
    new Decimal(assumptions.slippageBps),
  );
  const grossPnl = calculateGrossPnl(
    position.direction,
    position.entryPrice,
    exitPrice.toString(),
    position.quantity,
  );
  const estimatedExitFee = exitPrice
    .times(position.quantity)
    .abs()
    .times(assumptions.feeBps)
    .dividedBy(BPS_DIVISOR);
  return {
    grossPnl,
    estimatedNetPnl: new Decimal(grossPnl)
      .minus(position.entryFee)
      .minus(estimatedExitFee)
      .toString(),
    estimatedExitPrice: exitPrice.toString(),
  };
}
