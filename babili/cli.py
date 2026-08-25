"""Babili SMC sistemi komut satiri araci.

Kullanim:
    python -m babili.cli signal --symbol BTCUSDT --htf 4h --ltf 15m
    python -m babili.cli backtest --symbol BTCUSDT --htf 4h --ltf 15m --days 90
"""

from __future__ import annotations

import argparse
from datetime import datetime, timedelta, timezone

from .backtest.engine import Backtester
from .backtest.metrics import compute_metrics
from .data.binance_client import fetch_klines
from .strategy.smc_strategy import SMCParams, generate_signal


def _default_start(days: int) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=days)


def cmd_signal(args: argparse.Namespace) -> int:
    start = args.start or _default_start(args.days)
    htf_df = fetch_klines(args.symbol, args.htf, start=start)
    ltf_df = fetch_klines(args.symbol, args.ltf, start=start)
    if htf_df.empty or ltf_df.empty:
        print("Yeterli veri alinamadi.")
        return 1

    params = SMCParams(min_risk_reward=args.min_rr)
    signal = generate_signal(htf_df, ltf_df, params)

    if signal is None:
        print(f"{args.symbol} icin su an gecerli bir SMC sinyali yok (HTF={args.htf}, LTF={args.ltf}).")
        return 0

    print(f"Sembol       : {args.symbol}")
    print(f"Yon          : {signal.direction.value.upper()}")
    print(f"HTF bias     : {signal.htf_bias.value}")
    print(f"Zaman        : {signal.timestamp}")
    print(f"Giris        : {signal.entry:.6f}")
    print(f"Stop Loss    : {signal.stop_loss:.6f}")
    print(f"Take Profit  : {signal.take_profit:.6f}")
    print(f"Risk/Odul    : {signal.risk_reward:.2f}")
    print(f"Sebep        : {signal.reason}")
    return 0


def cmd_backtest(args: argparse.Namespace) -> int:
    start = args.start or _default_start(args.days)
    htf_df = fetch_klines(args.symbol, args.htf, start=start)
    ltf_df = fetch_klines(args.symbol, args.ltf, start=start)
    if htf_df.empty or ltf_df.empty:
        print("Yeterli veri alinamadi.")
        return 1

    params = SMCParams(min_risk_reward=args.min_rr)
    bt = Backtester(
        htf_df,
        ltf_df,
        params=params,
        risk_pct=args.risk_pct,
        initial_balance=args.balance,
    )
    trades, equity_curve = bt.run()
    metrics = compute_metrics(trades, equity_curve, args.balance)

    print(f"Sembol            : {args.symbol}")
    print(f"Periyot           : {ltf_df.index[0]} -> {ltf_df.index[-1]}")
    print(f"Toplam islem      : {metrics.get('trades', 0)}")
    if metrics.get("trades", 0):
        print(f"Kazanma orani     : {metrics['win_rate'] * 100:.1f}%")
        print(f"Ortalama R        : {metrics['avg_r_multiple']:.2f}")
        print(f"Profit factor     : {metrics['profit_factor']:.2f}")
        print(f"Maks. drawdown    : {metrics['max_drawdown_pct'] * 100:.1f}%")
        print(f"Baslangic bakiye  : {metrics['initial_balance']:.2f}")
        print(f"Son bakiye        : {metrics['final_balance']:.2f}")
    else:
        print("Bu periyotta hicbir islem tetiklenmedi.")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="babili", description="Smart Money Concept (SMC) pozisyon sistemi")
    sub = parser.add_subparsers(dest="command", required=True)

    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--symbol", default="BTCUSDT", help="Binance sembolu (orn. BTCUSDT)")
    common.add_argument("--htf", default="4h", help="Ust zaman dilimi (bias icin, orn. 4h)")
    common.add_argument("--ltf", default="15m", help="Alt zaman dilimi (giris icin, orn. 15m)")
    common.add_argument("--days", type=int, default=30, help="Kac gunluk veri cekilsin")
    common.add_argument("--start", default=None, help="Baslangic tarihi (ISO, orn. 2024-01-01)")
    common.add_argument("--min-rr", type=float, default=2.0, dest="min_rr", help="Minimum risk/odul orani")

    p_signal = sub.add_parser("signal", parents=[common], help="Guncel SMC sinyalini uret")
    p_signal.set_defaults(func=cmd_signal)

    p_bt = sub.add_parser("backtest", parents=[common], help="Gecmis veri uzerinde backtest calistir")
    p_bt.add_argument("--risk-pct", type=float, default=0.01, dest="risk_pct", help="Islem basina risk yuzdesi")
    p_bt.add_argument("--balance", type=float, default=10_000.0, help="Baslangic bakiyesi")
    p_bt.set_defaults(func=cmd_backtest)

    return parser


def main(argv=None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
