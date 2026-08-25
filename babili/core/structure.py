"""Swing (fraktal) tespiti ve piyasa yapisi (BOS / CHoCH) analizi."""

from __future__ import annotations

from typing import List, Optional

import numpy as np
import pandas as pd

from .types import Direction, StructureEvent, SwingPoint, SwingType


def detect_swings(df: pd.DataFrame, left: int = 2, right: int = 2) -> List[SwingPoint]:
    """Fraktal bazli swing high/low noktalarini tespit eder.

    Bir mum, kendisinden `left` mum once ve `right` mum sonraki en yuksek/en dusuk
    ise swing high/low olarak isaretlenir. Bir swing, ancak sagindaki `right` mum
    olustuktan sonra (confirmed_index = index + right) "biliniyor" sayilir; bu,
    backtest sirasinda ileri bakisi (lookahead) engellemek icin kullanilir.
    """
    highs = df["high"].to_numpy()
    lows = df["low"].to_numpy()
    n = len(df)
    swings: List[SwingPoint] = []

    for i in range(left, n - right):
        window_high = highs[i - left : i + right + 1]
        if highs[i] == window_high.max() and np.argmax(window_high) == left:
            swings.append(
                SwingPoint(
                    index=i,
                    confirmed_index=i + right,
                    timestamp=df.index[i],
                    price=float(highs[i]),
                    kind=SwingType.HIGH,
                )
            )
        window_low = lows[i - left : i + right + 1]
        if lows[i] == window_low.min() and np.argmin(window_low) == left:
            swings.append(
                SwingPoint(
                    index=i,
                    confirmed_index=i + right,
                    timestamp=df.index[i],
                    price=float(lows[i]),
                    kind=SwingType.LOW,
                )
            )

    swings.sort(key=lambda s: s.index)
    return swings


def compute_market_structure(df: pd.DataFrame, swings: List[SwingPoint]) -> List[StructureEvent]:
    """Swing noktalarindan BOS/CHoCH olay dizisini ve trend durumunu cikarir.

    Kural:
      - Kapanis, en son onaylanmis swing high'in ustunde kapanirsa yukari kirilim.
        Trend zaten yukariysa BOS (devam), asagi/tanimsizsa CHoCH (yon degisimi).
      - Kapanis, en son onaylanmis swing low'un altinda kapanirsa asagi kirilim.
        Trend zaten asagiysa BOS (devam), yukari/tanimsizsa CHoCH (yon degisimi).
    Her swing sadece bir kez kirilim tetikleyebilir.
    """
    close = df["close"].to_numpy()
    n = len(df)

    swings_by_confirm = sorted(swings, key=lambda s: s.confirmed_index)
    si = 0
    known_high: Optional[SwingPoint] = None
    known_low: Optional[SwingPoint] = None
    broken_high_idx: Optional[int] = None
    broken_low_idx: Optional[int] = None

    trend: Optional[Direction] = None
    events: List[StructureEvent] = []

    for i in range(n):
        while si < len(swings_by_confirm) and swings_by_confirm[si].confirmed_index <= i:
            sw = swings_by_confirm[si]
            if sw.kind == SwingType.HIGH:
                if known_high is None or sw.index > known_high.index:
                    known_high = sw
            else:
                if known_low is None or sw.index > known_low.index:
                    known_low = sw
            si += 1

        if known_high is not None and known_high.index != broken_high_idx:
            if close[i] > known_high.price:
                kind = "CHoCH" if trend == Direction.BEARISH else "BOS"
                events.append(
                    StructureEvent(
                        index=i,
                        timestamp=df.index[i],
                        kind=kind,
                        direction=Direction.BULLISH,
                        broken_level=known_high.price,
                        trend_after=Direction.BULLISH,
                    )
                )
                trend = Direction.BULLISH
                broken_high_idx = known_high.index

        if known_low is not None and known_low.index != broken_low_idx:
            if close[i] < known_low.price:
                kind = "CHoCH" if trend == Direction.BULLISH else "BOS"
                events.append(
                    StructureEvent(
                        index=i,
                        timestamp=df.index[i],
                        kind=kind,
                        direction=Direction.BEARISH,
                        broken_level=known_low.price,
                        trend_after=Direction.BEARISH,
                    )
                )
                trend = Direction.BEARISH
                broken_low_idx = known_low.index

    return events
