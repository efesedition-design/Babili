import pandas as pd

from babili.backtest.engine import Backtester
from babili.backtest.metrics import compute_metrics
from babili.strategy.smc_strategy import SMCParams


def _zigzag_ltf(pivots, candles_per_leg=20, freq="15min"):
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
    return pd.DataFrame(rows, columns=["open", "high", "low", "close"], index=idx)


def _derive_htf(ltf_df, freq="4h"):
    return (
        ltf_df.resample(freq)
        .agg({"open": "first", "high": "max", "low": "min", "close": "last"})
        .dropna()
    )


# A repeating zigzag cycle (down-trend, liquidity sweep, bullish CHoCH, and back)
# so the backtest sees several structural swings and both trade directions.
REPEATING_CYCLE_PIVOTS = [
    100, 92, 96, 84, 88, 74, 95,
    87, 91, 79, 83, 69, 90,
    82, 86, 74, 78, 64, 85,
] * 2


def test_backtester_runs_without_lookahead_and_produces_consistent_equity():
    ltf_df = _zigzag_ltf(REPEATING_CYCLE_PIVOTS, candles_per_leg=20)
    htf_df = _derive_htf(ltf_df)

    params = SMCParams(min_risk_reward=1.5, require_discount_premium=False)
    bt = Backtester(htf_df, ltf_df, params=params, risk_pct=0.01, initial_balance=10_000.0)
    trades, equity_curve = bt.run()

    assert equity_curve[0] == 10_000.0
    closed = [t for t in trades if t.status in ("win", "loss")]
    assert len(closed) > 0, "beklenen zigzag senaryosunda en az bir islem tetiklenmeli"

    balance = 10_000.0
    for t in closed:
        assert t.r_multiple is not None
        if t.status == "win":
            assert t.r_multiple > 0
        else:
            assert t.r_multiple == -1.0
        balance *= 1 + t.r_multiple * bt.risk_pct

    assert equity_curve[-1] == balance

    metrics = compute_metrics(trades, equity_curve, 10_000.0)
    assert 0.0 <= metrics["win_rate"] <= 1.0
    assert metrics["trades"] == len(closed)
    assert metrics["final_balance"] == equity_curve[-1]


def test_backtester_requires_at_least_two_candles():
    import pytest

    idx = pd.date_range("2024-01-01", periods=1, freq="1h", tz="UTC")
    tiny_df = pd.DataFrame({"open": [1], "high": [1], "low": [1], "close": [1]}, index=idx)
    with pytest.raises(ValueError):
        Backtester(tiny_df, tiny_df)
