"""Pozisyon buyuklugu ve risk hesaplamalari."""

from __future__ import annotations


def position_size(balance: float, risk_pct: float, entry: float, stop_loss: float) -> float:
    """Hesap bakiyesinin `risk_pct` kadarini riske atacak sekilde pozisyon
    buyuklugunu (islem gorecek varlik miktari) hesaplar."""
    risk_amount = balance * risk_pct
    per_unit_risk = abs(entry - stop_loss)
    if per_unit_risk <= 0:
        return 0.0
    return risk_amount / per_unit_risk


def take_profit_from_rr(entry: float, stop_loss: float, risk_reward: float, direction: str) -> float:
    """Sabit bir risk/odul oranina gore take-profit seviyesi hesaplar."""
    risk = abs(entry - stop_loss)
    if direction == "bullish":
        return entry + risk * risk_reward
    return entry - risk * risk_reward
