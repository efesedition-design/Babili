"""Backtest sonuclarindan performans metrikleri hesaplama."""

from __future__ import annotations

from typing import Dict, List

from .engine import Trade


def compute_metrics(trades: List[Trade], equity_curve: List[float], initial_balance: float) -> Dict[str, float]:
    closed = [t for t in trades if t.status in ("win", "loss")]
    n = len(closed)
    if n == 0:
        return {"trades": 0}

    wins = [t for t in closed if t.status == "win"]
    losses = [t for t in closed if t.status == "loss"]

    win_rate = len(wins) / n
    avg_r = sum(t.r_multiple for t in closed) / n
    gross_profit = sum(t.r_multiple for t in wins)
    gross_loss = -sum(t.r_multiple for t in losses)
    profit_factor = (gross_profit / gross_loss) if gross_loss > 0 else float("inf")

    peak = equity_curve[0]
    max_dd = 0.0
    for eq in equity_curve:
        peak = max(peak, eq)
        if peak > 0:
            max_dd = max(max_dd, (peak - eq) / peak)

    return {
        "trades": n,
        "wins": len(wins),
        "losses": len(losses),
        "win_rate": win_rate,
        "avg_r_multiple": avg_r,
        "profit_factor": profit_factor,
        "max_drawdown_pct": max_dd,
        "final_balance": equity_curve[-1],
        "initial_balance": initial_balance,
    }
