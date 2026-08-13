"""Configuration for the SIP MP3 recorder."""

import os
from dataclasses import dataclass
from typing import Optional

import yaml


@dataclass
class SipRecorderConfig:
    sip_domain: str
    sip_user: str
    sip_password: str
    registrar_uri: Optional[str] = None
    proxy_uri: Optional[str] = None
    local_port: int = 5060
    transport: str = "udp"  # udp, tcp, tls
    recordings_dir: str = "recordings"
    mp3_bitrate: str = "128k"
    keep_wav: bool = False
    auto_answer: bool = True
    record_local_audio: bool = False
    log_level: str = "INFO"

    def __post_init__(self):
        if not self.registrar_uri:
            self.registrar_uri = f"sip:{self.sip_domain}"
        if self.transport not in ("udp", "tcp", "tls"):
            raise ValueError(f"Unsupported transport: {self.transport!r}")

    @classmethod
    def from_yaml(cls, path: str) -> "SipRecorderConfig":
        with open(path, "r") as f:
            data = yaml.safe_load(f) or {}
        return cls(**data)

    @classmethod
    def from_env(cls) -> "SipRecorderConfig":
        def _bool(name: str, default: str) -> bool:
            return os.environ.get(name, default).strip().lower() in ("1", "true", "yes", "on")

        return cls(
            sip_domain=os.environ["SIP_DOMAIN"],
            sip_user=os.environ["SIP_USER"],
            sip_password=os.environ["SIP_PASSWORD"],
            registrar_uri=os.environ.get("SIP_REGISTRAR_URI"),
            proxy_uri=os.environ.get("SIP_PROXY_URI"),
            local_port=int(os.environ.get("SIP_LOCAL_PORT", "5060")),
            transport=os.environ.get("SIP_TRANSPORT", "udp"),
            recordings_dir=os.environ.get("RECORDINGS_DIR", "recordings"),
            mp3_bitrate=os.environ.get("MP3_BITRATE", "128k"),
            keep_wav=_bool("KEEP_WAV", "false"),
            auto_answer=_bool("AUTO_ANSWER", "true"),
            record_local_audio=_bool("RECORD_LOCAL_AUDIO", "false"),
            log_level=os.environ.get("LOG_LEVEL", "INFO"),
        )
