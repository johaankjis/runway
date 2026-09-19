from __future__ import annotations

import os
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware

from runway_api.financial_engine import calculate_scenario
from runway_api.models import (
    Business,
    Document,
    FinancialState,
    HealthResponse,
    Recommendation,
    ResetResponse,
    ScenarioRequest,
    ScenarioResult,
    Signal,
)
from runway_api.repository import InMemoryRepository


def get_repository(request: Request) -> InMemoryRepository:
    return request.app.state.repository


RepositoryDependency = Annotated[InMemoryRepository, Depends(get_repository)]


def create_app(repository: InMemoryRepository | None = None) -> FastAPI:
    application = FastAPI(
        title="Runway API",
        version="0.1.0",
        description="Deterministic financial state and traceable business signals.",
    )
    application.state.repository = repository or InMemoryRepository()
    allowed_origins = [
        origin.strip()
        for origin in os.getenv("RUNWAY_CORS_ORIGINS", "http://localhost:3000").split(",")
        if origin.strip()
    ]
    application.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )

    @application.get("/health", response_model=HealthResponse, tags=["system"])
    def health() -> HealthResponse:
        return HealthResponse()

    @application.get("/api/business", response_model=Business, tags=["demo"])
    def business(repo: RepositoryDependency) -> Business:
        return repo.get_business()

    @application.get("/api/financial-state", response_model=FinancialState, tags=["finance"])
    def financial_state(repo: RepositoryDependency) -> FinancialState:
        return repo.get_financial_state()

    @application.get("/api/signals", response_model=list[Signal], tags=["signals"])
    def signals(repo: RepositoryDependency) -> list[Signal]:
        return repo.list_signals()

    @application.get("/api/signals/{signal_id}", response_model=Signal, tags=["signals"])
    def signal(signal_id: str, repo: RepositoryDependency) -> Signal:
        result = repo.get_signal(signal_id)
        if result is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Signal '{signal_id}' was not found",
            )
        return result

    @application.get("/api/documents", response_model=list[Document], tags=["documents"])
    def documents(repo: RepositoryDependency) -> list[Document]:
        return repo.list_documents()

    @application.get(
        "/api/recommendations", response_model=list[Recommendation], tags=["recommendations"]
    )
    def recommendations(repo: RepositoryDependency) -> list[Recommendation]:
        return repo.list_recommendations()

    @application.post("/api/scenarios", response_model=ScenarioResult, tags=["finance"])
    def scenario(payload: ScenarioRequest, repo: RepositoryDependency) -> ScenarioResult:
        return calculate_scenario(repo.get_financial_state(), payload)

    @application.post("/api/demo/reset", response_model=ResetResponse, tags=["demo"])
    def reset_demo(repo: RepositoryDependency) -> ResetResponse:
        repo.reset()
        return ResetResponse(business_id=repo.get_business().id)

    return application


app = create_app()
