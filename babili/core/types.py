"""Smart Money Concept (SMC) yapilari icin ortak veri tipleri."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Optional


class Direction(str, Enum):
    BULLISH = "bullish"
    BEARISH = "bearish"


class SwingType(str, Enum):
    HIGH = "high"
    LOW = "low"


@dataclass(frozen=True)
class SwingPoint:
    """Fraktal bazli bir swing high/low noktasi."""

    index: int
    confirmed_index: int
    timestamp: object
    price: float
    kind: SwingType


@dataclass(frozen=True)
class StructureEvent:
    """Bir BOS (Break of Structure) ya da CHoCH (Change of Character) olayi."""

    index: int
    timestamp: object
    kind: str  # "BOS" | "CHoCH"
    direction: Direction
    broken_level: float
    trend_after: Direction


@dataclass(frozen=True)
class OrderBlock:
    """Bir yapisal kirilimdan (BOS/CHoCH) once olusan son ters yonlu mum."""

    start_index: int
    end_index: int
    timestamp: object
    direction: Direction
    high: float
    low: float
    mitigated: bool = False
    mitigated_index: Optional[int] = None


@dataclass(frozen=True)
class FairValueGap:
    """3 mumluk fiyat dengesizligi (imbalance)."""

    index: int
    timestamp: object
    direction: Direction
    top: float
    bottom: float
    mitigated: bool = False
    mitigated_index: Optional[int] = None


@dataclass(frozen=True)
class LiquidityPool:
    """Esit/yakin swing high ya da low kumelerinden olusan likidite havuzu."""

    price: float
    kind: SwingType
    swing_indices: tuple
    swept: bool = False
    swept_index: Optional[int] = None


@dataclass(frozen=True)
class Signal:
    """Strateji tarafindan uretilen pozisyon sinyali."""

    timestamp: object
    direction: Direction
    entry: float
    stop_loss: float
    take_profit: float
    risk_reward: float
    htf_bias: Direction
    order_block: Optional[OrderBlock]
    fvg: Optional[FairValueGap]
    reason: str
