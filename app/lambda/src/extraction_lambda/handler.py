"""Entry point for the OCR/Extraction Lambda (invoked by Step Functions)."""

import logging

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


def lambda_handler(event: dict, context: object) -> dict:
    """Perform OCR on attachments and extract structured fields via LangExtract."""
    logger.info("Extraction Lambda invoked with event: %s", event)
    return {
        "statusCode": 200,
        "body": "extraction stub",
    }
