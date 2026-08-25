"""内置模板：无 AI 入口，模板本质上也是 GenerationSpec。"""

from fastapi import APIRouter, Depends

from ..auth.token import require_auth
from ..specs.models import BUILTIN_CI_TYPES, BUILTIN_RELATION_TYPES
from ..specs.templates import BUILTIN_TEMPLATES

router = APIRouter(prefix="/api/v1", tags=["模板"], dependencies=[Depends(require_auth)])


@router.get("/templates")
def list_templates() -> dict:
    return {
        "templates": BUILTIN_TEMPLATES,
        "ci_types": BUILTIN_CI_TYPES,
        "relation_types": BUILTIN_RELATION_TYPES,
    }
