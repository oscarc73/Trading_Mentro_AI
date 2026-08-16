import hashlib
import json
import sqlite3
from copy import deepcopy
from pathlib import Path

from fastapi.testclient import TestClient

from services.api.app.main import create_app
from services.api.app.repository import SQLiteSessionRepository


def client_for(tmp_path: Path) -> TestClient:
    return TestClient(
        create_app(SQLiteSessionRepository(tmp_path / "sessions.sqlite3"))
    )


def backtest_payload(
    client: TestClient, record_id: str = "backtest-1"
) -> dict[str, object]:
    dataset = client.get("/api/v1/datasets/btc-usd-1h").json()
    result = {
        "schemaVersion": 1,
        "engineVersion": "mean_reversion_backtest_v1",
        "dataset": {
            "id": dataset["metadata"]["id"],
            "generatedAt": dataset["metadata"]["generated_at"],
            "candleCount": len(dataset["candles"]),
            "fingerprint": dataset["fingerprint"],
        },
        "config": {
            "strategyContext": {
                "model": "sma_deviation_v1",
                "config": {
                    "lookback": 2,
                    "deviationThresholdPercent": "1000",
                },
            },
            "rules": {
                "model": "mean_reversion_threshold_v1",
                "entrySignalTiming": "candle_close",
                "signalFillTiming": "next_candle_open",
                "finalPositionPolicy": "close_at_final_candle_close",
            },
            "executionConfig": {
                "quantity": "1",
                "feeBps": "0",
                "slippageBps": "0",
            },
        },
        "signals": [
            {
                "id": "signal-1",
                "candleIndex": len(dataset["candles"]) - 1,
                "timestamp": dataset["candles"][-1]["timestamp"],
                "state": "below_reference",
                "action": "open_long",
                "executionCandleIndex": None,
                "status": "ignored_end_of_data",
            }
        ],
        "orders": [],
        "fills": [],
        "trades": [],
        "events": [
            {
                "id": "event-1",
                "sequence": 1,
                "type": "signal_created",
                "candleIndex": len(dataset["candles"]) - 1,
                "timestamp": dataset["candles"][-1]["timestamp"],
                "message": "Terminal signal recorded without an executable candle.",
                "signalId": "signal-1",
            }
        ],
        "candleCount": len(dataset["candles"]),
        "tradeCount": 0,
        "forcedExitCount": 0,
        "totalGrossPnl": "0",
        "totalFees": "0",
        "totalSlippageCost": "0",
        "totalNetPnl": "0",
    }
    canonical = json.dumps(
        result, ensure_ascii=False, separators=(",", ":"), sort_keys=True
    )
    return {
        "schemaVersion": 1,
        "id": record_id,
        "operationId": f"create-{record_id}",
        "result": result,
        "resultFingerprint": hashlib.sha256(canonical.encode()).hexdigest(),
    }


def test_backtest_record_round_trips_and_survives_restart(tmp_path: Path) -> None:
    database = tmp_path / "sessions.sqlite3"
    with TestClient(create_app(SQLiteSessionRepository(database))) as client:
        payload = backtest_payload(client)
        created = client.post("/api/v1/backtests", json=payload)
        retried = client.post("/api/v1/backtests", json=payload)
        assert created.status_code == 201, created.text
        assert retried.status_code == 201, retried.text
        assert created.json() == retried.json()
        assert created.json()["result"]["tradeCount"] == 0

    with TestClient(create_app(SQLiteSessionRepository(database))) as restarted:
        restored = restarted.get("/api/v1/backtests/backtest-1")
        assert restored.status_code == 200
        assert restored.json()["resultFingerprint"] == payload["resultFingerprint"]
        summaries = restarted.get("/api/v1/backtests").json()
        assert summaries == [
            {
                "schemaVersion": 1,
                "id": "backtest-1",
                "datasetId": "btc-usd-1h",
                "engineVersion": "mean_reversion_backtest_v1",
                "lookback": 2,
                "deviationThresholdPercent": "1000",
                "candleCount": 32,
                "tradeCount": 0,
                "createdAt": restored.json()["createdAt"],
            }
        ]


def test_backtest_rejects_fingerprint_dataset_and_identifier_conflicts(
    tmp_path: Path,
) -> None:
    with client_for(tmp_path) as client:
        payload = backtest_payload(client)
        invalid_digest = deepcopy(payload)
        invalid_digest["resultFingerprint"] = "0" * 64
        assert client.post("/api/v1/backtests", json=invalid_digest).status_code == 422

        invalid_dataset = deepcopy(payload)
        invalid_dataset["result"]["dataset"]["fingerprint"] = "b" * 64  # type: ignore[index]
        assert client.post("/api/v1/backtests", json=invalid_dataset).status_code == 422

        accepted = client.post("/api/v1/backtests", json=payload)
        assert accepted.status_code == 201, accepted.text
        conflicting = backtest_payload(client)
        conflicting["operationId"] = "different-operation"
        assert client.post("/api/v1/backtests", json=conflicting).status_code == 409
        assert (
            client.put("/api/v1/backtests/backtest-1", json=payload).status_code == 405
        )


def test_schema_version_one_database_migrates_additively(tmp_path: Path) -> None:
    database = tmp_path / "legacy.sqlite3"
    with sqlite3.connect(database) as connection:
        connection.execute("CREATE TABLE schema_info (version INTEGER NOT NULL)")
        connection.execute("INSERT INTO schema_info(version) VALUES (1)")
    repository = SQLiteSessionRepository(database)
    repository.initialize()
    with sqlite3.connect(database) as connection:
        assert connection.execute("SELECT version FROM schema_info").fetchone() == (2,)
        assert connection.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='backtests'"
        ).fetchone() == ("backtests",)
