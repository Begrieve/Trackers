"""WAV -> MP3 transcoding helpers."""

import os
import shutil
import subprocess


def wav_to_mp3(wav_path: str, bitrate: str = "128k") -> str:
    """Transcode a WAV recording to MP3 using ffmpeg and return the MP3 path."""
    if shutil.which("ffmpeg") is None:
        raise RuntimeError(
            "ffmpeg was not found on PATH. Install it (e.g. `apt-get install ffmpeg`) "
            "to enable MP3 transcoding."
        )

    mp3_path = os.path.splitext(wav_path)[0] + ".mp3"
    cmd = [
        "ffmpeg",
        "-y",
        "-i", wav_path,
        "-vn",
        "-codec:a", "libmp3lame",
        "-b:a", bitrate,
        mp3_path,
    ]
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    if result.returncode != 0:
        raise RuntimeError(
            f"ffmpeg failed converting {wav_path} to mp3:\n"
            f"{result.stdout.decode(errors='ignore')}"
        )
    return mp3_path
