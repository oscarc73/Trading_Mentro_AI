from copy import deepcopy

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from services.api.app.main import app
from services.api.app.models import Dataset

client = TestClient(app)

VALID = {
    "metadata": {
        "id": "test",
        "asset": "TEST/USD",
        "timeframe": "1h",
        "currency": "USD",
        "data_kind": "historical-generated",
        "source": "test",
        "generated_at": "2026-01-01T00:00:00Z",
    },
    "candles": [
        {
            "timestamp": "2026-01-01T00:00:00Z",
            "open": "10",
            "high": "12",
            "low": "9",
            "close": "11",
            "volume": "20",
        },
        {
            "timestamp": "2026-01-01T01:00:00Z",
            "open": "11",
            "high": "13",
            "low": "10",
            "close": "12",
            "volume": "25",
        },
    ],
}


def test_health_and_approved_fixture() -> None:
    assert client.get("/health").json() == {"status": "ok"}
    response = client.get("/api/v1/datasets/btc-usd-1h")
    assert response.status_code == 200
    assert response.json()["metadata"]["id"] == "btc-usd-1h"


def test_unknown_dataset_is_rejected() -> None:
    response = client.get("/api/v1/datasets/not-approved")
    assert response.status_code == 404
    assert "not approved" in response.json()["detail"]


def test_local_loopback_origins_are_allowed() -> None:
    for origin in ("http://localhost:3000", "http://127.0.0.1:3000"):
        response = client.get("/health", headers={"Origin": origin})
        assert response.headers["access-control-allow-origin"] == origin


@pytest.mark.parametrize("field", ["open", "high", "low", "close", "volume"])
def test_missing_numeric_field_is_rejected(field: str) -> None:
    data = deepcopy(VALID)
    del data["candles"][0][field]
    with pytest.raises(ValidationError):
        Dataset.model_validate(data)


def test_duplicate_timestamp_is_rejected() -> None:
    data = deepcopy(VALID)
    data["candles"][1]["timestamp"] = data["candles"][0]["timestamp"]
    with pytest.raises(ValidationError, match="duplicate timestamps"):
        Dataset.model_validate(data)


def test_unsorted_timestamp_is_rejected() -> None:
    data = deepcopy(VALID)
    data["candles"].reverse()
    with pytest.raises(ValidationError, match="ascending timestamp"):
        Dataset.model_validate(data)


def test_non_utc_timestamp_is_rejected() -> None:
    data = deepcopy(VALID)
    data["candles"][0]["timestamp"] = "2026-01-01T00:00:00"
    with pytest.raises(ValidationError, match="UTC timezone"):
        Dataset.model_validate(data)


def test_irregular_interval_is_rejected() -> None:
    data = deepcopy(VALID)
    data["candles"][1]["timestamp"] = "2026-01-01T02:00:00Z"
    with pytest.raises(ValidationError, match="gap or irregular"):
        Dataset.model_validate(data)


def test_impossible_candle_is_rejected() -> None:
    data = deepcopy(VALID)
    data["candles"][0]["high"] = "10"
    with pytest.raises(ValidationError, match="high must"):
        Dataset.model_validate(data)


def test_invalid_numeric_value_is_rejected() -> None:
    data = deepcopy(VALID)
    data["candles"][0]["close"] = "not-a-number"
    with pytest.raises(ValidationError):
        Dataset.model_validate(data)
