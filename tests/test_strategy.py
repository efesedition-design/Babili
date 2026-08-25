import pandas as pd

from babili.core.types import Direction
from babili.strategy.smc_strategy import SMCParams, generate_signal


def _zigzag_df(pivots, candles_per_leg=4, freq="15min"):
    rows = []
    price = pivots[0]
    for target in pivots[1:]:
        step = (target - price) / candles_per_leg
        for _ in range(candles_per_leg):
            o = price
            c = price + step
            h = max(o, c) + abs(step) * 0.05
            l = min(o, c) - abs(step) * 0.05
            rows.append((o, h, l, c))
            price = c
    idx = pd.date_range("2024-01-01", periods=len(rows), freq=freq, tz="UTC")
    df = pd.DataFrame(rows, columns=["open", "high", "low", "close"], index=idx)
    return df


# Downtrend (bearish structure), then a sweep of the last low and a sharp
# rally that closes back above the most recent swing high -> bullish CHoCH
# with an order block low in the leg's discount zone.
DOWN_THEN_REVERSAL_PIVOTS = [100, 92, 96, 84, 88, 74, 95]


def test_generate_signal_detects_bullish_reversal():
    ltf_df = _zigzag_df(DOWN_THEN_REVERSAL_PIVOTS, candles_per_leg=4)
    htf_df = _zigzag_df(DOWN_THEN_REVERSAL_PIVOTS, candles_per_leg=4, freq="4h")

    params = SMCParams(min_risk_reward=1.5, require_discount_premium=False)
    signal = generate_signal(htf_df, ltf_df, params)

    assert signal is not None
    assert signal.direction == Direction.BULLISH
    assert signal.stop_loss < signal.entry < signal.take_profit
    assert signal.risk_reward >= params.min_risk_reward


def test_generate_signal_none_without_htf_bias():
    flat_pivots = [100, 100.1, 100.0, 100.1, 100.0]
    ltf_df = _zigzag_df(DOWN_THEN_REVERSAL_PIVOTS, candles_per_leg=4)
    htf_df = _zigzag_df(flat_pivots, candles_per_leg=4, freq="4h")

    signal = generate_signal(htf_df, ltf_df, SMCParams())
    assert signal is None
