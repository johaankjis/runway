from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from runway_api.main import create_app
from runway_api.provider_config import ProviderSettings
from runway_api.repository import InMemoryRepository


@pytest.fixture
def repository() -> InMemoryRepository:
    return InMemoryRepository()


@pytest.fixture
def client(repository: InMemoryRepository) -> Iterator[TestClient]:
    with TestClient(create_app(repository, ProviderSettings())) as test_client:
        yield test_client
