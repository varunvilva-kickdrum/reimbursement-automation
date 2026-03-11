"""Entry point for the test Lambda (invoked by AWS)."""

from common import get_app_name
from greeting import get_greeting


def lambda_handler(event: dict, context: object) -> dict:
    """Return a simple greeting. Used for CI/CD smoke test."""
    app_name = get_app_name()
    body = get_greeting()
    return {
        "statusCode": 200,
        "body": f"[{app_name}] {body}",
        "headers": {"Content-Type": "text/plain"},
    }
