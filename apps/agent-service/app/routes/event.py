from fastapi import APIRouter, HTTPException

from app.agents.event_agent import generate_event
from app.dependencies import get_settings
from app.safety.pipeline import check_input_safety, check_output_safety
from app.schemas.models import EventGenerationRequest, EventSeed

router = APIRouter()


@router.post("/generate", response_model=EventSeed)
async def generate_event_seed(request: EventGenerationRequest):
    safety_result = check_input_safety(str(request.player_state))
    if not safety_result.safe:
        raise HTTPException(status_code=400, detail=safety_result.errors)

    settings = get_settings()
    try:
        event = await generate_event(request, settings)
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))

    output_safety = check_output_safety(event.model_dump())
    if not output_safety.safe:
        raise HTTPException(status_code=422, detail=output_safety.errors)

    return event