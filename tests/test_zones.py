import pytest

from babili.core.zones import premium_discount_zone


def test_premium_discount_zone_basic():
    zones = premium_discount_zone(leg_low=100.0, leg_high=200.0)

    assert zones["equilibrium"] == 150.0
    assert zones["discount"] == (100.0, 150.0)
    assert zones["premium"] == (150.0, 200.0)
    assert zones["ote_bullish"] == (161.8, 179.0)
    assert zones["ote_bearish"] == (121.0, 138.2)


def test_premium_discount_zone_rejects_invalid_range():
    with pytest.raises(ValueError):
        premium_discount_zone(leg_low=200.0, leg_high=100.0)
