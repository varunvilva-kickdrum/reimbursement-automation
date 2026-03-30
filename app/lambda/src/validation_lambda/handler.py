"""Entry point for the Validation Lambda (invoked by Step Functions)."""

import logging

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


def lambda_handler(event: dict, context: object) -> dict:
    """Apply config-driven business rules to determine claim eligibility."""
    logger.info("Validation Lambda invoked with event: %s", event)
    return {
        "statusCode": 200,
        "body": "validation stub",
    }
