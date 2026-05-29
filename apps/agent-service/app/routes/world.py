from fastapi import APIRouter, HTTPException

from app.agents.world_generator import generate_world
from app.dependencies import get_settings
from app.safety.pipeline import check_input_safety, full_output_check
from app.schemas.models import WorldBlueprint

router = APIRouter()


@router.post("/generate", response_model=WorldBlueprint)
async def generate_world_blueprint():
    settings = get_settings()
    try:
        blueprint = await generate_world(settings)
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))

    WORLD_BLUEPRINT_ALLOWED_FIELDS = {
        "worldProfile", "attributeDefs", "advancementRules", "startingState",
        "factions", "locations", "npcs", "rumors",
        "clues", "events", "endingCandidates", "powerSystem",
    }

    output_safety = full_output_check(blueprint.model_dump(by_alias=True), WORLD_BLUEPRINT_ALLOWED_FIELDS)
    if not output_safety.safe:
        raise HTTPException(status_code=422, detail=output_safety.errors)

    return blueprint
