"""Ileri bakis (lookahead) icermeyen, bar-bar ilerleyen SMC backtest motoru.

Her LTF mumunda, o ana kadar bilinen veriyle (HTF icin sadece kapanmis mumlar,
LTF icin son `ltf_lookback` mum) strateji yeniden calistirilir. Uretilen sinyal
"bekleyen emir" (pending limit order) olarak kaydedilir; fiyat giris seviyesine
dokunursa islem acilir, stop seviyesine once dokunursa iptal edilir. Ayni anda
tek islem yonetilir (basitlik icin).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional, Set, Tuple

import pandas as pd

from ..core.types import Direction, Signal
from ..strategy.smc_strategy import SMCParams, generate_signal


@dataclass
class Trade:
    signal: Signal
    status: str = "pending"  # pending | filled | cancelled | win | loss
    fill_index: Optional[int] = None
    fill_price: Optional[float] = None
    exit_index: Optional[int] = None
    exit_price: Optional[float] = None
    r_multiple: Optional[float] = None


class Backtester:
    def __init__(
        self,
        htf_df: pd.DataFrame,
        ltf_df: pd.DataFrame,
        params: Optional[SMCParams] = None,
        htf_lookback: int = 200,
        ltf_lookback: int = 300,
        pending_timeout_bars: int = 60,
        risk_pct: float = 0.01,
        initial_balance: float = 10_000.0,
    ):
        if len(htf_df) < 2 or len(ltf_df) < 2:
            raise ValueError("HTF ve LTF veri setleri en az 2 mum icermeli")

        self.htf_df = htf_df
        self.ltf_df = ltf_df
        self.params = params or SMCParams()
        self.htf_lookback = htf_lookback
        self.ltf_lookback = ltf_lookback
        self.pending_timeout_bars = pending_timeout_bars
        self.risk_pct = risk_pct
        self.initial_balance = initial_balance

        self.htf_interval = htf_df.index[1] - htf_df.index[0]
        self._htf_close_times = htf_df.index + self.htf_interval

    def _htf_slice_up_to(self, ts) -> pd.DataFrame:
        pos = self._htf_close_times.searchsorted(ts, side="right")
        start = max(0, pos - self.htf_lookback)
        return self.htf_df.iloc[start:pos]

    def run(self) -> Tuple[List[Trade], List[float]]:
        trades: List[Trade] = []
        equity_curve: List[float] = [self.initial_balance]
        balance = self.initial_balance

        pending: Optional[Trade] = None
        pending_since = 0
        active: Optional[Trade] = None
        used_signal_timestamps: Set[object] = set()

        min_start = max(
            self.params.htf_swing_left + self.params.htf_swing_right,
            self.params.ltf_swing_left + self.params.ltf_swing_right,
        ) + 5

        highs = self.ltf_df["high"].to_numpy()
        lows = self.ltf_df["low"].to_numpy()

        for i in range(min_start, len(self.ltf_df)):
            ts = self.ltf_df.index[i]
            high_i = highs[i]
            low_i = lows[i]

            if active is not None:
                sig = active.signal
                if sig.direction == Direction.BULLISH:
                    hit_sl = low_i <= sig.stop_loss
                    hit_tp = high_i >= sig.take_profit
                else:
                    hit_sl = high_i >= sig.stop_loss
                    hit_tp = low_i <= sig.take_profit

                # Ayni mumda hem SL hem TP tetiklenirse muhafazakar varsayimla
                # stop'un once vuruldugu kabul edilir (worst-case backtest).
                if hit_sl:
                    active.status = "loss"
                    active.exit_index = i
                    active.exit_price = sig.stop_loss
                    active.r_multiple = -1.0
                elif hit_tp:
                    active.status = "win"
                    active.exit_index = i
                    active.exit_price = sig.take_profit
                    active.r_multiple = sig.risk_reward

                if active.status in ("win", "loss"):
                    balance *= 1 + active.r_multiple * self.risk_pct
                    equity_curve.append(balance)
                    trades.append(active)
                    active = None
                continue

            if pending is not None:
                sig = pending.signal
                if sig.direction == Direction.BULLISH:
                    filled = high_i >= sig.entry
                    invalidated = low_i <= sig.stop_loss
                else:
                    filled = low_i <= sig.entry
                    invalidated = high_i >= sig.stop_loss

                # Limit emrin, ayni mumda stop seviyesinden once dolduğu varsayilir
                # (fiyat girisin oldugu yonden zaten yaklasiyor olmali).
                if filled:
                    pending.status = "filled"
                    pending.fill_index = i
                    pending.fill_price = sig.entry
                    active = pending
                    pending = None
                elif invalidated:
                    pending.status = "cancelled"
                    trades.append(pending)
                    pending = None
                elif i - pending_since > self.pending_timeout_bars:
                    pending.status = "cancelled"
                    trades.append(pending)
                    pending = None
                continue

            htf_slice = self._htf_slice_up_to(ts)
            ltf_slice = self.ltf_df.iloc[max(0, i - self.ltf_lookback) : i + 1]
            if len(htf_slice) < 5 or len(ltf_slice) < 5:
                continue

            sig = generate_signal(htf_slice, ltf_slice, self.params)
            if sig is not None and sig.timestamp not in used_signal_timestamps:
                used_signal_timestamps.add(sig.timestamp)
                pending = Trade(signal=sig)
                pending_since = i

        return trades, equity_curve
