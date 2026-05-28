from fastapi import APIRouter, HTTPException

from app.agents.npc_agent import generate_npc_dialogue
from app.dependencies import get_settings
from app.safety.pipeline import check_input_safety, check_output_safety
from app.schemas.models import NpcDialogueOutput, NpcDialogueRequest

router = APIRouter()


@router.post("/dialogue", response_model=NpcDialogueOutput)
async def npc_dialogue(request: NpcDialogueRequest):
    safety_result = check_input_safety(request.player_input)
    if not safety_result.safe:
        raise HTTPException(status_code=400, detail=safety_result.errors)

    settings = get_settings()
    try:
        dialogue_output = await generate_npc_dialogue(request, settings)
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))

    output_safety = check_output_safety(dialogue_output.model_dump())
    if not output_safety.safe:
        raise HTTPException(status_code=422, detail=output_safety.errors)

    return dialogue_output