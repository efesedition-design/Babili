import pandas as pd

from babili.core.order_blocks import find_order_blocks, mark_mitigated
from babili.core.structure import compute_market_structure, detect_swings
from babili.core.types import Direction


def _make_df():
    highs = [10.2, 10.5, 10.6, 10.3, 10.1, 10.0, 10.4, 10.9]
    lows = [9.8, 10.0, 10.1, 9.9, 9.6, 9.5, 9.8, 10.3]
    opens = [10.0, 10.1, 10.4, 10.2, 9.9, 9.6, 9.9, 10.4]
    closes = [10.1, 10.4, 10.2, 9.95, 9.7, 9.55, 10.3, 10.8]
    idx = pd.date_range("2024-01-01", periods=len(highs), freq="1h", tz="UTC")
    return pd.DataFrame({"open": opens, "high": highs, "low": lows, "close": closes}, index=idx)


def test_find_order_blocks_locates_last_opposite_candle():
    df = _make_df()
    swings = detect_swings(df, left=1, right=1)
    events = compute_market_structure(df, swings)

    obs = find_order_blocks(df, events)

    assert len(obs) == 1
    ob = obs[0]
    assert ob.direction == Direction.BULLISH
    assert ob.start_index == 5
    assert ob.end_index == 7
    assert ob.high == 10.0
    assert ob.low == 9.5


def test_mark_mitigated_flags_return_into_zone():
    df = _make_df()
    swings = detect_swings(df, left=1, right=1)
    events = compute_market_structure(df, swings)
    obs = find_order_blocks(df, events)

    mitigated = mark_mitigated(obs, df)
    # Price never returns into the [9.5, 10.0] zone after index 7 in this dataset.
    assert mitigated[0].mitigated is False
