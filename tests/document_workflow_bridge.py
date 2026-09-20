"""JSON-lines transport for testing the real frontend workflow against FastAPI in-process."""

import base64
import json
import sys

from fastapi.testclient import TestClient
from runway_api.extraction import NemotronSignalExtractor, explicit_upload_facts
from runway_api.main import create_app
from runway_api.provider_config import ProviderSettings


def invalid_provider(self, document, content):
    facts = explicit_upload_facts(document, content)
    facts.excerpt = "Invented provider evidence that is not present in the source."
    return facts


settings = ProviderSettings()
if "--invalid-provider" in sys.argv:
    NemotronSignalExtractor.extract = invalid_provider
    settings = ProviderSettings(signal_provider="nemotron", nvidia_api_key="test-only")

with TestClient(create_app(settings=settings)) as client:
    for line in sys.stdin:
        request = json.loads(line)
        if request.get("operation") == "upload":
            response = client.post(
                "/api/documents/upload",
                files={
                    "file": (
                        request["name"],
                        base64.b64decode(request["content"]),
                        request["mime"],
                    )
                },
            )
        else:
            response = client.request(request["method"], request["path"])
        print(json.dumps({"status": response.status_code, "body": response.json()}), flush=True)
