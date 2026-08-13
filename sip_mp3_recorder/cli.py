"""Command-line entrypoint for the SIP MP3 recorder."""

import argparse
import logging

from .app import SipMp3RecorderApp
from .config import SipRecorderConfig


def main():
    parser = argparse.ArgumentParser(
        description="Register a SIP extension and record every call it handles to MP3."
    )
    parser.add_argument(
        "-c", "--config", help="Path to a YAML config file (defaults to reading env vars)"
    )
    args = parser.parse_args()

    config = (
        SipRecorderConfig.from_yaml(args.config)
        if args.config
        else SipRecorderConfig.from_env()
    )

    logging.basicConfig(
        level=getattr(logging, config.log_level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
    )

    app = SipMp3RecorderApp(config)
    app.start()
    app.run_forever()


if __name__ == "__main__":
    main()
