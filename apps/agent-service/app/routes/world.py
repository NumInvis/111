from fastapi import APIRouter, HTTPException

from app.agents.world_generator import generate_world
from app.dependencies import get_settings
from app.safety.pipeline import check_input_safety, check_output_safety
from app.schemas.models import GenerationPreferences, WorldBlueprint

router = APIRouter()


@router.post("/generate", response_model=WorldBlueprint)
async def generate_world_blueprint(preferences: GenerationPreferences):
    safety_result = check_input_safety(preferences.theme)
    if not safety_result.safe:
        raise HTTPException(status_code=400, detail=safety_result.errors)

    settings = get_settings()
    try:
        blueprint = await generate_world(preferences, settings)
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))

    output_safety = check_output_safety(blueprint.model_dump())
    if not output_safety.safe:
        raise HTTPException(status_code=422, detail=output_safety.errors)

    return blueprint