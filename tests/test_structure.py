import pandas as pd

from babili.core.structure import compute_market_structure, detect_swings
from babili.core.types import Direction, SwingType


def _make_df():
    highs = [10.2, 10.5, 10.6, 10.3, 10.1, 10.0, 10.4, 10.9]
    lows = [9.8, 10.0, 10.1, 9.9, 9.6, 9.5, 9.8, 10.3]
    opens = [10.0, 10.1, 10.4, 10.2, 9.9, 9.6, 9.9, 10.4]
    closes = [10.1, 10.4, 10.2, 9.95, 9.7, 9.55, 10.3, 10.8]
    idx = pd.date_range("2024-01-01", periods=len(highs), freq="1h", tz="UTC")
    return pd.DataFrame({"open": opens, "high": highs, "low": lows, "close": closes}, index=idx)


def test_detect_swings_finds_expected_fractals():
    df = _make_df()
    swings = detect_swings(df, left=1, right=1)

    highs = [s for s in swings if s.kind == SwingType.HIGH]
    lows = [s for s in swings if s.kind == SwingType.LOW]

    assert len(highs) == 1
    assert highs[0].index == 2
    assert highs[0].price == 10.6
    assert highs[0].confirmed_index == 3

    assert len(lows) == 1
    assert lows[0].index == 5
    assert lows[0].price == 9.5
    assert lows[0].confirmed_index == 6


def test_compute_market_structure_detects_bullish_break():
    df = _make_df()
    swings = detect_swings(df, left=1, right=1)
    events = compute_market_structure(df, swings)

    assert len(events) == 1
    ev = events[0]
    assert ev.index == 7
    assert ev.kind == "BOS"
    assert ev.direction == Direction.BULLISH
    assert ev.trend_after == Direction.BULLISH
    assert ev.broken_level == 10.6


def test_no_swings_means_no_structure_events():
    df = _make_df().iloc[:3]
    swings = detect_swings(df, left=1, right=1)
    events = compute_market_structure(df, swings)
    assert events == []
