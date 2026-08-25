"""AI 规格建议：只生成并校验规格建议，不创建或保存数据集。"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..ai.provider import (
    AINotConfiguredError,
    AIProviderError,
    AITimeoutError,
)
from ..auth.token import require_api_key
from ..limits import MAX_PROMPT_LENGTH
from .deps import get_ai_provider

router = APIRouter(prefix="/api/v1", tags=["规格"], dependencies=[Depends(require_api_key)])


class PromptRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=MAX_PROMPT_LENGTH)


class SpecProposalResponse(BaseModel):
    message: str
    spec: dict
    warnings: list[str]


@router.post("/specs/from-prompt", response_model=SpecProposalResponse)
async def spec_from_prompt(body: PromptRequest, provider=Depends(get_ai_provider)):
    if not body.prompt.strip():
        raise HTTPException(status_code=422, detail="提示词不能为空。")
    try:
        proposal = await provider.create_generation_spec(body.prompt)
    except AINotConfiguredError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except AITimeoutError as exc:
        raise HTTPException(status_code=504, detail=str(exc)) from exc
    except AIProviderError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return SpecProposalResponse(
        message=proposal.message, spec=proposal.spec, warnings=proposal.warnings
    )
