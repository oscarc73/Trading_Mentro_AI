import json
import sqlite3
from datetime import UTC, datetime
from pathlib import Path
from types import TracebackType
from typing import Any

from pydantic import ValidationError

from .models import (
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
PERSISTENCE_SCHEMA_VERSION = 1


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
    raw: Any = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
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
