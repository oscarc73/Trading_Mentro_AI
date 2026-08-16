from collections.abc import Sequence
from datetime import datetime, timedelta
from decimal import Decimal
from enum import StrEnum
from itertools import pairwise
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, model_validator


class Candle(BaseModel):
    timestamp: datetime
    open: Decimal = Field(gt=0)
    high: Decimal = Field(gt=0)
    low: Decimal = Field(gt=0)
    close: Decimal = Field(gt=0)
    volume: Decimal = Field(ge=0)

    @model_validator(mode="after")
    def validate_range(self) -> "Candle":
        if self.high < max(self.open, self.close, self.low):
            raise ValueError(
                "high must be greater than or equal to open, close, and low"
            )
        if self.low > min(self.open, self.close, self.high):
            raise ValueError("low must be less than or equal to open, close, and high")
        return self


class DatasetMetadata(BaseModel):
    id: str
    asset: str
    timeframe: str
    currency: str
    data_kind: str
    source: str
    generated_at: datetime


class Dataset(BaseModel):
    fingerprint: str = Field(pattern=r"^[a-f0-9]{64}$")
    metadata: DatasetMetadata
    candles: list[Candle]

    @model_validator(mode="after")
    def validate_sequence(self) -> "Dataset":
        if not self.candles:
            raise ValueError("dataset must contain at least one candle")
        timestamps = [candle.timestamp for candle in self.candles]
        if len(timestamps) != len(set(timestamps)):
            raise ValueError("dataset contains duplicate timestamps")
        if any(timestamp.utcoffset() != timedelta(0) for timestamp in timestamps):
            raise ValueError("all candle timestamps must include the UTC timezone")
        if timestamps != sorted(timestamps):
            raise ValueError("candles must be ordered by ascending timestamp")
        intervals = {"1h": timedelta(hours=1)}
        expected_interval = intervals.get(self.metadata.timeframe)
        if expected_interval is None:
            raise ValueError(f"unsupported timeframe: {self.metadata.timeframe}")
        if any(
            current - previous != expected_interval
            for previous, current in pairwise(timestamps)
        ):
            raise ValueError(
                f"dataset contains a gap or irregular {self.metadata.timeframe} interval"
            )
        return self


class ApiModel(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True, serialize_by_alias=True, extra="forbid"
    )


def validate_decimal_string(value: str) -> str:
    if not isinstance(value, str):
        raise TypeError("financial values must be decimal strings")
    try:
        decimal = Decimal(value)
    except Exception as error:
        raise ValueError("financial values must be valid decimal strings") from error
    if not decimal.is_finite():
        raise ValueError("financial values must be finite decimal strings")
    return value


DecimalString = Annotated[str, AfterValidator(validate_decimal_string)]


class SessionStatus(StrEnum):
    ACTIVE = "active"
    COMPLETED = "completed"
    ABANDONED = "abandoned"


class ExecutionConfig(ApiModel):
    quantity: DecimalString
    fee_bps: DecimalString = Field(alias="feeBps")
    slippage_bps: DecimalString = Field(alias="slippageBps")


class ExecutionAssumptions(ExecutionConfig):
    fill_price_rule: Literal["current candle close"] = Field(alias="fillPriceRule")
    spread_bps: Literal["0"] = Field(alias="spreadBps")
    leverage: Literal[False]


class MeanReversionConfig(ApiModel):
    lookback: int = Field(ge=2, le=100)
    deviation_threshold_percent: DecimalString = Field(
        alias="deviationThresholdPercent"
    )

    @model_validator(mode="after")
    def validate_threshold(self) -> "MeanReversionConfig":
        threshold = Decimal(self.deviation_threshold_percent)
        if threshold <= 0:
            raise ValueError("deviation threshold must be positive")
        self.deviation_threshold_percent = format(threshold.normalize(), "f")
        return self


class StrategyContext(ApiModel):
    model: Literal["sma_deviation_v1"]
    config: MeanReversionConfig


class Order(ApiModel):
    id: str
    intent: Literal["open", "close"]
    side: Literal["buy", "sell"]
    direction: Literal["long", "short"]
    quantity: DecimalString
    submitted_at: datetime = Field(alias="submittedAt")
    candle_index: int = Field(alias="candleIndex", ge=0)
    status: Literal["filled"]


class ExecutionFill(ApiModel):
    id: str
    order_id: str = Field(alias="orderId")
    side: Literal["buy", "sell"]
    quantity: DecimalString
    reference_price: DecimalString = Field(alias="referencePrice")
    execution_price: DecimalString = Field(alias="executionPrice")
    fee: DecimalString
    slippage_cost: DecimalString = Field(alias="slippageCost")
    timestamp: datetime
    candle_index: int = Field(alias="candleIndex", ge=0)


class Position(ApiModel):
    direction: Literal["long", "short"]
    quantity: DecimalString
    entry_order_id: str = Field(alias="entryOrderId")
    entry_fill_id: str = Field(alias="entryFillId")
    entry_reference_price: DecimalString = Field(alias="entryReferencePrice")
    entry_price: DecimalString = Field(alias="entryPrice")
    entry_fee: DecimalString = Field(alias="entryFee")
    entry_slippage_cost: DecimalString = Field(alias="entrySlippageCost")
    entry_time: datetime = Field(alias="entryTime")


class Trade(ApiModel):
    direction: Literal["long", "short"]
    quantity: DecimalString
    entry_order_id: str = Field(alias="entryOrderId")
    entry_fill_id: str = Field(alias="entryFillId")
    entry_reference_price: DecimalString = Field(alias="entryReferencePrice")
    entry_price: DecimalString = Field(alias="entryPrice")
    entry_time: datetime = Field(alias="entryTime")
    exit_order_id: str = Field(alias="exitOrderId")
    exit_fill_id: str = Field(alias="exitFillId")
    exit_reference_price: DecimalString = Field(alias="exitReferencePrice")
    exit_price: DecimalString = Field(alias="exitPrice")
    exit_time: datetime = Field(alias="exitTime")
    gross_pnl: DecimalString = Field(alias="grossPnl")
    total_fees: DecimalString = Field(alias="totalFees")
    slippage_cost: DecimalString = Field(alias="slippageCost")
    net_pnl: DecimalString = Field(alias="netPnl")
    net_return_percent: DecimalString = Field(alias="netReturnPercent")


class TradingError(ApiModel):
    code: str
    message: str


class EngineEvent(ApiModel):
    id: str
    sequence: int = Field(ge=1)
    type: Literal["position_opened", "position_closed", "hold", "action_rejected"]
    timestamp: datetime
    candle_index: int = Field(alias="candleIndex", ge=0)
    message: str
    order_id: str | None = Field(default=None, alias="orderId")
    fill_id: str | None = Field(default=None, alias="fillId")
    trade_id: str | None = Field(default=None, alias="tradeId")
    error_code: str | None = Field(default=None, alias="errorCode")


class SimulationState(ApiModel):
    cursor: int = Field(ge=0)
    playback: Literal["ready", "playing", "paused", "completed"]
    position: Position | None
    trade: Trade | None
    hold_count: int = Field(alias="holdCount", ge=0)
    assumptions: ExecutionAssumptions | None
    orders: list[Order]
    fills: list[ExecutionFill]
    events: list[EngineEvent]
    latest_error: TradingError | None = Field(alias="latestError")

    @model_validator(mode="after")
    def validate_links(self) -> "SimulationState":
        expected_orders = [f"order-{index}" for index in range(1, len(self.orders) + 1)]
        expected_fills = [f"fill-{index}" for index in range(1, len(self.fills) + 1)]
        expected_events = [f"event-{index}" for index in range(1, len(self.events) + 1)]
        if [item.id for item in self.orders] != expected_orders:
            raise ValueError("order identifiers are not deterministic")
        if [item.id for item in self.fills] != expected_fills:
            raise ValueError("fill identifiers are not deterministic")
        if [item.id for item in self.events] != expected_events:
            raise ValueError("event identifiers are not deterministic")
        if [item.sequence for item in self.events] != list(
            range(1, len(self.events) + 1)
        ):
            raise ValueError("event sequence is invalid")
        order_ids = {item.id for item in self.orders}
        if any(fill.order_id not in order_ids for fill in self.fills):
            raise ValueError("a fill references an unknown order")
        if self.position and self.trade:
            raise ValueError(
                "a session cannot have an open position and completed trade"
            )
        if self.position and self.assumptions is None:
            raise ValueError("an open position requires execution assumptions")
        if self.trade and (len(self.orders) != 2 or len(self.fills) != 2):
            raise ValueError("a completed trade requires exactly two orders and fills")
        return self


class SessionCheckpoint(ApiModel):
    schema_version: Literal[1, 2] = Field(alias="schemaVersion")
    revision: int = Field(ge=0)
    operation_id: str = Field(alias="operationId", min_length=1, max_length=100)
    execution_config: ExecutionConfig = Field(alias="executionConfig")
    strategy_context: StrategyContext | None = Field(
        default=None, alias="strategyContext"
    )
    state: SimulationState

    @model_validator(mode="after")
    def validate_schema_context(self) -> "SessionCheckpoint":
        _validate_strategy_schema(self.schema_version, self.strategy_context)
        return self


class CheckpointWrite(ApiModel):
    schema_version: Literal[1, 2] = Field(alias="schemaVersion")
    expected_revision: int = Field(alias="expectedRevision", ge=0)
    operation_id: str = Field(alias="operationId", min_length=1, max_length=100)
    execution_config: ExecutionConfig = Field(alias="executionConfig")
    strategy_context: StrategyContext | None = Field(
        default=None, alias="strategyContext"
    )
    state: SimulationState

    @model_validator(mode="after")
    def validate_schema_context(self) -> "CheckpointWrite":
        _validate_strategy_schema(self.schema_version, self.strategy_context)
        return self


class SessionCreate(ApiModel):
    schema_version: Literal[1, 2] = Field(alias="schemaVersion")
    session_id: str = Field(alias="sessionId", min_length=1, max_length=100)
    dataset_id: str = Field(alias="datasetId")
    operation_id: str = Field(alias="operationId", min_length=1, max_length=100)
    execution_config: ExecutionConfig = Field(alias="executionConfig")
    strategy_context: StrategyContext | None = Field(
        default=None, alias="strategyContext"
    )
    state: SimulationState

    @model_validator(mode="after")
    def validate_schema_context(self) -> "SessionCreate":
        _validate_strategy_schema(self.schema_version, self.strategy_context)
        return self


def _validate_strategy_schema(
    schema_version: int, strategy_context: StrategyContext | None
) -> None:
    if schema_version == 2 and strategy_context is None:
        raise ValueError("schema version 2 requires strategy context")
    if schema_version == 1 and strategy_context is not None:
        raise ValueError("schema version 1 cannot include strategy context")


class SessionTransition(ApiModel):
    expected_revision: int = Field(alias="expectedRevision", ge=0)
    operation_id: str = Field(alias="operationId", min_length=1, max_length=100)


class SimulationSession(ApiModel):
    schema_version: Literal[1] = Field(alias="schemaVersion")
    id: str
    status: SessionStatus
    dataset: DatasetMetadata
    checkpoint: SessionCheckpoint
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")
    completed_at: datetime | None = Field(default=None, alias="completedAt")
    abandoned_at: datetime | None = Field(default=None, alias="abandonedAt")


class SessionSummary(ApiModel):
    schema_version: Literal[1] = Field(alias="schemaVersion")
    id: str
    status: SessionStatus
    dataset_id: str = Field(alias="datasetId")
    asset: str
    timeframe: str
    cursor: int
    candle_count: int = Field(alias="candleCount")
    direction: Literal["long", "short"] | None
    net_pnl: str | None = Field(alias="netPnl")
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")


class MeanReversionRuleConfig(ApiModel):
    model: Literal["mean_reversion_threshold_v1"]
    entry_signal_timing: Literal["candle_close"] = Field(alias="entrySignalTiming")
    signal_fill_timing: Literal["next_candle_open"] = Field(alias="signalFillTiming")
    final_position_policy: Literal["close_at_final_candle_close"] = Field(
        alias="finalPositionPolicy"
    )


class BacktestConfig(ApiModel):
    strategy_context: StrategyContext = Field(alias="strategyContext")
    rules: MeanReversionRuleConfig
    execution_config: ExecutionConfig = Field(alias="executionConfig")


class BacktestDatasetReference(ApiModel):
    id: str
    generated_at: datetime = Field(alias="generatedAt")
    candle_count: int = Field(alias="candleCount", ge=1)
    fingerprint: str = Field(pattern=r"^[a-f0-9]{64}$")


class BacktestSignal(ApiModel):
    id: str
    candle_index: int = Field(alias="candleIndex", ge=0)
    timestamp: datetime
    state: Literal["below_reference", "near_reference", "above_reference"]
    action: Literal["open_long", "open_short", "close_long", "close_short"]
    execution_candle_index: int | None = Field(
        default=None, alias="executionCandleIndex", ge=0
    )
    status: Literal["executed", "ignored_end_of_data"]

    @model_validator(mode="after")
    def validate_execution_timing(self) -> "BacktestSignal":
        if (
            self.status == "executed"
            and self.execution_candle_index != self.candle_index + 1
        ):
            raise ValueError("executed signals must fill at the next candle")
        if (
            self.status == "ignored_end_of_data"
            and self.execution_candle_index is not None
        ):
            raise ValueError("ignored final signals cannot have an execution candle")
        return self


class BacktestTrade(Trade):
    id: str
    entry_signal_id: str = Field(alias="entrySignalId")
    exit_signal_id: str | None = Field(default=None, alias="exitSignalId")
    exit_reason: Literal["strategy", "end_of_data"] = Field(alias="exitReason")


class BacktestEvent(ApiModel):
    id: str
    sequence: int = Field(ge=1)
    type: Literal[
        "signal_created", "position_opened", "position_closed", "end_of_data_close"
    ]
    candle_index: int = Field(alias="candleIndex", ge=0)
    timestamp: datetime
    message: str
    signal_id: str | None = Field(default=None, alias="signalId")
    order_id: str | None = Field(default=None, alias="orderId")
    fill_id: str | None = Field(default=None, alias="fillId")
    trade_id: str | None = Field(default=None, alias="tradeId")


class BacktestResult(ApiModel):
    schema_version: Literal[1] = Field(alias="schemaVersion")
    engine_version: Literal["mean_reversion_backtest_v1"] = Field(alias="engineVersion")
    dataset: BacktestDatasetReference
    config: BacktestConfig
    signals: list[BacktestSignal]
    orders: list[Order]
    fills: list[ExecutionFill]
    trades: list[BacktestTrade]
    events: list[BacktestEvent]
    candle_count: int = Field(alias="candleCount", ge=1)
    trade_count: int = Field(alias="tradeCount", ge=0)
    forced_exit_count: int = Field(alias="forcedExitCount", ge=0)
    total_gross_pnl: DecimalString = Field(alias="totalGrossPnl")
    total_fees: DecimalString = Field(alias="totalFees")
    total_slippage_cost: DecimalString = Field(alias="totalSlippageCost")
    total_net_pnl: DecimalString = Field(alias="totalNetPnl")

    @model_validator(mode="after")
    def validate_result_integrity(self) -> "BacktestResult":
        if self.candle_count != self.dataset.candle_count:
            raise ValueError("backtest candle counts do not match")
        if self.trade_count != len(self.trades):
            raise ValueError("backtest trade count does not match")
        if self.forced_exit_count != sum(
            trade.exit_reason == "end_of_data" for trade in self.trades
        ):
            raise ValueError("backtest forced-exit count does not match")

        def expected(prefix: str, values: Sequence[object]) -> list[str]:
            return [f"{prefix}-{index}" for index in range(1, len(values) + 1)]

        if [signal.id for signal in self.signals] != expected("signal", self.signals):
            raise ValueError("backtest signal identifiers are not deterministic")
        if [order.id for order in self.orders] != expected("order", self.orders):
            raise ValueError("backtest order identifiers are not deterministic")
        if [fill.id for fill in self.fills] != expected("fill", self.fills):
            raise ValueError("backtest fill identifiers are not deterministic")
        if [trade.id for trade in self.trades] != expected("trade", self.trades):
            raise ValueError("backtest trade identifiers are not deterministic")
        if [event.id for event in self.events] != expected("event", self.events):
            raise ValueError("backtest event identifiers are not deterministic")
        if [event.sequence for event in self.events] != list(
            range(1, len(self.events) + 1)
        ):
            raise ValueError("backtest event sequence is invalid")
        order_ids = {order.id for order in self.orders}
        fill_ids = {fill.id for fill in self.fills}
        signal_ids = {signal.id for signal in self.signals}
        if any(fill.order_id not in order_ids for fill in self.fills):
            raise ValueError("a backtest fill references an unknown order")
        if len(self.orders) != len(self.fills) or len(self.orders) != 2 * len(
            self.trades
        ):
            raise ValueError("each completed trade requires two orders and fills")
        for order, fill in zip(self.orders, self.fills, strict=True):
            if (
                fill.order_id != order.id
                or fill.side != order.side
                or fill.quantity != order.quantity
                or fill.candle_index != order.candle_index
                or fill.timestamp != order.submitted_at
            ):
                raise ValueError("a backtest fill does not match its order")
        if any(
            trade.entry_order_id not in order_ids
            or trade.exit_order_id not in order_ids
            or trade.entry_fill_id not in fill_ids
            or trade.exit_fill_id not in fill_ids
            or trade.entry_signal_id not in signal_ids
            or (
                trade.exit_signal_id is not None
                and trade.exit_signal_id not in signal_ids
            )
            for trade in self.trades
        ):
            raise ValueError("a backtest trade contains an unknown link")
        for index, trade in enumerate(self.trades):
            entry_order, exit_order = self.orders[index * 2 : index * 2 + 2]
            entry_fill, exit_fill = self.fills[index * 2 : index * 2 + 2]
            expected_sides = (
                ("buy", "sell") if trade.direction == "long" else ("sell", "buy")
            )
            if (
                entry_order.intent != "open"
                or exit_order.intent != "close"
                or entry_order.direction != trade.direction
                or exit_order.direction != trade.direction
                or (entry_order.side, exit_order.side) != expected_sides
                or trade.entry_order_id != entry_order.id
                or trade.exit_order_id != exit_order.id
                or trade.entry_fill_id != entry_fill.id
                or trade.exit_fill_id != exit_fill.id
                or trade.entry_time != entry_fill.timestamp
                or trade.exit_time != exit_fill.timestamp
                or exit_fill.candle_index < entry_fill.candle_index
            ):
                raise ValueError("a backtest trade does not match its execution pair")
            if (
                index
                and entry_fill.candle_index <= self.fills[index * 2 - 1].candle_index
            ):
                raise ValueError("backtest trades overlap or reverse at the same open")
            if trade.exit_reason == "end_of_data" and (
                index != len(self.trades) - 1
                or exit_fill.candle_index != self.candle_count - 1
            ):
                raise ValueError("end-of-data liquidation must be the final execution")
        allowed_actions = {
            "below_reference": {"open_long", "close_short"},
            "near_reference": {"close_long", "close_short"},
            "above_reference": {"open_short", "close_long"},
        }
        if any(
            signal.action not in allowed_actions[signal.state]
            for signal in self.signals
        ):
            raise ValueError("a backtest signal action does not match its state")
        trade_ids = {trade.id for trade in self.trades}
        if any(
            (event.signal_id is not None and event.signal_id not in signal_ids)
            or (event.order_id is not None and event.order_id not in order_ids)
            or (event.fill_id is not None and event.fill_id not in fill_ids)
            or (event.trade_id is not None and event.trade_id not in trade_ids)
            for event in self.events
        ):
            raise ValueError("a backtest event contains an unknown link")
        totals = {
            "gross": sum(
                (Decimal(trade.gross_pnl) for trade in self.trades), Decimal(0)
            ),
            "fees": sum(
                (Decimal(trade.total_fees) for trade in self.trades), Decimal(0)
            ),
            "slippage": sum(
                (Decimal(trade.slippage_cost) for trade in self.trades), Decimal(0)
            ),
            "net": sum((Decimal(trade.net_pnl) for trade in self.trades), Decimal(0)),
        }
        if totals != {
            "gross": Decimal(self.total_gross_pnl),
            "fees": Decimal(self.total_fees),
            "slippage": Decimal(self.total_slippage_cost),
            "net": Decimal(self.total_net_pnl),
        }:
            raise ValueError("backtest totals do not reconcile")
        return self


class BacktestCreate(ApiModel):
    schema_version: Literal[1] = Field(alias="schemaVersion")
    id: str = Field(min_length=1, max_length=100)
    operation_id: str = Field(alias="operationId", min_length=1, max_length=100)
    result: BacktestResult
    result_fingerprint: str = Field(
        alias="resultFingerprint", pattern=r"^[a-f0-9]{64}$"
    )


class BacktestRecord(BacktestCreate):
    created_at: datetime = Field(alias="createdAt")


class BacktestSummary(ApiModel):
    schema_version: Literal[1] = Field(alias="schemaVersion")
    id: str
    dataset_id: str = Field(alias="datasetId")
    engine_version: Literal["mean_reversion_backtest_v1"] = Field(alias="engineVersion")
    lookback: int
    deviation_threshold_percent: DecimalString = Field(
        alias="deviationThresholdPercent"
    )
    candle_count: int = Field(alias="candleCount", ge=1)
    trade_count: int = Field(alias="tradeCount", ge=0)
    created_at: datetime = Field(alias="createdAt")
