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
    schema_version: Literal[1] = Field(alias="schemaVersion")
    revision: int = Field(ge=0)
    operation_id: str = Field(alias="operationId", min_length=1, max_length=100)
    execution_config: ExecutionConfig = Field(alias="executionConfig")
    state: SimulationState


class CheckpointWrite(ApiModel):
    schema_version: Literal[1] = Field(alias="schemaVersion")
    expected_revision: int = Field(alias="expectedRevision", ge=0)
    operation_id: str = Field(alias="operationId", min_length=1, max_length=100)
    execution_config: ExecutionConfig = Field(alias="executionConfig")
    state: SimulationState


class SessionCreate(ApiModel):
    schema_version: Literal[1] = Field(alias="schemaVersion")
    session_id: str = Field(alias="sessionId", min_length=1, max_length=100)
    dataset_id: str = Field(alias="datasetId")
    operation_id: str = Field(alias="operationId", min_length=1, max_length=100)
    execution_config: ExecutionConfig = Field(alias="executionConfig")
    state: SimulationState


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
