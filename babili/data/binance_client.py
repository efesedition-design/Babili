"""Binance public REST API'sinden (API key gerektirmez) OHLCV mum verisi cekme."""

from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Optional, Union

import pandas as pd
import requests

BASE_URL = "https://api.binance.com"

INTERVAL_MS = {
    "1m": 60_000,
    "3m": 180_000,
    "5m": 300_000,
    "15m": 900_000,
    "30m": 1_800_000,
    "1h": 3_600_000,
    "2h": 7_200_000,
    "4h": 14_400_000,
    "6h": 21_600_000,
    "8h": 28_800_000,
    "12h": 43_200_000,
    "1d": 86_400_000,
}

KLINES_COLUMNS = [
    "open_time",
    "open",
    "high",
    "low",
    "close",
    "volume",
    "close_time",
    "quote_asset_volume",
    "num_trades",
    "taker_buy_base",
    "taker_buy_quote",
    "ignore",
]


def _to_ms(value: Union[int, float, str, datetime]) -> int:
    if isinstance(value, (int, float)):
        return int(value)
    if isinstance(value, str):
        value = pd.Timestamp(value)
    if isinstance(value, pd.Timestamp):
        value = value.to_pydatetime()
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return int(value.timestamp() * 1000)


def fetch_klines(
    symbol: str,
    interval: str,
    start: Union[int, float, str, datetime],
    end: Optional[Union[int, float, str, datetime]] = None,
    limit: int = 1000,
    session: Optional[requests.Session] = None,
) -> pd.DataFrame:
    """Binance spot public klines endpoint'inden OHLCV verisi ceker ve
    zaman indeksli (UTC) bir pandas DataFrame olarak dondurur.

    Sayfalama otomatik yapilir; buyuk tarih araliklari birden fazla istekle cekilir.
    """
    if interval not in INTERVAL_MS:
        raise ValueError(f"Desteklenmeyen interval: {interval}. Secenekler: {sorted(INTERVAL_MS)}")

    session = session or requests.Session()
    start_ms = _to_ms(start)
    end_ms = _to_ms(end) if end is not None else int(time.time() * 1000)

    rows: list = []
    cursor = start_ms

    while cursor < end_ms:
        params = {
            "symbol": symbol.upper(),
            "interval": interval,
            "startTime": cursor,
            "endTime": end_ms,
            "limit": limit,
        }
        resp = session.get(f"{BASE_URL}/api/v3/klines", params=params, timeout=15)
        resp.raise_for_status()
        batch = resp.json()
        if not batch:
            break

        rows.extend(batch)
        next_cursor = batch[-1][0] + INTERVAL_MS[interval]
        if next_cursor <= cursor:
            break
        cursor = next_cursor

        if len(batch) < limit:
            break
        time.sleep(0.2)

    if not rows:
        return pd.DataFrame(columns=["open", "high", "low", "close", "volume"])

    df = pd.DataFrame(rows, columns=KLINES_COLUMNS)
    df["open_time"] = pd.to_datetime(df["open_time"], unit="ms", utc=True)
    df = df.set_index("open_time")
    for col in ("open", "high", "low", "close", "volume"):
        df[col] = df[col].astype(float)
    df = df[["open", "high", "low", "close", "volume"]]
    df = df[~df.index.duplicated(keep="first")].sort_index()
    return df
