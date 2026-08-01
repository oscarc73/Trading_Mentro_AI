import json

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError

from .models import Dataset
from .repository import load_approved_dataset

app = FastAPI(title="Trading Mentor AI API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/v1/datasets/{dataset_id}", response_model=Dataset)
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
