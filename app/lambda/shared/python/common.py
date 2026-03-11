"""Shared utilities for all Lambdas (deployed as a layer)."""


def get_app_name() -> str:
    """Return the application name (shared across Lambdas)."""
    return "reimbursements"
