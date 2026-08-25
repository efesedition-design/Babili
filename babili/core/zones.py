"""Premium / Discount / Equilibrium ve OTE (Optimal Trade Entry) bolgeleri."""

from __future__ import annotations

from typing import Dict, Tuple


def premium_discount_zone(leg_low: float, leg_high: float) -> Dict[str, Tuple[float, float] | float]:
    """Bir yapisal bacagin (swing low -> swing high) premium/discount bolgelerini
    ve %61.8-%79 OTE (Optimal Trade Entry) araligini hesaplar.

    - discount: [leg_low, equilibrium]  -> longlar icin tercih edilen bolge
    - premium:  [equilibrium, leg_high] -> shortlar icin tercih edilen bolge
    """
    if leg_high <= leg_low:
        raise ValueError("leg_high, leg_low degerinden buyuk olmalidir")

    eq = (leg_low + leg_high) / 2
    rng = leg_high - leg_low

    return {
        "equilibrium": eq,
        "discount": (leg_low, eq),
        "premium": (eq, leg_high),
        "ote_bullish": (leg_low + 0.618 * rng, leg_low + 0.79 * rng),
        "ote_bearish": (leg_high - 0.79 * rng, leg_high - 0.618 * rng),
    }
