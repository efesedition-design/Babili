import pandas as pd

from babili.core.fvg import find_fair_value_gaps
from babili.core.types import Direction


def _df(highs, lows):
    opens = highs  # exact OHLC not relevant for the gap check itself
    closes = lows
    idx = pd.date_range("2024-01-01", periods=len(highs), freq="1h", tz="UTC")
    return pd.DataFrame({"open": opens, "high": highs, "low": lows, "close": closes}, index=idx)


def test_bullish_fair_value_gap_detected():
    df = _df(highs=[10.0, 10.2, 10.8], lows=[9.8, 10.05, 10.5])
    gaps = find_fair_value_gaps(df)

    assert len(gaps) == 1
    g = gaps[0]
    assert g.index == 1
    assert g.direction == Direction.BULLISH
    assert g.top == 10.5
    assert g.bottom == 10.0


def test_bearish_fair_value_gap_detected():
    df = _df(highs=[10.8, 10.6, 10.0], lows=[10.5, 10.3, 9.6])
    gaps = find_fair_value_gaps(df)

    assert len(gaps) == 1
    g = gaps[0]
    assert g.index == 1
    assert g.direction == Direction.BEARISH
    assert g.top == 10.5
    assert g.bottom == 10.0


def test_no_gap_when_candles_overlap():
    df = _df(highs=[10.0, 10.1, 10.2], lows=[9.9, 9.95, 10.0])
    gaps = find_fair_value_gaps(df)
    assert gaps == []
