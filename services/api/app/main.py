import json
import sqlite3
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from .models import (
    CheckpointWrite,
    Dataset,
    SessionCreate,
    SessionSummary,
    SessionTransition,
    SimulationSession,
)
from .repository import (
    SessionConflictError,
    SessionDataError,
    SessionNotFoundError,
    SessionReadOnlyError,
    SQLiteSessionRepository,
    load_approved_dataset,
)


def create_app(
    session_repository: SQLiteSessionRepository | None = None,
) -> FastAPI:
    repository = session_repository or SQLiteSessionRepository()

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        repository.initialize()
        yield

    api = FastAPI(title="Trading Mentor AI API", version="0.2.0", lifespan=lifespan)
    api.state.session_repository = repository
    api.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT"],
        allow_headers=["*"],
    )

    @api.exception_handler(SessionNotFoundError)
    async def not_found(_: Request, error: SessionNotFoundError) -> JSONResponse:
        return _error_response(404, str(error))

    @api.exception_handler(SessionConflictError)
    async def conflict(_: Request, error: SessionConflictError) -> JSONResponse:
        return _error_response(409, str(error))

    @api.exception_handler(SessionReadOnlyError)
    async def read_only(_: Request, error: SessionReadOnlyError) -> JSONResponse:
        return _error_response(409, str(error))

    @api.exception_handler(SessionDataError)
    async def invalid_data(_: Request, error: SessionDataError) -> JSONResponse:
        return _error_response(422, str(error))

    @api.exception_handler(sqlite3.Error)
    async def persistence_unavailable(_: Request, __: sqlite3.Error) -> JSONResponse:
        return _error_response(
            503, "Session persistence is temporarily unavailable. Retry the request."
        )

    @api.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @api.get("/api/v1/datasets/{dataset_id}", response_model=Dataset)
    def get_dataset(dataset_id: str) -> Dataset:
        try:
            return load_approved_dataset(dataset_id)
        except KeyError as error:
            raise HTTPException(
                status_code=404, detail="Dataset is not approved or does not exist."
            ) from error
        except (OSError, json.JSONDecodeError, ValidationError) as error:
            raise HTTPException(
                status_code=422, detail=f"Approved dataset is invalid: {error}"
            ) from error

    @api.post("/api/v1/sessions", response_model=SimulationSession, status_code=201)
    def create_session(request: SessionCreate) -> SimulationSession:
        return repository.create(request)

    @api.get("/api/v1/sessions", response_model=list[SessionSummary])
    def list_sessions() -> list[SessionSummary]:
        return repository.list()

    @api.get("/api/v1/sessions/{session_id}", response_model=SimulationSession)
    def get_session(session_id: str) -> SimulationSession:
        return repository.get(session_id)

    @api.put(
        "/api/v1/sessions/{session_id}/checkpoint",
        response_model=SimulationSession,
    )
    def save_checkpoint(session_id: str, request: CheckpointWrite) -> SimulationSession:
        return repository.checkpoint(session_id, request)

    @api.post(
        "/api/v1/sessions/{session_id}/complete",
        response_model=SimulationSession,
    )
    def complete_session(
        session_id: str, request: CheckpointWrite
    ) -> SimulationSession:
        return repository.complete(session_id, request)

    @api.post(
        "/api/v1/sessions/{session_id}/abandon",
        response_model=SimulationSession,
    )
    def abandon_session(
        session_id: str, request: SessionTransition
    ) -> SimulationSession:
        return repository.abandon(
            session_id, request.expected_revision, request.operation_id
        )

    return api


def _error_response(status_code: int, detail: str) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"detail": detail})


app = create_app()
