"""Likidite havuzlari (esit high/low) ve likidite supurmesi (liquidity sweep) tespiti."""

from __future__ import annotations

from typing import List, Optional, Tuple

import pandas as pd

from .types import LiquidityPool, SwingPoint, SwingType


def _cluster(points: List[SwingPoint], tolerance: float) -> List[Tuple[float, List[int]]]:
    points = sorted(points, key=lambda p: p.price)
    used = [False] * len(points)
    clusters: List[Tuple[float, List[int]]] = []

    for i, p in enumerate(points):
        if used[i]:
            continue
        group = [p]
        used[i] = True
        for j in range(i + 1, len(points)):
            if used[j]:
                continue
            if p.price != 0 and abs(points[j].price - p.price) / abs(p.price) <= tolerance:
                group.append(points[j])
                used[j] = True
        avg_price = sum(g.price for g in group) / len(group)
        clusters.append((avg_price, [g.index for g in group]))

    return clusters


def find_liquidity_pools(swings: List[SwingPoint], tolerance: float = 0.0015) -> List[LiquidityPool]:
    """Birbirine yakin (tolerance orani icinde) swing high/low'lari kumeleyip
    likidite havuzu olarak dondurur (esit tepeler = buy-side, esit dipler = sell-side)."""
    highs = [s for s in swings if s.kind == SwingType.HIGH]
    lows = [s for s in swings if s.kind == SwingType.LOW]

    pools: List[LiquidityPool] = []
    for price, idxs in _cluster(highs, tolerance):
        pools.append(LiquidityPool(price=price, kind=SwingType.HIGH, swing_indices=tuple(idxs)))
    for price, idxs in _cluster(lows, tolerance):
        pools.append(LiquidityPool(price=price, kind=SwingType.LOW, swing_indices=tuple(idxs)))

    return pools


def detect_sweep(df: pd.DataFrame, pool: LiquidityPool, after_index: int = 0) -> Optional[int]:
    """Fiyatin havuzun seviyesini fitille gecip, o seviyenin gerisinde kapandigi
    ilk mum indexini dondurur (stop hunt / likidite supurmesi onayi)."""
    highs = df["high"].to_numpy()
    lows = df["low"].to_numpy()
    closes = df["close"].to_numpy()

    for i in range(after_index, len(df)):
        if pool.kind == SwingType.HIGH:
            if highs[i] > pool.price and closes[i] < pool.price:
                return i
        else:
            if lows[i] < pool.price and closes[i] > pool.price:
                return i
    return None
