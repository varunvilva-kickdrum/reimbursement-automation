"""Entry point for the Config Sync Lambda (invoked by EventBridge Scheduler)."""

import logging

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


def lambda_handler(event: dict, context: object) -> dict:
    """Read Google Sheet config and upload pipeline JSON to S3."""
    logger.info("Config Sync Lambda invoked with event: %s", event)
    return {
        "statusCode": 200,
        "body": "config_sync stub",
    }
