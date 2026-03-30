"""Entry point for the Ingestion Lambda (invoked by Step Functions)."""

import logging

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


def lambda_handler(event: dict, context: object) -> dict:
    """Fetch employee/claim data from Keka APIs and store raw payloads in S3."""
    logger.info("Ingestion Lambda invoked with event: %s", event)
    return {
        "statusCode": 200,
        "body": "ingestion stub",
    }
