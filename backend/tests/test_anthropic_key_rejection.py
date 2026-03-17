"""
Check whether the Anthropic API key from backend/.env is being rejected.

Run from backend/:
    .venv/bin/python tests/test_anthropic_key_rejection.py

Exit codes:
    0 -> key is rejected (expected for this diagnostic)
    1 -> key call succeeded (not rejected)
    2 -> config/runtime issue (missing key, network, or unexpected API error)
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import anthropic
from dotenv import load_dotenv


def _load_env() -> None:
    backend_dir = Path(__file__).resolve().parents[1]
    env_path = backend_dir / ".env"
    load_dotenv(dotenv_path=env_path)


def main() -> int:
    _load_env()
    api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    if not api_key:
        print("FAIL: ANTHROPIC_API_KEY is missing or empty in backend/.env")
        return 2

    client = anthropic.Anthropic(api_key=api_key)

    try:
        client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1200,
            messages=[{"role": "user", "content": "ping"}],
        )
    except anthropic.BadRequestError as exc:
        message = str(exc).lower()
        if "credit balance is too low" in message:
            print("PASS: Key is rejected due to low Anthropic credits.")
            return 0
        print("PASS: Key is rejected with BadRequestError.")
        print(f"Detail: {exc}")
        return 0
    except anthropic.AuthenticationError as exc:
        print("PASS: Key is rejected with authentication error.")
        print(f"Detail: {exc}")
        return 0
    except anthropic.APIStatusError as exc:
        print("FAIL: Anthropic returned unexpected status error (not definitive key rejection).")
        print(f"Detail: {exc}")
        return 2
    except Exception as exc:
        print("FAIL: Unexpected runtime error while testing Anthropic key.")
        print(f"Detail: {exc}")
        return 2

    print("FAIL: Key was accepted (request succeeded), so it is not currently rejected.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
