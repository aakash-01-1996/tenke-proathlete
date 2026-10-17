"""Generates AI-suggested workout and nutrition plans via the Claude API.

Output is never final: everything produced here is persisted as a pending
draft (see api/routes/ai_plans.py) and only takes effect once a coach
reviews, optionally edits, and approves it.
"""
import json
from typing import List, Optional

import anthropic
from pydantic import BaseModel

from core.config import settings

_client: Optional[anthropic.Anthropic] = None


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    return _client


MODEL = "claude-sonnet-5"


class AIGenerationError(Exception):
    """Raised whenever a usable plan could not be produced. Callers persist
    the request with status=failed and this message rather than raising further."""


# ── Structured output schemas ────────────────────────────────────────────────

class WorkoutExerciseOut(BaseModel):
    name: str
    sets: Optional[int] = None
    reps: Optional[int] = None
    duration: Optional[str] = None
    is_rest: bool = False
    rest_seconds: Optional[int] = None
    rationale: Optional[str] = None


class WorkoutDayOut(BaseModel):
    day_number: int
    label: str
    exercises: List[WorkoutExerciseOut]


class WorkoutPlanOut(BaseModel):
    days: List[WorkoutDayOut]


class NutritionMealOut(BaseModel):
    meal_order: int
    label: str
    food_items: str
    calories: Optional[int] = None
    protein_g: Optional[int] = None
    carbs_g: Optional[int] = None
    fat_g: Optional[int] = None
    notes: Optional[str] = None


class NutritionPlanOut(BaseModel):
    daily_calories: Optional[int] = None
    daily_protein_g: Optional[int] = None
    daily_carbs_g: Optional[int] = None
    daily_fat_g: Optional[int] = None
    summary_notes: Optional[str] = None
    meals: List[NutritionMealOut]


WORKOUT_SYSTEM_PROMPT = (
    "You are an athletic performance coach's assistant. Generate a realistic, safe "
    "weekly workout plan tailored to the athlete's goals, experience level, equipment "
    "access, and any injuries noted. The plan is a RECOMMENDATION only — a human coach "
    "will review and may edit it before the athlete ever sees it, so favor sound, "
    "conventional programming over novelty. Match the number of days to the athlete's "
    "stated sessions-per-week preference when given. Respect injury notes by avoiding "
    "or substituting contraindicated movements. Keep exercise volumes (sets/reps/rest) "
    "realistic for the stated experience level."
)

NUTRITION_SYSTEM_PROMPT = (
    "You are a sports nutrition assistant. Generate a realistic daily meal plan and "
    "macro targets tailored to the athlete's goals, weight, activity level, dietary "
    "preferences, and allergies. The plan is a RECOMMENDATION only — a human coach will "
    "review and may edit it before the athlete ever sees it. Never suggest extreme "
    "caloric deficits/surpluses or disordered-eating patterns; keep macro targets within "
    "generally accepted sports-nutrition ranges. Strictly avoid any food in the athlete's "
    "stated allergies and respect stated dietary preferences."
)


def _build_context(member, profile, recent_metrics) -> str:
    lines = [
        f"Athlete: {member.first_name} {member.last_name}",
        f"Age: {member.age or 'unknown'}",
        f"Weight: {member.weight or 'unknown'}",
        f"Height: {member.height or 'unknown'}",
        f"Current training days: {member.training_days or 'none set'}",
        f"Stated training goal (free text): {member.training_goal or 'none'}",
    ]
    if profile:
        lines += [
            f"Primary goal: {profile.primary_goal or 'unspecified'}",
            f"Secondary goals: {profile.secondary_goals or 'none'}",
            f"Preferred workout style: {profile.workout_style or 'unspecified'}",
            f"Experience level: {profile.experience_level or 'unspecified'}",
            f"Target weight: {profile.target_weight or 'unspecified'}",
            f"Preferred sessions per week: {profile.sessions_per_week_pref or 'unspecified'}",
            f"Equipment access: {profile.equipment_access or 'unspecified'}",
            f"Injury notes: {profile.injury_notes or 'none'}",
            f"Dietary preferences: {profile.dietary_preferences or 'none'}",
            f"Allergies: {profile.allergies or 'none'}",
            f"Daily calorie target (athlete-stated): {profile.daily_calorie_target or 'unspecified'}",
            f"Additional notes: {profile.notes or 'none'}",
        ]
    if recent_metrics:
        lines.append("Recent performance metrics (most recent first):")
        for m in recent_metrics:
            lines.append(
                f"  - {m.recorded_at}: 10yd fly={m.fly_10yd}, game speed={m.game_speed}mph, "
                f"vertical={m.vertical}in, broad jump={m.broad_jump}in, overall progress={m.overall_progress}"
            )
    return "\n".join(lines)


def _call_claude(system_prompt: str, context: str, schema: dict):
    client = _get_client()
    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=4096,
            thinking={"type": "disabled"},
            output_config={"effort": "high", "format": {"type": "json_schema", "schema": schema}},
            system=system_prompt,
            messages=[{"role": "user", "content": context}],
        )
    except anthropic.APIConnectionError as e:
        raise AIGenerationError(f"Network error contacting Claude: {e}") from e
    except anthropic.RateLimitError as e:
        raise AIGenerationError("Claude rate-limited; please try again shortly.") from e
    except anthropic.APIStatusError as e:
        raise AIGenerationError(f"Claude API error ({e.status_code}): {e.message}") from e

    if response.stop_reason == "refusal":
        raise AIGenerationError("Claude declined to generate this plan.")
    if response.stop_reason == "max_tokens":
        raise AIGenerationError("Response truncated — plan too large; try again.")

    try:
        text = next(b.text for b in response.content if b.type == "text")
        return json.loads(text), response
    except (StopIteration, json.JSONDecodeError) as e:
        raise AIGenerationError(f"Malformed plan returned by Claude: {e}") from e


def generate_workout_plan(member, profile, recent_metrics) -> "tuple[WorkoutPlanOut, str, str]":
    """Returns (parsed plan, model used, raw response json) or raises AIGenerationError."""
    context = _build_context(member, profile, recent_metrics)
    schema = WorkoutPlanOut.model_json_schema()
    data, response = _call_claude(WORKOUT_SYSTEM_PROMPT, context, schema)
    try:
        plan = WorkoutPlanOut.model_validate(data)
    except Exception as e:
        raise AIGenerationError(f"Plan failed validation: {e}") from e
    return plan, MODEL, json.dumps(data)


def generate_nutrition_plan(member, profile, recent_metrics) -> "tuple[NutritionPlanOut, str, str]":
    context = _build_context(member, profile, recent_metrics)
    schema = NutritionPlanOut.model_json_schema()
    data, response = _call_claude(NUTRITION_SYSTEM_PROMPT, context, schema)
    try:
        plan = NutritionPlanOut.model_validate(data)
    except Exception as e:
        raise AIGenerationError(f"Plan failed validation: {e}") from e
    return plan, MODEL, json.dumps(data)
