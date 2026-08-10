import sqlite3
from copy import deepcopy
from pathlib import Path

from fastapi.testclient import TestClient

from services.api.app.main import create_app
from services.api.app.repository import SQLiteSessionRepository, load_approved_dataset


def empty_state(cursor: int = 11) -> dict[str, object]:
    return {
        "cursor": cursor,
        "playback": "ready",
        "position": None,
        "trade": None,
        "holdCount": 0,
        "assumptions": None,
        "orders": [],
        "fills": [],
        "events": [],
        "latestError": None,
    }


def create_payload(session_id: str = "session-1") -> dict[str, object]:
    return {
        "schemaVersion": 1,
        "sessionId": session_id,
        "datasetId": "btc-usd-1h",
        "operationId": f"create-{session_id}",
        "executionConfig": {"quantity": "1", "feeBps": "0", "slippageBps": "0"},
        "state": empty_state(),
    }


def checkpoint_payload(
    state: dict[str, object], revision: int = 0, operation_id: str = "action-1"
) -> dict[str, object]:
    return {
        "schemaVersion": 1,
        "expectedRevision": revision,
        "operationId": operation_id,
        "executionConfig": {"quantity": "0.5", "feeBps": "5", "slippageBps": "10"},
        "state": state,
    }


def client_for(tmp_path: Path) -> TestClient:
    repository = SQLiteSessionRepository(tmp_path / "sessions.sqlite3")
    return TestClient(create_app(repository))


def opened_state() -> dict[str, object]:
    dataset = load_approved_dataset("btc-usd-1h")
    timestamp = dataset.candles[11].timestamp.isoformat().replace("+00:00", "Z")
    state = empty_state()
    assumptions = {
        "quantity": "0.5",
        "feeBps": "5",
        "slippageBps": "10",
        "fillPriceRule": "current candle close",
        "spreadBps": "0",
        "leverage": False,
    }
    state.update(
        {
            "playback": "paused",
            "position": {
                "direction": "long",
                "quantity": "0.5",
                "entryOrderId": "order-1",
                "entryFillId": "fill-1",
                "entryReferencePrice": "100.123456789",
                "entryPrice": "100.223580245789",
                "entryFee": "0.02505589506144725",
                "entrySlippageCost": "0.0500617283945",
                "entryTime": timestamp,
            },
            "assumptions": assumptions,
            "orders": [
                {
                    "id": "order-1",
                    "intent": "open",
                    "side": "buy",
                    "direction": "long",
                    "quantity": "0.5",
                    "submittedAt": timestamp,
                    "candleIndex": 11,
                    "status": "filled",
                }
            ],
            "fills": [
                {
                    "id": "fill-1",
                    "orderId": "order-1",
                    "side": "buy",
                    "quantity": "0.5",
                    "referencePrice": "100.123456789",
                    "executionPrice": "100.223580245789",
                    "fee": "0.02505589506144725",
                    "slippageCost": "0.0500617283945",
                    "timestamp": timestamp,
                    "candleIndex": 11,
                }
            ],
            "events": [
                {
                    "id": "event-1",
                    "sequence": 1,
                    "type": "position_opened",
                    "timestamp": timestamp,
                    "candleIndex": 11,
                    "message": "long position opened by order-1.",
                    "orderId": "order-1",
                    "fillId": "fill-1",
                }
            ],
        }
    )
    return state


def completed_state() -> dict[str, object]:
    dataset = load_approved_dataset("btc-usd-1h")
    state = opened_state()
    exit_timestamp = dataset.candles[12].timestamp.isoformat().replace("+00:00", "Z")
    orders = list(state["orders"])  # type: ignore[arg-type]
    fills = list(state["fills"])  # type: ignore[arg-type]
    events = list(state["events"])  # type: ignore[arg-type]
    orders.append(
        {
            "id": "order-2",
            "intent": "close",
            "side": "sell",
            "direction": "long",
            "quantity": "0.5",
            "submittedAt": exit_timestamp,
            "candleIndex": 12,
            "status": "filled",
        }
    )
    fills.append(
        {
            "id": "fill-2",
            "orderId": "order-2",
            "side": "sell",
            "quantity": "0.5",
            "referencePrice": "101.123456789",
            "executionPrice": "101.022333332211",
            "fee": "0.02525558333305275",
            "slippageCost": "0.050561728394",
            "timestamp": exit_timestamp,
            "candleIndex": 12,
        }
    )
    events.append(
        {
            "id": "event-2",
            "sequence": 2,
            "type": "position_closed",
            "timestamp": exit_timestamp,
            "candleIndex": 12,
            "message": "Position closed by order-2.",
            "orderId": "order-2",
            "fillId": "fill-2",
            "tradeId": "trade-1",
        }
    )
    state.update(
        {
            "cursor": 12,
            "playback": "completed",
            "position": None,
            "orders": orders,
            "fills": fills,
            "events": events,
            "trade": {
                "direction": "long",
                "quantity": "0.5",
                "entryOrderId": "order-1",
                "entryFillId": "fill-1",
                "entryReferencePrice": "100.123456789",
                "entryPrice": "100.223580245789",
                "entryTime": state["events"][0]["timestamp"],  # type: ignore[index]
                "exitOrderId": "order-2",
                "exitFillId": "fill-2",
                "exitReferencePrice": "101.123456789",
                "exitPrice": "101.022333332211",
                "exitTime": exit_timestamp,
                "grossPnl": "0.399376543211",
                "totalFees": "0.0503114783945",
                "slippageCost": "0.1006234567885",
                "netPnl": "0.3490650648165",
                "netReturnPercent": "0.696584744",
            },
        }
    )
    return state


def test_create_retrieve_list_and_survive_repository_restart(tmp_path: Path) -> None:
    database = tmp_path / "sessions.sqlite3"
    with TestClient(create_app(SQLiteSessionRepository(database))) as client:
        created = client.post("/api/v1/sessions", json=create_payload()).json()
        assert created["status"] == "active"
        assert created["checkpoint"]["revision"] == 0
        assert client.get("/api/v1/sessions/session-1").json() == created

    with TestClient(create_app(SQLiteSessionRepository(database))) as restarted:
        restored = restarted.get("/api/v1/sessions/session-1")
        assert restored.status_code == 200
        assert restored.json()["checkpoint"]["state"] == empty_state()
        summaries = restarted.get("/api/v1/sessions").json()
        assert [item["id"] for item in summaries] == ["session-1"]


def test_checkpoint_is_exact_and_retry_is_idempotent(tmp_path: Path) -> None:
    with client_for(tmp_path) as client:
        client.post("/api/v1/sessions", json=create_payload())
        payload = checkpoint_payload(opened_state())
        first = client.put("/api/v1/sessions/session-1/checkpoint", json=payload)
        retry = client.put("/api/v1/sessions/session-1/checkpoint", json=payload)
        assert first.status_code == retry.status_code == 200
        assert retry.json()["checkpoint"]["revision"] == 1
        assert (
            retry.json()["checkpoint"]["state"] == first.json()["checkpoint"]["state"]
        )
        assert (
            retry.json()["checkpoint"]["state"]["position"]["entryPrice"]
            == "100.223580245789"
        )


def test_complete_is_read_only_and_abandon_is_supported(tmp_path: Path) -> None:
    with client_for(tmp_path) as client:
        client.post("/api/v1/sessions", json=create_payload())
        completed = client.post(
            "/api/v1/sessions/session-1/complete",
            json=checkpoint_payload(completed_state(), operation_id="complete-1"),
        )
        assert completed.status_code == 200
        assert completed.json()["status"] == "completed"
        rejected = client.put(
            "/api/v1/sessions/session-1/checkpoint",
            json=checkpoint_payload(completed_state(), revision=1, operation_id="late"),
        )
        assert rejected.status_code == 409
        assert "read-only" in rejected.json()["detail"]

        client.post("/api/v1/sessions", json=create_payload("session-2"))
        abandoned = client.post(
            "/api/v1/sessions/session-2/abandon",
            json={"expectedRevision": 0, "operationId": "abandon-1"},
        )
        assert abandoned.status_code == 200
        assert abandoned.json()["status"] == "abandoned"


def test_missing_conflicting_and_future_checkpoints_are_rejected(
    tmp_path: Path,
) -> None:
    with client_for(tmp_path) as client:
        assert client.get("/api/v1/sessions/missing").status_code == 404
        client.post("/api/v1/sessions", json=create_payload())
        stale = checkpoint_payload(opened_state(), revision=2)
        assert (
            client.put("/api/v1/sessions/session-1/checkpoint", json=stale).status_code
            == 409
        )

        invalid = deepcopy(opened_state())
        invalid["events"][0]["candleIndex"] = 12  # type: ignore[index]
        invalid_response = client.put(
            "/api/v1/sessions/session-1/checkpoint",
            json=checkpoint_payload(invalid, operation_id="future"),
        )
        assert invalid_response.status_code == 422
        assert "future candle" in invalid_response.json()["detail"]


def test_list_order_is_deterministic(tmp_path: Path) -> None:
    with client_for(tmp_path) as client:
        for session_id in ("session-b", "session-a"):
            client.post("/api/v1/sessions", json=create_payload(session_id))
        summaries = client.get("/api/v1/sessions").json()
        assert {item["id"] for item in summaries} == {"session-a", "session-b"}


def test_persistence_failure_returns_stable_service_error(tmp_path: Path) -> None:
    repository = SQLiteSessionRepository(tmp_path / "sessions.sqlite3")
    with TestClient(create_app(repository)) as client:
        original_list = repository.list
        repository.list = lambda: (_ for _ in ()).throw(sqlite3.OperationalError())  # type: ignore[method-assign]
        response = client.get("/api/v1/sessions")
        repository.list = original_list  # type: ignore[method-assign]
        assert response.status_code == 503
        assert response.json() == {
            "detail": "Session persistence is temporarily unavailable. Retry the request."
        }


def test_checkpoint_write_rolls_back_when_operation_ledger_fails(
    tmp_path: Path,
) -> None:
    database = tmp_path / "sessions.sqlite3"
    with TestClient(create_app(SQLiteSessionRepository(database))) as client:
        client.post("/api/v1/sessions", json=create_payload())
        with sqlite3.connect(database) as connection:
            connection.execute(
                """
                CREATE TRIGGER fail_test_operation
                BEFORE INSERT ON session_operations
                WHEN NEW.operation_id = 'fail-transaction'
                BEGIN
                    SELECT RAISE(ABORT, 'forced test failure');
                END
                """
            )
        failed = client.put(
            "/api/v1/sessions/session-1/checkpoint",
            json=checkpoint_payload(opened_state(), operation_id="fail-transaction"),
        )
        assert failed.status_code == 503
        restored = client.get("/api/v1/sessions/session-1").json()
        assert restored["checkpoint"]["revision"] == 0
        assert restored["checkpoint"]["state"] == empty_state()
