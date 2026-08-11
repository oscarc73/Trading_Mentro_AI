export type Candle = {
  timestamp: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
};

export type Dataset = {
  metadata: {
    id: string;
    asset: string;
    timeframe: string;
    currency: string;
    data_kind: string;
    source: string;
    generated_at: string;
  };
  candles: Candle[];
};

export type Direction = "long" | "short";
export type OrderSide = "buy" | "sell";
export type OrderIntent = "open" | "close";
export type PlaybackState = "ready" | "playing" | "paused" | "completed";

export type ExecutionConfig = {
  quantity: string;
  feeBps: string;
  slippageBps: string;
};

export type ExecutionAssumptions = ExecutionConfig & {
  fillPriceRule: "current candle close";
  spreadBps: "0";
  leverage: false;
};

export type Order = {
  id: string;
  intent: OrderIntent;
  side: OrderSide;
  direction: Direction;
  quantity: string;
  submittedAt: string;
  candleIndex: number;
  status: "filled";
};

export type ExecutionFill = {
  id: string;
  orderId: string;
  side: OrderSide;
  quantity: string;
  referencePrice: string;
  executionPrice: string;
  fee: string;
  slippageCost: string;
  timestamp: string;
  candleIndex: number;
};

export type Position = {
  direction: Direction;
  quantity: string;
  entryOrderId: string;
  entryFillId: string;
  entryReferencePrice: string;
  entryPrice: string;
  entryFee: string;
  entrySlippageCost: string;
  entryTime: string;
};

export type Trade = {
  direction: Direction;
  quantity: string;
  entryOrderId: string;
  entryFillId: string;
  entryReferencePrice: string;
  entryPrice: string;
  entryTime: string;
  exitOrderId: string;
  exitFillId: string;
  exitReferencePrice: string;
  exitPrice: string;
  exitTime: string;
  grossPnl: string;
  totalFees: string;
  slippageCost: string;
  netPnl: string;
  netReturnPercent: string;
};

export type TradingErrorCode =
  | "INVALID_QUANTITY"
  | "INVALID_FEE_RATE"
  | "INVALID_SLIPPAGE_RATE"
  | "INVALID_PRICE"
  | "POSITION_ALREADY_OPEN"
  | "NO_OPEN_POSITION"
  | "SESSION_COMPLETE"
  | "MISSING_ASSUMPTIONS";

export type TradingError = {
  code: TradingErrorCode;
  message: string;
};

export type EngineEvent = {
  id: string;
  sequence: number;
  type: "position_opened" | "position_closed" | "hold" | "action_rejected";
  timestamp: string;
  candleIndex: number;
  message: string;
  orderId?: string;
  fillId?: string;
  tradeId?: string;
  errorCode?: TradingErrorCode;
};

export type SimulationState = {
  cursor: number;
  playback: PlaybackState;
  position: Position | null;
  trade: Trade | null;
  holdCount: number;
  assumptions: ExecutionAssumptions | null;
  orders: Order[];
  fills: ExecutionFill[];
  events: EngineEvent[];
  latestError: TradingError | null;
};

export type SessionStatus = "active" | "completed" | "abandoned";

export type MeanReversionConfig = {
  lookback: number;
  deviationThresholdPercent: string;
};

export type MeanReversionState =
  | "insufficient_data"
  | "below_reference"
  | "near_reference"
  | "above_reference";

export type MeanReversionPoint = {
  candleIndex: number;
  timestamp: string;
  close: string;
  movingAverage: string;
  deviationPrice: string;
  deviationPercent: string;
  state: Exclude<MeanReversionState, "insufficient_data">;
};

export type MeanReversionAnalysis = {
  model: "sma_deviation_v1";
  config: MeanReversionConfig;
  state: MeanReversionState;
  current: MeanReversionPoint | null;
  series: MeanReversionPoint[];
  candlesRequired: number;
  explanation: string;
};

export type StrategyContext = {
  model: "sma_deviation_v1";
  config: MeanReversionConfig;
};

export type LegacySessionCheckpoint = {
  schemaVersion: 1;
  revision: number;
  operationId: string;
  executionConfig: ExecutionConfig;
  state: SimulationState;
};

export type StrategySessionCheckpoint = {
  schemaVersion: 2;
  revision: number;
  operationId: string;
  executionConfig: ExecutionConfig;
  strategyContext: StrategyContext;
  state: SimulationState;
};

export type SessionCheckpoint =
  LegacySessionCheckpoint | StrategySessionCheckpoint;

export type SimulationSession = {
  schemaVersion: 1;
  id: string;
  status: SessionStatus;
  dataset: Dataset["metadata"];
  checkpoint: SessionCheckpoint;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  abandonedAt: string | null;
};

export type SessionSummary = {
  schemaVersion: 1;
  id: string;
  status: SessionStatus;
  datasetId: string;
  asset: string;
  timeframe: string;
  cursor: number;
  candleCount: number;
  direction: Direction | null;
  netPnl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PersistenceState =
  "loading" | "saving" | "saved" | "failed" | "offline";
