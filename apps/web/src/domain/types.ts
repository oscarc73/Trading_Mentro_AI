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
export type PlaybackState = "ready" | "playing" | "paused" | "completed";

export type Position = {
  direction: Direction;
  entryPrice: number;
  entryTime: string;
  quantity: 1;
};

export type Trade = Position & {
  exitPrice: number;
  exitTime: string;
  grossPnl: number;
  returnPercent: number;
};

export type SimulationState = {
  cursor: number;
  playback: PlaybackState;
  position: Position | null;
  trade: Trade | null;
  holdCount: number;
};
