"""Fair Value Gap (FVG) / imbalance tespiti."""

from __future__ import annotations

from dataclasses import replace
from typing import List

import pandas as pd

from .types import Direction, FairValueGap


def find_fair_value_gaps(df: pd.DataFrame) -> List[FairValueGap]:
    """3 mumluk klasik FVG tespiti: i-1, i, i+1 mumlari arasinda fitil bosluklarina bakar.

    Bullish FVG: low[i+1] > high[i-1]  -> bosluk = (high[i-1], low[i+1])
    Bearish FVG: high[i+1] < low[i-1]  -> bosluk = (high[i+1], low[i-1])
    """
    highs = df["high"].to_numpy()
    lows = df["low"].to_numpy()
    n = len(df)
    gaps: List[FairValueGap] = []

    for i in range(1, n - 1):
        if lows[i + 1] > highs[i - 1]:
            gaps.append(
                FairValueGap(
                    index=i,
                    timestamp=df.index[i],
                    direction=Direction.BULLISH,
                    top=float(lows[i + 1]),
                    bottom=float(highs[i - 1]),
                )
            )
        elif highs[i + 1] < lows[i - 1]:
            gaps.append(
                FairValueGap(
                    index=i,
                    timestamp=df.index[i],
                    direction=Direction.BEARISH,
                    top=float(lows[i - 1]),
                    bottom=float(highs[i + 1]),
                )
            )

    return gaps


def mark_mitigated(gaps: List[FairValueGap], df: pd.DataFrame) -> List[FairValueGap]:
    """Fiyat bosluga geri donup icine girdiginde mitigated=True isaretler."""
    highs = df["high"].to_numpy()
    lows = df["low"].to_numpy()
    result: List[FairValueGap] = []

    for g in gaps:
        mitigated = False
        mitigated_index = None
        for k in range(g.index + 2, len(df)):
            if g.direction == Direction.BULLISH and lows[k] <= g.top:
                mitigated = True
                mitigated_index = k
                break
            if g.direction == Direction.BEARISH and highs[k] >= g.bottom:
                mitigated = True
                mitigated_index = k
                break
        result.append(replace(g, mitigated=mitigated, mitigated_index=mitigated_index))

    return result
