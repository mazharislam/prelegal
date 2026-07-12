"""Inference through the local Claude Code CLI.

Per the project's claudecoder skill, the model is reached by shelling out to an
authenticated `claude` binary — there is no API key and no SDK. That binary
lives on the developer's machine, not in the container, so `/api/chat` is the
one endpoint that does not work inside Docker; it says so plainly instead of
failing obscurely.
"""

import json
import subprocess
from typing import Any

from fastapi import HTTPException, status

MODEL = "claude-opus-4-8"
EFFORT = "low"
TIMEOUT_SECONDS = 120

CLI_MISSING = (
    "The claude CLI was not found. AI chat calls it directly, so the backend "
    "must run on a host where Claude Code is installed and signed in — not "
    "inside the container."
)


def call_claude_structured(prompt: str, schema: dict[str, Any]) -> dict[str, Any]:
    """Return validated structured output from Claude, or raise HTTPException."""
    command = [
        "claude",
        "-p",
        "--model",
        MODEL,
        "--effort",
        EFFORT,
        "--output-format",
        "json",
        "--json-schema",
        json.dumps(schema),
        prompt,
    ]

    try:
        completed = subprocess.run(
            command,
            capture_output=True,
            text=True,
            # The CLI emits UTF-8. Without this, Windows decodes it as cp1252
            # and every em-dash the model writes arrives as mojibake.
            encoding="utf-8",
            check=True,
            timeout=TIMEOUT_SECONDS,
            shell=False,
        )
    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=CLI_MISSING
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=f"The model did not answer within {TIMEOUT_SECONDS} seconds.",
        )
    except subprocess.CalledProcessError as error:
        detail = (error.stderr or error.stdout or "").strip()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"The claude CLI failed: {detail}",
        )

    try:
        response = json.loads(completed.stdout)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The claude CLI returned output that was not valid JSON.",
        )

    structured_output = response.get("structured_output")
    if structured_output is None:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The claude CLI returned no structured output.",
        )
    return structured_output
