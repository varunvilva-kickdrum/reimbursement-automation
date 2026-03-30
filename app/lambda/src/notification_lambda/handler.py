"""Entry point for the Notification Lambda (invoked via SNS subscription)."""

import logging

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


def lambda_handler(event: dict, context: object) -> dict:
    """Deliver report notifications to HR via Slack."""
    logger.info("Notification Lambda invoked with event: %s", event)
    return {
        "statusCode": 200,
        "body": "notification stub",
    }
