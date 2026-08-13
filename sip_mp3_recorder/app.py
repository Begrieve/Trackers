"""Wires up the pjsua2 endpoint, transport and account, and runs the event loop."""

import logging
import signal
import time

import pjsua2 as pj

from .config import SipRecorderConfig
from .recorder import RecordingAccount

logger = logging.getLogger(__name__)

_TRANSPORT_TYPES = {
    "udp": pj.PJSIP_TRANSPORT_UDP,
    "tcp": pj.PJSIP_TRANSPORT_TCP,
    "tls": pj.PJSIP_TRANSPORT_TLS,
}


class SipMp3RecorderApp:
    def __init__(self, config: SipRecorderConfig):
        self.config = config
        self.ep = pj.Endpoint()
        self.account = None
        self._running = False

    def start(self):
        self.ep.libCreate()

        ep_cfg = pj.EpConfig()
        ep_cfg.uaConfig.maxCalls = 32
        self.ep.libInit(ep_cfg)

        tcfg = pj.TransportConfig()
        tcfg.port = self.config.local_port
        self.ep.transportCreate(_TRANSPORT_TYPES[self.config.transport], tcfg)

        self.ep.libStart()
        logger.info(
            "SIP endpoint started on port %s/%s", self.config.local_port, self.config.transport
        )

        acc_cfg = pj.AccountConfig()
        acc_cfg.idUri = f"sip:{self.config.sip_user}@{self.config.sip_domain}"
        acc_cfg.regConfig.registrarUri = self.config.registrar_uri
        cred = pj.AuthCredInfo("digest", "*", self.config.sip_user, 0, self.config.sip_password)
        acc_cfg.sipConfig.authCreds.append(cred)
        if self.config.proxy_uri:
            acc_cfg.sipConfig.proxies.append(self.config.proxy_uri)

        self.account = RecordingAccount(self.config)
        self.account.create(acc_cfg)

        self._running = True

    def run_forever(self):
        signal.signal(signal.SIGINT, self._handle_stop)
        signal.signal(signal.SIGTERM, self._handle_stop)
        logger.info("Waiting for calls (Ctrl+C to stop)...")
        while self._running:
            self.ep.libHandleEvents(200)
        self._shutdown()

    def _handle_stop(self, signum, frame):
        logger.info("Shutdown requested, hanging up active calls...")
        self._running = False

    def _shutdown(self):
        if self.account is not None:
            self.account.shutdown()
            self.account.delete()
            self.account = None
        self.ep.libDestroy()
        logger.info("Stopped.")
