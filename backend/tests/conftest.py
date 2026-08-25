"""共享测试夹具：临时 SQLite、假 AI Provider、TestClient。"""

import pytest
from fastapi.testclient import TestClient

from app.ai.provider import SpecProposal
from app.config import Settings
from app.main import create_app

TEST_KEY = "test-api-key-123"


class FakeProvider:
    """自动化测试使用的假 Provider，不需要付费凭据。"""

    def __init__(self, proposal: SpecProposal | None = None, error: Exception | None = None):
        self.proposal = proposal
        self.error = error
        self.calls: list[str] = []

    async def create_generation_spec(self, prompt: str) -> SpecProposal:
        self.calls.append(prompt)
        if self.error is not None:
            raise self.error
        assert self.proposal is not None
        return self.proposal


def default_proposal() -> SpecProposal:
    return SpecProposal(
        message="我计划生成以下数据：1 个数据中心、4 个机柜、8 台物理服务器和 16 台虚拟机。",
        spec={
            "name": "假 Provider 数据集",
            "description": "测试用",
            "seed": 42,
            "ci_types": [
                {"type": "data_center", "count": 1},
                {"type": "rack", "count": 4},
                {"type": "physical_server", "count": 8},
                {"type": "virtual_machine", "count": 16},
            ],
            "relations": [
                {"type": "contains", "from_type": "data_center", "to_type": "rack",
                 "strategy": "balanced", "coverage": "to"},
                {"type": "mounted_in", "from_type": "physical_server", "to_type": "rack",
                 "strategy": "balanced", "coverage": "from"},
                {"type": "runs_on", "from_type": "virtual_machine", "to_type": "physical_server",
                 "strategy": "balanced", "coverage": "from"},
            ],
        },
        warnings=["这是一个假 Provider 的建议。"],
    )


def make_settings(tmp_path, **overrides) -> Settings:
    return Settings(
        isl_api_key=TEST_KEY,
        isl_data_dir=tmp_path / "data",
        _env_file=None,
        **overrides,
    )


@pytest.fixture()
def app_env(tmp_path):
    """带假 Provider 的完整应用。"""
    provider = FakeProvider(default_proposal())
    app = create_app(make_settings(tmp_path), ai_provider=provider)
    return app, provider


@pytest.fixture()
def client(app_env):
    app, _provider = app_env
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def auth() -> dict:
    return {"Authorization": f"Bearer {TEST_KEY}"}
