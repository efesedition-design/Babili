import pandas as pd

from babili.core.liquidity import detect_sweep, find_liquidity_pools
from babili.core.types import SwingPoint, SwingType


def test_find_liquidity_pools_clusters_equal_highs():
    swings = [
        SwingPoint(index=0, confirmed_index=1, timestamp=0, price=100.0, kind=SwingType.HIGH),
        SwingPoint(index=5, confirmed_index=6, timestamp=5, price=100.05, kind=SwingType.HIGH),
        SwingPoint(index=10, confirmed_index=11, timestamp=10, price=90.0, kind=SwingType.LOW),
    ]
    pools = find_liquidity_pools(swings, tolerance=0.01)

    high_pools = [p for p in pools if p.kind == SwingType.HIGH]
    low_pools = [p for p in pools if p.kind == SwingType.LOW]

    assert len(high_pools) == 1
    assert set(high_pools[0].swing_indices) == {0, 5}
    assert len(low_pools) == 1


def test_detect_sweep_finds_wick_through_and_close_back_inside():
    idx = pd.date_range("2024-01-01", periods=5, freq="1h", tz="UTC")
    df = pd.DataFrame(
        {
            "open": [99, 99.5, 100.2, 99.8, 99.5],
            "high": [99.5, 100.0, 100.5, 100.0, 99.8],
            "low": [98.5, 99.0, 99.9, 99.3, 99.0],
            "close": [99.3, 99.8, 99.9, 99.6, 99.4],
        },
        index=idx,
    )
    pool = find_liquidity_pools(
        [SwingPoint(index=0, confirmed_index=0, timestamp=idx[0], price=100.0, kind=SwingType.HIGH)]
    )[0]

    swept_at = detect_sweep(df, pool)
    assert swept_at == 2
