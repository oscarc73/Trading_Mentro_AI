import json
from pathlib import Path
from typing import Any

from .models import Dataset

FIXTURE_PATH = Path(__file__).parents[1] / "data" / "btc-usd-1h.json"


def load_approved_dataset(dataset_id: str) -> Dataset:
    if dataset_id != "btc-usd-1h":
        raise KeyError(dataset_id)
    raw: Any = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    return Dataset.model_validate(raw)
