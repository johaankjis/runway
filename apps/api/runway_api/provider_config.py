import os

from pydantic import Field, SecretStr

from runway_api.models import StrictModel


class ProviderSettings(StrictModel):
    signal_provider: str = "fixture"
    nvidia_api_key: SecretStr = SecretStr("")
    nvidia_base_url: str = "https://integrate.api.nvidia.com/v1"
    nvidia_model: str = "nvidia/llama-3.3-nemotron-super-49b-v1"
    nvidia_timeout_seconds: float = Field(default=20, gt=0, le=120, allow_inf_nan=False)
    voice_provider: str = "fixture"
    elevenlabs_api_key: SecretStr = SecretStr("")
    elevenlabs_voice_id: str = ""
    elevenlabs_base_url: str = "https://api.elevenlabs.io/v1"
    elevenlabs_model: str = "eleven_multilingual_v2"
    elevenlabs_timeout_seconds: float = Field(default=20, gt=0, le=120, allow_inf_nan=False)

    @classmethod
    def from_environment(cls) -> "ProviderSettings":
        values = {}
        for name in cls.model_fields:
            env_name = f"RUNWAY_{name.upper()}" if name.endswith("provider") else name.upper()
            if env_name in os.environ:
                values[name] = os.environ[env_name]
        settings = cls.model_validate(values)
        if settings.signal_provider not in {"fixture", "nemotron"}:
            raise ValueError("RUNWAY_SIGNAL_PROVIDER must be fixture or nemotron")
        if settings.voice_provider not in {"fixture", "elevenlabs"}:
            raise ValueError("RUNWAY_VOICE_PROVIDER must be fixture or elevenlabs")
        return settings
