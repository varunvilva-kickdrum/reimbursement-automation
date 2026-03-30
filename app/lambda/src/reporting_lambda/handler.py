"""Entry point for the Reporting Lambda (invoked by EventBridge Scheduler)."""

import logging

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


def lambda_handler(event: dict, context: object) -> dict:
    """Generate consolidated reimbursement report and publish to SNS."""
    logger.info("Reporting Lambda invoked with event: %s", event)
    return {
        "statusCode": 200,
        "body": "reporting stub",
    }
