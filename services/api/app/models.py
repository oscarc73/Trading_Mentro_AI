from datetime import datetime, timedelta
from decimal import Decimal
from itertools import pairwise

from pydantic import BaseModel, Field, model_validator


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
