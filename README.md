# SIP MP3 Call Recorder

Registers as a SIP extension against your PBX/SIP server, auto-answers calls,
and records each call's audio to an MP3 file. Built on
[PJSIP](https://www.pjsip.org/)'s `pjsua2` Python bindings for SIP
signaling/RTP handling, with `ffmpeg` used to transcode the captured audio to
MP3.

## ⚠️ Legal notice

Recording phone calls without proper notice or consent is illegal in many
jurisdictions (e.g. two-party consent states in the US, GDPR in the EU). Only
use this tool on lines you're authorized to record, and make sure your
callers are informed as required by local law (e.g. an IVR announcement).

## How it works

1. `sip_mp3_recorder/app.py` creates a `pjsua2` endpoint, opens a SIP
   transport (UDP/TCP/TLS), and registers a `RecordingAccount` against your
   SIP server using the credentials in your config.
2. `RecordingAccount.onIncomingCall` auto-answers each inbound call and wraps
   it in a `RecordingCall`.
3. Once call media is up (`onCallMediaState`), the call's audio stream is
   connected to a `pj.AudioMediaRecorder`, which writes raw audio to a WAV
   file for the duration of the call (optionally mixing in this endpoint's
   own mic/outgoing audio for full-duplex recordings).
4. When the call ends, the WAV file is transcoded to MP3 via `ffmpeg` in a
   background thread and the WAV is deleted (unless `keep_wav: true`).

Recordings are written to `recordings/<timestamp>_<remote-uri>.mp3` by
default.

## Requirements

- Python 3.8+
- [`ffmpeg`](https://ffmpeg.org/) on `PATH` (for MP3 transcoding)
- `pjsua2` — PJSIP's Python bindings. These require compiling PJSIP with
  Python/SWIG support:

  ```bash
  git clone https://github.com/pjsip/pjproject.git
  cd pjproject
  ./configure --enable-shared
  make dep && make && make install
  cd pjsip-apps/src/swig
  make python
  cd python && pip install .
  ```

  See the [PJSIP Python SWIG docs](https://docs.pjsip.org/en/latest/pjsua2/py_swig_setup.html)
  for platform-specific details.

## Setup

```bash
pip install -r requirements.txt
cp config.example.yaml config.yaml
# edit config.yaml with your PBX host, extension and password
python main.py --config config.yaml
```

Alternatively, configure via environment variables instead of a YAML file:

```bash
export SIP_DOMAIN=pbx.example.com
export SIP_USER=1001
export SIP_PASSWORD=changeme
python main.py
```

## Configuration reference

| Key                   | Env var               | Default                | Description                                    |
|------------------------|------------------------|-------------------------|------------------------------------------------|
| `sip_domain`           | `SIP_DOMAIN`           | required                | SIP server/PBX hostname or IP                   |
| `sip_user`             | `SIP_USER`             | required                | Extension/account username                      |
| `sip_password`         | `SIP_PASSWORD`         | required                | Extension/account password                      |
| `registrar_uri`        | `SIP_REGISTRAR_URI`    | `sip:<sip_domain>`      | SIP registrar URI                               |
| `proxy_uri`            | `SIP_PROXY_URI`        | none                    | Outbound proxy, if required                     |
| `local_port`           | `SIP_LOCAL_PORT`       | `5060`                  | Local SIP transport port                        |
| `transport`            | `SIP_TRANSPORT`        | `udp`                   | `udp`, `tcp`, or `tls`                          |
| `recordings_dir`       | `RECORDINGS_DIR`       | `recordings`            | Output directory for recordings                 |
| `mp3_bitrate`          | `MP3_BITRATE`          | `128k`                  | MP3 encoding bitrate                            |
| `keep_wav`             | `KEEP_WAV`             | `false`                 | Keep intermediate WAV files                     |
| `auto_answer`          | `AUTO_ANSWER`          | `true`                  | Auto-answer incoming calls                      |
| `record_local_audio`   | `RECORD_LOCAL_AUDIO`   | `false`                 | Mix in this endpoint's own mic/outgoing audio   |
| `log_level`            | `LOG_LEVEL`            | `INFO`                  | Python logging level                            |

## Running as a service

Example `systemd` unit:

```ini
[Unit]
Description=SIP MP3 Call Recorder
After=network-online.target

[Service]
WorkingDirectory=/opt/sip-mp3-recorder
ExecStart=/usr/bin/python3 main.py --config /opt/sip-mp3-recorder/config.yaml
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

## Notes

- By default only the remote party's audio (what the SIP phone sends) is
  recorded. Set `record_local_audio: true` to mix in this endpoint's own
  captured/outgoing audio for a full-duplex recording — useful if you're
  deploying this as a monitoring/recording extension that a PBX bridges
  calls into.
- Each call is recorded to its own file, so concurrent calls (`maxCalls` in
  `app.py`) are recorded independently.
- To place outbound calls (e.g. from a scripted dialer), use
  `RecordingAccount.make_call("sip:1002@pbx.example.com")`.
