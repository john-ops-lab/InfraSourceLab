"""规格建议与导入校验：都不创建或保存数据集。"""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..ai.provider import (
    AINotConfiguredError,
    AIProviderError,
    AITimeoutError,
)
from ..auth.token import require_auth
from ..limits import MAX_PROMPT_LENGTH
from ..specs.models import SpecValidationError, parse_and_validate
from ..specs.relation_types import relation_type_map
from .deps import get_ai_provider, get_session

router = APIRouter(prefix="/api/v1", tags=["规格"], dependencies=[Depends(require_auth)])


class PromptRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=MAX_PROMPT_LENGTH)


class SpecProposalResponse(BaseModel):
    message: str
    spec: dict
    warnings: list[str]


class SpecValidateRequest(BaseModel):
    spec: dict[str, Any]


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


@router.post("/specs/validate")
def validate_spec(body: SpecValidateRequest, session: Session = Depends(get_session)) -> dict:
    """校验并规范化导入规格，仍由用户确认后再创建数据集。"""
    try:
        spec = parse_and_validate(
            body.spec,
            allowed_relation_types=set(relation_type_map(session)),
        )
    except SpecValidationError as exc:
        raise HTTPException(status_code=422, detail={"errors": exc.errors}) from exc
    return {"spec": spec.model_dump(mode="json")}
