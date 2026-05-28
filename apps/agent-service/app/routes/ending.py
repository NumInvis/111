from fastapi import APIRouter, HTTPException

from app.agents.ending_director import generate_ending_candidate
from app.dependencies import get_settings
from app.safety.pipeline import check_input_safety, check_output_safety
from app.schemas.models import EndingCandidate, EndingGenerationRequest

router = APIRouter()


@router.post("/generate", response_model=EndingCandidate)
async def generate_ending(request: EndingGenerationRequest):
    safety_result = check_input_safety(request.journey_summary)
    if not safety_result.safe:
        raise HTTPException(status_code=400, detail=safety_result.errors)

    settings = get_settings()
    try:
        ending = await generate_ending_candidate(request, settings)
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))

    output_safety = check_output_safety(ending.model_dump())
    if not output_safety.safe:
        raise HTTPException(status_code=422, detail=output_safety.errors)

    return ending