"use client";

import { useCallback, useEffect, useState } from "react";
import type { Dataset } from "@/domain/types";
import { Simulator } from "./simulator";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function fetchDataset(): Promise<Dataset> {
  const response = await fetch(`${API_URL}/api/v1/datasets/btc-usd-1h`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`API returned ${response.status}.`);
  const value = (await response.json()) as Dataset;
  if (!value.candles?.length) throw new Error("The approved dataset is empty.");
  return value;
}

export function SimulatorLoader() {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDataset(await fetchDataset());
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The simulator data could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void fetchDataset()
      .then((value) => {
        if (active) setDataset(value);
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : "The simulator data could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="center-state">
        <span className="spinner" />
        <p>Loading the practice market…</p>
      </div>
    );
  }
  if (error || !dataset) {
    return (
      <div className="center-state error-state" role="alert">
        <span className="state-icon">!</span>
        <h1>Market data unavailable</h1>
        <p>
          {error ?? "No candles were returned."} Start the local API and try
          again.
        </p>
        <button className="primary-button" onClick={() => void load()}>
          Try again
        </button>
      </div>
    );
  }
  return <Simulator dataset={dataset} />;
}
