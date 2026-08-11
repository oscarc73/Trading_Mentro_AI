import type {
  Dataset,
  ExecutionConfig,
  SessionSummary,
  SimulationSession,
  SimulationState,
  StrategyContext,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class SessionApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = "SessionApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/v1${path}`, {
      cache: "no-store",
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new SessionApiError("The local API is unavailable.", null);
  }
  if (!response.ok) {
    let detail = `API returned ${response.status}.`;
    try {
      const body = (await response.json()) as { detail?: string };
      if (body.detail) detail = body.detail;
    } catch {
      // Preserve the status-based fallback when the response is not JSON.
    }
    throw new SessionApiError(detail, response.status);
  }
  return (await response.json()) as T;
}

export function fetchDataset(datasetId = "btc-usd-1h"): Promise<Dataset> {
  return request<Dataset>(`/datasets/${datasetId}`);
}

export function listSessions(): Promise<SessionSummary[]> {
  return request<SessionSummary[]>("/sessions");
}

export function getSession(sessionId: string): Promise<SimulationSession> {
  return request<SimulationSession>(`/sessions/${sessionId}`);
}

export function createSession({
  sessionId,
  datasetId,
  operationId,
  executionConfig,
  strategyContext,
  state,
}: {
  sessionId: string;
  datasetId: string;
  operationId: string;
  executionConfig: ExecutionConfig;
  strategyContext: StrategyContext;
  state: SimulationState;
}): Promise<SimulationSession> {
  return request<SimulationSession>("/sessions", {
    method: "POST",
    body: JSON.stringify({
      schemaVersion: 2,
      sessionId,
      datasetId,
      operationId,
      executionConfig,
      strategyContext,
      state,
    }),
  });
}

export function saveCheckpoint({
  session,
  operationId,
  executionConfig,
  state,
  complete = false,
}: {
  session: SimulationSession;
  operationId: string;
  executionConfig: ExecutionConfig;
  state: SimulationState;
  complete?: boolean;
}): Promise<SimulationSession> {
  return request<SimulationSession>(
    `/sessions/${session.id}/${complete ? "complete" : "checkpoint"}`,
    {
      method: complete ? "POST" : "PUT",
      body: JSON.stringify({
        schemaVersion: session.checkpoint.schemaVersion,
        expectedRevision: session.checkpoint.revision,
        operationId,
        executionConfig,
        ...(session.checkpoint.schemaVersion === 2
          ? { strategyContext: session.checkpoint.strategyContext }
          : {}),
        state,
      }),
    },
  );
}

export function abandonSession(
  session: SimulationSession,
  operationId: string,
): Promise<SimulationSession> {
  return request<SimulationSession>(`/sessions/${session.id}/abandon`, {
    method: "POST",
    body: JSON.stringify({
      expectedRevision: session.checkpoint.revision,
      operationId,
    }),
  });
}
