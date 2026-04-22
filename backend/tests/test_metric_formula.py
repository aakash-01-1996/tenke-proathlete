"""Unit tests for the overall_progress auto-calculation formula."""

from api.routes.metrics import _compute_overall


def test_all_metrics_elite():
    # Elite values should score near 100
    score = _compute_overall(fly_10yd=0.85, game_speed=23, vertical=42, broad_jump=132)
    assert score == 100


def test_all_metrics_beginner():
    # Floor values should score 0
    score = _compute_overall(fly_10yd=1.45, game_speed=12, vertical=12, broad_jump=60)
    assert score == 0


def test_all_metrics_average():
    # Mid-range should score around 50
    score = _compute_overall(fly_10yd=1.15, game_speed=17.5, vertical=27, broad_jump=96)
    assert 40 <= score <= 60


def test_missing_metrics_reweights():
    # Only fly_10yd provided — should still return a valid score (not None)
    score = _compute_overall(fly_10yd=1.15, game_speed=None, vertical=None, broad_jump=None)
    assert score is not None
    assert 0 <= score <= 100


def test_no_metrics_returns_none():
    score = _compute_overall(None, None, None, None)
    assert score is None


def test_clamped_above_range():
    # Better than elite should still cap at 100
    score = _compute_overall(fly_10yd=0.50, game_speed=30, vertical=60, broad_jump=200)
    assert score == 100


def test_clamped_below_range():
    # Worse than floor should still floor at 0
    score = _compute_overall(fly_10yd=2.0, game_speed=5, vertical=5, broad_jump=30)
    assert score == 0
