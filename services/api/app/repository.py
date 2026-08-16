import hashlib
import json
import sqlite3
from datetime import UTC, datetime
from pathlib import Path
from types import TracebackType
from typing import Any

from pydantic import ValidationError

from .models import (
    BacktestCreate,
    BacktestRecord,
    BacktestResult,
    BacktestSummary,
    CheckpointWrite,
    Dataset,
    SessionCheckpoint,
    SessionCreate,
    SessionStatus,
    SessionSummary,
    SimulationSession,
)

FIXTURE_PATH = Path(__file__).parents[1] / "data" / "btc-usd-1h.json"
DEFAULT_SESSION_DB_PATH = Path(__file__).parents[1] / "data" / "sessions.sqlite3"
PERSISTENCE_SCHEMA_VERSION = 2


class SessionRepositoryError(Exception):
    pass


class SessionNotFoundError(SessionRepositoryError):
    pass


class SessionConflictError(SessionRepositoryError):
    pass


class SessionReadOnlyError(SessionRepositoryError):
    pass


class SessionDataError(SessionRepositoryError):
    pass


def load_approved_dataset(dataset_id: str) -> Dataset:
    if dataset_id != "btc-usd-1h":
        raise KeyError(dataset_id)
    fixture_bytes = FIXTURE_PATH.read_bytes()
    raw: Any = json.loads(fixture_bytes.decode("utf-8"))
    raw["fingerprint"] = hashlib.sha256(fixture_bytes).hexdigest()
    return Dataset.model_validate(raw)


def _utc_now() -> datetime:
    return datetime.now(UTC)


class SQLiteSessionRepository:
    def __init__(self, path: Path = DEFAULT_SESSION_DB_PATH) -> None:
        self.path = path

    def initialize(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS schema_info (version INTEGER NOT NULL);
                CREATE TABLE IF NOT EXISTS sessions (
                    id TEXT PRIMARY KEY,
                    schema_version INTEGER NOT NULL,
                    status TEXT NOT NULL,
                    dataset_json TEXT NOT NULL,
                    candle_count INTEGER NOT NULL,
                    checkpoint_json TEXT NOT NULL,
                    revision INTEGER NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    completed_at TEXT,
                    abandoned_at TEXT
                );
                CREATE TABLE IF NOT EXISTS session_operations (
                    session_id TEXT NOT NULL,
                    operation_id TEXT NOT NULL,
                    revision INTEGER NOT NULL,
                    PRIMARY KEY (session_id, operation_id),
                    FOREIGN KEY (session_id) REFERENCES sessions(id)
                );
                CREATE INDEX IF NOT EXISTS sessions_updated_idx
                    ON sessions(updated_at DESC, id ASC);
                CREATE TABLE IF NOT EXISTS backtests (
                    id TEXT PRIMARY KEY,
                    schema_version INTEGER NOT NULL,
                    dataset_id TEXT NOT NULL,
                    engine_version TEXT NOT NULL,
                    lookback INTEGER NOT NULL,
                    threshold_percent TEXT NOT NULL,
                    candle_count INTEGER NOT NULL,
                    trade_count INTEGER NOT NULL,
                    result_fingerprint TEXT NOT NULL,
                    record_json TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS backtest_operations (
                    backtest_id TEXT NOT NULL,
                    operation_id TEXT NOT NULL,
                    PRIMARY KEY (backtest_id, operation_id),
                    FOREIGN KEY (backtest_id) REFERENCES backtests(id)
                );
                CREATE INDEX IF NOT EXISTS backtests_created_idx
                    ON backtests(created_at DESC, id ASC);
                """
            )
            version = connection.execute(
                "SELECT version FROM schema_info LIMIT 1"
            ).fetchone()
            if version is None:
                connection.execute(
                    "INSERT INTO schema_info(version) VALUES (?)",
                    (PERSISTENCE_SCHEMA_VERSION,),
                )
            elif version["version"] == 1:
                connection.execute(
                    "UPDATE schema_info SET version = ?",
                    (PERSISTENCE_SCHEMA_VERSION,),
                )
            elif version["version"] != PERSISTENCE_SCHEMA_VERSION:
                raise SessionDataError(
                    f"Unsupported persistence schema version {version['version']}."
                )

    def create(self, request: SessionCreate) -> SimulationSession:
        dataset = load_approved_dataset(request.dataset_id)
        self._validate_state(request.state, dataset)
        now = _utc_now()
        checkpoint = SessionCheckpoint(
            schemaVersion=request.schema_version,
            revision=0,
            operationId=request.operation_id,
            executionConfig=request.execution_config,
            strategyContext=request.strategy_context,
            state=request.state,
        )
        session = SimulationSession(
            schemaVersion=1,
            id=request.session_id,
            status=SessionStatus.ACTIVE,
            dataset=dataset.metadata,
            checkpoint=checkpoint,
            createdAt=now,
            updatedAt=now,
        )
        with self._transaction() as connection:
            existing = connection.execute(
                "SELECT * FROM sessions WHERE id = ?", (request.session_id,)
            ).fetchone()
            if existing is not None:
                operation = connection.execute(
                    "SELECT 1 FROM session_operations WHERE session_id = ? AND operation_id = ?",
                    (request.session_id, request.operation_id),
                ).fetchone()
                if operation is None:
                    raise SessionConflictError("The session identifier already exists.")
                return self._row_to_session(existing)
            connection.execute(
                """
                INSERT INTO sessions(
                    id, schema_version, status, dataset_json, candle_count,
                    checkpoint_json, revision, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    session.id,
                    1,
                    session.status.value,
                    dataset.metadata.model_dump_json(),
                    len(dataset.candles),
                    checkpoint.model_dump_json(by_alias=True),
                    0,
                    now.isoformat(),
                    now.isoformat(),
                ),
            )
            connection.execute(
                "INSERT INTO session_operations(session_id, operation_id, revision) VALUES (?, ?, ?)",
                (session.id, request.operation_id, 0),
            )
        return session

    def create_backtest(self, request: BacktestCreate) -> BacktestRecord:
        self._validate_backtest_result(request.result)
        calculated_fingerprint = self._backtest_fingerprint(request.result)
        if calculated_fingerprint != request.result_fingerprint:
            raise SessionDataError("The backtest result fingerprint is invalid.")
        now = _utc_now()
        record = BacktestRecord(
            schemaVersion=1,
            id=request.id,
            operationId=request.operation_id,
            result=request.result,
            resultFingerprint=request.result_fingerprint,
            createdAt=now,
        )
        with self._transaction() as connection:
            existing = connection.execute(
                "SELECT * FROM backtests WHERE id = ?", (request.id,)
            ).fetchone()
            if existing is not None:
                operation = connection.execute(
                    "SELECT 1 FROM backtest_operations WHERE backtest_id = ? AND operation_id = ?",
                    (request.id, request.operation_id),
                ).fetchone()
                if operation is None:
                    raise SessionConflictError(
                        "The backtest record identifier already exists."
                    )
                return self._row_to_backtest(existing)
            result = request.result
            connection.execute(
                """
                INSERT INTO backtests(
                    id, schema_version, dataset_id, engine_version, lookback,
                    threshold_percent, candle_count, trade_count,
                    result_fingerprint, record_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    record.id,
                    1,
                    result.dataset.id,
                    result.engine_version,
                    result.config.strategy_context.config.lookback,
                    result.config.strategy_context.config.deviation_threshold_percent,
                    result.candle_count,
                    result.trade_count,
                    record.result_fingerprint,
                    record.model_dump_json(by_alias=True, exclude_unset=True),
                    now.isoformat(),
                ),
            )
            connection.execute(
                "INSERT INTO backtest_operations(backtest_id, operation_id) VALUES (?, ?)",
                (record.id, record.operation_id),
            )
        return record

    def get_backtest(self, backtest_id: str) -> BacktestRecord:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT * FROM backtests WHERE id = ?", (backtest_id,)
            ).fetchone()
        if row is None:
            raise SessionNotFoundError("The backtest record does not exist.")
        record = self._row_to_backtest(row)
        self._validate_backtest_result(record.result)
        if self._backtest_fingerprint(record.result) != record.result_fingerprint:
            raise SessionDataError("The stored backtest fingerprint is invalid.")
        return record

    def list_backtests(self) -> list[BacktestSummary]:
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT * FROM backtests ORDER BY created_at DESC, id ASC"
            ).fetchall()
        return [
            BacktestSummary(
                schemaVersion=row["schema_version"],
                id=row["id"],
                datasetId=row["dataset_id"],
                engineVersion=row["engine_version"],
                lookback=row["lookback"],
                deviationThresholdPercent=row["threshold_percent"],
                candleCount=row["candle_count"],
                tradeCount=row["trade_count"],
                createdAt=row["created_at"],
            )
            for row in rows
        ]

    def get(self, session_id: str) -> SimulationSession:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT * FROM sessions WHERE id = ?", (session_id,)
            ).fetchone()
        if row is None:
            raise SessionNotFoundError("The session does not exist.")
        session = self._row_to_session(row)
        self._validate_restorable(session)
        return session

    def list(self) -> list[SessionSummary]:
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT * FROM sessions ORDER BY updated_at DESC, id ASC"
            ).fetchall()
        summaries: list[SessionSummary] = []
        for row in rows:
            session = self._row_to_session(row)
            state = session.checkpoint.state
            direction = (
                state.position.direction
                if state.position
                else state.trade.direction
                if state.trade
                else None
            )
            summaries.append(
                SessionSummary(
                    schemaVersion=1,
                    id=session.id,
                    status=session.status,
                    datasetId=session.dataset.id,
                    asset=session.dataset.asset,
                    timeframe=session.dataset.timeframe,
                    cursor=state.cursor,
                    candleCount=row["candle_count"],
                    direction=direction,
                    netPnl=state.trade.net_pnl if state.trade else None,
                    createdAt=session.created_at,
                    updatedAt=session.updated_at,
                )
            )
        return summaries

    def checkpoint(
        self, session_id: str, request: CheckpointWrite
    ) -> SimulationSession:
        return self._write_checkpoint(session_id, request, SessionStatus.ACTIVE)

    def complete(self, session_id: str, request: CheckpointWrite) -> SimulationSession:
        if request.state.trade is None or request.state.position is not None:
            raise SessionConflictError(
                "A session can only complete with one closed trade."
            )
        return self._write_checkpoint(session_id, request, SessionStatus.COMPLETED)

    def abandon(
        self, session_id: str, expected_revision: int, operation_id: str
    ) -> SimulationSession:
        with self._transaction() as connection:
            row, operation_seen = self._row_for_write(
                connection, session_id, operation_id
            )
            if operation_seen:
                return self._row_to_session(row)
            session = self._row_to_session(row)
            self._require_active(session, expected_revision)
            now = _utc_now()
            connection.execute(
                "UPDATE sessions SET status = ?, updated_at = ?, abandoned_at = ? WHERE id = ?",
                (
                    SessionStatus.ABANDONED.value,
                    now.isoformat(),
                    now.isoformat(),
                    session_id,
                ),
            )
            connection.execute(
                "INSERT INTO session_operations(session_id, operation_id, revision) VALUES (?, ?, ?)",
                (session_id, operation_id, session.checkpoint.revision),
            )
            updated = connection.execute(
                "SELECT * FROM sessions WHERE id = ?", (session_id,)
            ).fetchone()
        if updated is None:
            raise SessionNotFoundError("The session does not exist.")
        return self._row_to_session(updated)

    def _write_checkpoint(
        self,
        session_id: str,
        request: CheckpointWrite,
        target_status: SessionStatus,
    ) -> SimulationSession:
        with self._transaction() as connection:
            row, operation_seen = self._row_for_write(
                connection, session_id, request.operation_id
            )
            if operation_seen:
                return self._row_to_session(row)
            session = self._row_to_session(row)
            self._require_active(session, request.expected_revision)
            if (
                request.schema_version != session.checkpoint.schema_version
                or request.strategy_context != session.checkpoint.strategy_context
            ):
                raise SessionConflictError(
                    "Strategy configuration is locked for this session."
                )
            dataset = load_approved_dataset(session.dataset.id)
            self._validate_state(request.state, dataset)
            revision = session.checkpoint.revision + 1
            now = _utc_now()
            checkpoint = SessionCheckpoint(
                schemaVersion=request.schema_version,
                revision=revision,
                operationId=request.operation_id,
                executionConfig=request.execution_config,
                strategyContext=request.strategy_context,
                state=request.state,
            )
            completed_at = (
                now.isoformat() if target_status == SessionStatus.COMPLETED else None
            )
            connection.execute(
                """
                UPDATE sessions
                SET status = ?, checkpoint_json = ?, revision = ?, updated_at = ?,
                    completed_at = COALESCE(?, completed_at)
                WHERE id = ?
                """,
                (
                    target_status.value,
                    checkpoint.model_dump_json(by_alias=True),
                    revision,
                    now.isoformat(),
                    completed_at,
                    session_id,
                ),
            )
            connection.execute(
                "INSERT INTO session_operations(session_id, operation_id, revision) VALUES (?, ?, ?)",
                (session_id, request.operation_id, revision),
            )
            updated = connection.execute(
                "SELECT * FROM sessions WHERE id = ?", (session_id,)
            ).fetchone()
        if updated is None:
            raise SessionNotFoundError("The session does not exist.")
        return self._row_to_session(updated)

    @staticmethod
    def _row_for_write(
        connection: sqlite3.Connection, session_id: str, operation_id: str
    ) -> tuple[sqlite3.Row, bool]:
        row = connection.execute(
            "SELECT * FROM sessions WHERE id = ?", (session_id,)
        ).fetchone()
        if row is None:
            raise SessionNotFoundError("The session does not exist.")
        operation = connection.execute(
            "SELECT 1 FROM session_operations WHERE session_id = ? AND operation_id = ?",
            (session_id, operation_id),
        ).fetchone()
        return row, operation is not None

    @staticmethod
    def _require_active(session: SimulationSession, expected_revision: int) -> None:
        if session.status != SessionStatus.ACTIVE:
            raise SessionReadOnlyError(
                "Completed and abandoned sessions are read-only."
            )
        if session.checkpoint.revision != expected_revision:
            raise SessionConflictError(
                "The session changed since it was loaded. Refresh before retrying."
            )

    @staticmethod
    def _validate_state(state: Any, dataset: Dataset) -> None:
        if state.cursor >= len(dataset.candles):
            raise SessionDataError("The checkpoint cursor is outside the dataset.")
        timestamp_by_index = [candle.timestamp for candle in dataset.candles]
        for item in [*state.orders, *state.fills, *state.events]:
            if item.candle_index > state.cursor:
                raise SessionDataError("The checkpoint references a future candle.")
            item_timestamp = getattr(item, "submitted_at", None) or getattr(
                item, "timestamp", None
            )
            if item_timestamp != timestamp_by_index[item.candle_index]:
                raise SessionDataError(
                    "The checkpoint event timestamp does not match the dataset."
                )

    def _validate_restorable(self, session: SimulationSession) -> None:
        try:
            dataset = load_approved_dataset(session.dataset.id)
        except (KeyError, OSError, json.JSONDecodeError, ValidationError) as error:
            raise SessionDataError(
                "The session dataset is unavailable or incompatible."
            ) from error
        if dataset.metadata != session.dataset:
            raise SessionDataError("The session dataset metadata is incompatible.")
        self._validate_state(session.checkpoint.state, dataset)

    @staticmethod
    def _backtest_fingerprint(result: BacktestResult) -> str:
        canonical = json.dumps(
            result.model_dump(mode="json", by_alias=True, exclude_unset=True),
            ensure_ascii=False,
            separators=(",", ":"),
            sort_keys=True,
        )
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()

    @staticmethod
    def _validate_backtest_result(result: BacktestResult) -> None:
        try:
            dataset = load_approved_dataset(result.dataset.id)
        except (KeyError, OSError, json.JSONDecodeError, ValidationError) as error:
            raise SessionDataError(
                "The backtest dataset is unavailable or incompatible."
            ) from error
        if (
            result.dataset.fingerprint != dataset.fingerprint
            or result.dataset.generated_at != dataset.metadata.generated_at
            or result.dataset.candle_count != len(dataset.candles)
        ):
            raise SessionDataError("The backtest dataset fingerprint is incompatible.")
        timestamps = [candle.timestamp for candle in dataset.candles]
        timestamped_items = [
            *((signal.candle_index, signal.timestamp) for signal in result.signals),
            *((order.candle_index, order.submitted_at) for order in result.orders),
            *((fill.candle_index, fill.timestamp) for fill in result.fills),
            *((event.candle_index, event.timestamp) for event in result.events),
        ]
        for candle_index, timestamp in timestamped_items:
            if candle_index >= len(dataset.candles):
                raise SessionDataError(
                    "The backtest references a candle outside the dataset."
                )
            if timestamp != timestamps[candle_index]:
                raise SessionDataError(
                    "A backtest timestamp does not match the approved dataset."
                )
        fill_by_id = {fill.id: fill for fill in result.fills}
        signal_by_id = {signal.id: signal for signal in result.signals}
        for trade in result.trades:
            entry_signal = signal_by_id[trade.entry_signal_id]
            if entry_signal.action != f"open_{trade.direction}":
                raise SessionDataError(
                    "A trade direction does not match its entry signal."
                )
            entry_fill = fill_by_id[trade.entry_fill_id]
            if entry_fill.candle_index != entry_signal.execution_candle_index:
                raise SessionDataError(
                    "A trade entry did not fill on the queued candle."
                )
            if trade.exit_reason == "strategy":
                if trade.exit_signal_id is None:
                    raise SessionDataError("A strategy exit is missing its signal.")
                exit_signal = signal_by_id[trade.exit_signal_id]
                exit_fill = fill_by_id[trade.exit_fill_id]
                if (
                    exit_signal.action != f"close_{trade.direction}"
                    or exit_fill.candle_index != exit_signal.execution_candle_index
                ):
                    raise SessionDataError(
                        "A trade exit did not fill on the queued candle."
                    )
            elif trade.exit_signal_id is not None:
                raise SessionDataError("An end-of-data exit cannot reference a signal.")

    @staticmethod
    def _row_to_session(row: sqlite3.Row) -> SimulationSession:
        try:
            return SimulationSession.model_validate(
                {
                    "schemaVersion": row["schema_version"],
                    "id": row["id"],
                    "status": row["status"],
                    "dataset": json.loads(row["dataset_json"]),
                    "checkpoint": json.loads(row["checkpoint_json"]),
                    "createdAt": row["created_at"],
                    "updatedAt": row["updated_at"],
                    "completedAt": row["completed_at"],
                    "abandonedAt": row["abandoned_at"],
                }
            )
        except (json.JSONDecodeError, ValidationError) as error:
            raise SessionDataError("The stored session state is invalid.") from error

    @staticmethod
    def _row_to_backtest(row: sqlite3.Row) -> BacktestRecord:
        try:
            return BacktestRecord.model_validate(json.loads(row["record_json"]))
        except (json.JSONDecodeError, ValidationError) as error:
            raise SessionDataError("The stored backtest record is invalid.") from error

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path, timeout=5)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        return connection

    def _transaction(self) -> "_Transaction":
        connection = self._connect()
        connection.isolation_level = None
        connection.execute("BEGIN IMMEDIATE")
        return _Transaction(connection)


class _Transaction:
    def __init__(self, connection: sqlite3.Connection) -> None:
        self.connection = connection

    def __enter__(self) -> sqlite3.Connection:
        return self.connection

    def __exit__(
        self,
        error_type: type[BaseException] | None,
        error: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        if error_type is None:
            self.connection.commit()
        else:
            self.connection.rollback()
        self.connection.close()
