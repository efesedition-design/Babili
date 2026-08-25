"""Order block (kurumsal emir blogu) tespiti."""

from __future__ import annotations

from typing import List, Optional

import pandas as pd

from .types import Direction, OrderBlock, StructureEvent


def find_order_blocks(
    df: pd.DataFrame,
    structure_events: List[StructureEvent],
    max_lookback: int = 15,
) -> List[OrderBlock]:
    """Her BOS/CHoCH kirilimindan once, kirilimi yaratan hareketin baslangicindaki
    son ters yonlu (opposite-colored) mumu order block olarak isaretler.

    Bullish kirilim -> kirilimdan once son "dusus kapanan" mum (bullish order block).
    Bearish kirilim -> kirilimdan once son "yukselis kapanan" mum (bearish order block).
    """
    opens = df["open"].to_numpy()
    closes = df["close"].to_numpy()
    highs = df["high"].to_numpy()
    lows = df["low"].to_numpy()

    order_blocks: List[OrderBlock] = []

    for ev in structure_events:
        breakout_idx = ev.index
        j = breakout_idx
        steps = 0
        ob_index: Optional[int] = None

        if ev.direction == Direction.BULLISH:
            while j >= 0 and steps <= max_lookback:
                if closes[j] < opens[j]:
                    ob_index = j
                    break
                j -= 1
                steps += 1
        else:
            while j >= 0 and steps <= max_lookback:
                if closes[j] > opens[j]:
                    ob_index = j
                    break
                j -= 1
                steps += 1

        if ob_index is None:
            continue

        order_blocks.append(
            OrderBlock(
                start_index=ob_index,
                end_index=breakout_idx,
                timestamp=df.index[ob_index],
                direction=ev.direction,
                high=float(highs[ob_index]),
                low=float(lows[ob_index]),
            )
        )

    return order_blocks


def mark_mitigated(order_blocks: List[OrderBlock], df: pd.DataFrame) -> List[OrderBlock]:
    """Fiyat, order block bolgesine geri donup icine girdiginde mitigated=True isaretler."""
    from dataclasses import replace

    highs = df["high"].to_numpy()
    lows = df["low"].to_numpy()
    result: List[OrderBlock] = []

    for ob in order_blocks:
        mitigated = False
        mitigated_index = None
        for k in range(ob.end_index + 1, len(df)):
            if ob.direction == Direction.BULLISH and lows[k] <= ob.high:
                mitigated = True
                mitigated_index = k
                break
            if ob.direction == Direction.BEARISH and highs[k] >= ob.low:
                mitigated = True
                mitigated_index = k
                break
        result.append(replace(ob, mitigated=mitigated, mitigated_index=mitigated_index))

    return result
