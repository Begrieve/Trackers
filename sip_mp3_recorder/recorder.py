"""pjsua2-based SIP account/call handling with per-call MP3 recording."""

import logging
import os
import threading
from datetime import datetime

import pjsua2 as pj

from .audio import wav_to_mp3
from .config import SipRecorderConfig

logger = logging.getLogger(__name__)


def _sanitize(text: str) -> str:
    safe = "".join(c for c in text if c.isalnum() or c in "._-@")
    return safe or "unknown"


class RecordingCall(pj.Call):
    """A single SIP call whose remote audio is captured to WAV, then MP3."""

    def __init__(self, account: "RecordingAccount", call_id: int = pj.PJSUA_INVALID_ID):
        super().__init__(account, call_id)
        self.account = account
        self.recorder = None
        self.wav_path = None

    # -- pjsua2 callbacks -------------------------------------------------

    def onCallState(self, prm):
        ci = self.getInfo()
        logger.info("Call %s -> %s", ci.remoteUri, ci.stateText)
        if ci.state == pj.PJSIP_INV_STATE_DISCONNECTED:
            self._stop_recording()
            self.account.forget_call(self)

    def onCallMediaState(self, prm):
        ci = self.getInfo()
        for mi in ci.media:
            if mi.type == pj.PJMEDIA_TYPE_AUDIO and mi.status == pj.PJSUA_CALL_MEDIA_ACTIVE:
                audio_media = self.getAudioMedia(mi.index)
                self._start_recording(audio_media, ci.remoteUri)
                break

    # -- recording ----------------------------------------------------------

    def _make_wav_path(self, remote_uri: str) -> str:
        recordings_dir = self.account.config.recordings_dir
        os.makedirs(recordings_dir, exist_ok=True)
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        filename = f"{stamp}_{_sanitize(remote_uri)}.wav"
        return os.path.join(recordings_dir, filename)

    def _start_recording(self, audio_media: pj.AudioMedia, remote_uri: str):
        if self.recorder is not None:
            return  # already recording (e.g. media renegotiation)

        self.wav_path = self._make_wav_path(remote_uri)
        try:
            self.recorder = pj.AudioMediaRecorder()
            self.recorder.createRecorder(self.wav_path)

            # Remote party's audio (what the SIP phone is saying) into the file.
            audio_media.startTransmit(self.recorder)

            # Optionally mix in our own outgoing audio for a full-duplex recording.
            if self.account.config.record_local_audio:
                mic = pj.Endpoint.instance().audDevManager().getCaptureDevMedia()
                mic.startTransmit(self.recorder)

            logger.info("Recording call with %s -> %s", remote_uri, self.wav_path)
        except pj.Error as exc:
            logger.error("Could not start recording for %s: %s", remote_uri, exc)
            self.recorder = None
            self.wav_path = None

    def _stop_recording(self):
        if self.recorder is None:
            return

        # Dropping the recorder object closes the underlying media port/file.
        self.recorder = None

        wav_path = self.wav_path
        if wav_path and os.path.exists(wav_path):
            threading.Thread(
                target=self._convert_and_cleanup, args=(wav_path,), daemon=True
            ).start()

    def _convert_and_cleanup(self, wav_path: str):
        try:
            mp3_path = wav_to_mp3(wav_path, bitrate=self.account.config.mp3_bitrate)
            logger.info("Saved recording: %s", mp3_path)
        except Exception:
            logger.exception("Failed to convert %s to MP3", wav_path)
            return

        if not self.account.config.keep_wav and os.path.exists(wav_path):
            os.remove(wav_path)


class RecordingAccount(pj.Account):
    """SIP account that auto-answers calls and records each one."""

    def __init__(self, config: SipRecorderConfig):
        super().__init__()
        self.config = config
        self._calls = []
        self._lock = threading.Lock()

    def onRegState(self, prm):
        ai = self.getInfo()
        logger.info("Registration state: %s (%s)", ai.regStatus, ai.regStatusText)

    def onIncomingCall(self, prm):
        call = RecordingCall(self, prm.callId)
        with self._lock:
            self._calls.append(call)

        call_prm = pj.CallOpParam()
        if self.config.auto_answer:
            call_prm.statusCode = pj.PJSIP_SC_OK
        else:
            call_prm.statusCode = pj.PJSIP_SC_RINGING
        call.answer(call_prm)

    def make_call(self, destination_uri: str) -> RecordingCall:
        """Place an outbound call to `destination_uri` (e.g. sip:1002@pbx.example.com)."""
        call = RecordingCall(self)
        with self._lock:
            self._calls.append(call)
        call.makeCall(destination_uri, pj.CallOpParam(True))
        return call

    def forget_call(self, call: RecordingCall):
        with self._lock:
            if call in self._calls:
                self._calls.remove(call)

    def shutdown(self):
        with self._lock:
            calls, self._calls = self._calls, []
        for call in calls:
            try:
                call.hangup(pj.CallOpParam(True))
            except pj.Error:
                pass
