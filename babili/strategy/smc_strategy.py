"""Smart Money Concept (SMC) stratejisi: HTF bias + LTF CHoCH + Order Block giris.

Mantik:
  1. Ust zaman diliminde (HTF) piyasa yapisi analiz edilir, en son BOS/CHoCH'un
     yon verdigi trend "bias" olarak alinir.
  2. Alt zaman diliminde (LTF) bias yonu ile uyumlu en guncel CHoCH (yon degisimi)
     aranir; bu, kurumsal oyuncularin yon verdigi noktadir.
  3. CHoCH'u yaratan hareketin basindaki order block bulunur.
  4. Order block, o bacagin discount (long icin) / premium (short icin) bolgesinde
     degilse sinyal reddedilir (dusuk kaliteli, pahali/ucuz olmayan girisleri eler).
  5. Giris = order block siniri, stop = order block disinda tampon payli,
     kar al = sabit risk/odul carpani ile hesaplanir.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import pandas as pd

from ..core.order_blocks import find_order_blocks
from ..core.structure import compute_market_structure, detect_swings
from ..core.types import Direction, Signal
from ..core.zones import premium_discount_zone


@dataclass
class SMCParams:
    htf_swing_left: int = 2
    htf_swing_right: int = 2
    ltf_swing_left: int = 2
    ltf_swing_right: int = 2
    min_risk_reward: float = 2.0
    ob_buffer_pct: float = 0.0005
    zone_lookback: int = 20
    require_discount_premium: bool = True
    max_ob_lookback: int = 15


def htf_bias(htf_df: pd.DataFrame, params: SMCParams) -> Optional[Direction]:
    """Ust zaman diliminde en son yapisal olayin yon verdigi trendi dondurur."""
    if len(htf_df) < params.htf_swing_left + params.htf_swing_right + 3:
        return None
    swings = detect_swings(htf_df, params.htf_swing_left, params.htf_swing_right)
    events = compute_market_structure(htf_df, swings)
    if not events:
        return None
    return events[-1].trend_after


def generate_signal(
    htf_df: pd.DataFrame,
    ltf_df: pd.DataFrame,
    params: Optional[SMCParams] = None,
) -> Optional[Signal]:
    """Verilen HTF/LTF veri kesitlerinden (yalnizca o ana kadarki mumlardan) bir
    SMC sinyali uretmeye calisir. Sinyal kriterlerini karsilayan kurulum yoksa None doner."""
    params = params or SMCParams()

    bias = htf_bias(htf_df, params)
    if bias is None:
        return None

    if len(ltf_df) < params.ltf_swing_left + params.ltf_swing_right + 3:
        return None

    ltf_swings = detect_swings(ltf_df, params.ltf_swing_left, params.ltf_swing_right)
    ltf_events = compute_market_structure(ltf_df, ltf_swings)

    choch = None
    for ev in reversed(ltf_events):
        if ev.kind == "CHoCH" and ev.direction == bias:
            choch = ev
            break
    if choch is None:
        return None

    obs = find_order_blocks(ltf_df, [choch], max_lookback=params.max_ob_lookback)
    if not obs:
        return None
    ob = obs[0]

    lookback_start = max(0, ob.start_index - params.zone_lookback)
    leg_slice = ltf_df.iloc[lookback_start : choch.index + 1]
    leg_high = float(leg_slice["high"].max())
    leg_low = float(leg_slice["low"].min())
    if leg_high <= leg_low:
        return None
    zones = premium_discount_zone(leg_low, leg_high)

    if params.require_discount_premium:
        ob_mid = (ob.high + ob.low) / 2
        if bias == Direction.BULLISH and ob_mid > zones["equilibrium"]:
            return None
        if bias == Direction.BEARISH and ob_mid < zones["equilibrium"]:
            return None

    if bias == Direction.BULLISH:
        entry = ob.high
        stop_loss = ob.low * (1 - params.ob_buffer_pct)
        if stop_loss >= entry:
            return None
        take_profit = entry + (entry - stop_loss) * params.min_risk_reward
    else:
        entry = ob.low
        stop_loss = ob.high * (1 + params.ob_buffer_pct)
        if stop_loss <= entry:
            return None
        take_profit = entry - (stop_loss - entry) * params.min_risk_reward

    risk = abs(entry - stop_loss)
    reward = abs(take_profit - entry)
    rr = reward / risk if risk > 0 else 0.0

    return Signal(
        timestamp=ltf_df.index[choch.index],
        direction=bias,
        entry=float(entry),
        stop_loss=float(stop_loss),
        take_profit=float(take_profit),
        risk_reward=float(rr),
        htf_bias=bias,
        order_block=ob,
        fvg=None,
        reason=(
            f"HTF bias {bias.value}, LTF {choch.kind} ile teyit edildi; "
            f"giris order block'tan ({ob.direction.value}) yapiliyor."
        ),
    )
