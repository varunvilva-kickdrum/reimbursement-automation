"""
Local Lambda Function Invoker.

Provides a simple way to test AWS Lambda functions locally.

From the app directory (where pyproject.toml lives):

  uv sync
  uv run lambda/local/invoke_lambda.py test_lambda
  uv run lambda/local/invoke_lambda.py test_lambda --event '{"key": "value"}'
"""

import argparse
import importlib
import json
import logging
import os
import sys
from typing import Any, Dict, Optional

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

# Suppress AWS SDK logs
for logger_name in ["botocore", "urllib3", "boto3", "s3transfer"]:
    logging.getLogger(logger_name).setLevel(logging.WARNING)


class LambdaInvoker:
    """Simple local invoker for Lambda functions."""

    def __init__(self) -> None:
        self.logger = logging.getLogger("lambda-local")

    def load_handler(self, function_name: str) -> Any:
        """Load the lambda handler function.

        Adds (1) the shared layer path (lambda/shared/python) and (2) the function
        directory (e.g. src/test_lambda) to sys.path so that layer imports
        (e.g. from common import ...) and local imports (from greeting import ...)
        resolve the same way as in AWS Lambda.
        """
        try:
            # Lambda root: parent of this file's parent (app/lambda)
            _invoker_file = os.path.abspath(__file__)
            _lambda_root = os.path.dirname(os.path.dirname(_invoker_file))
            function_dir = os.path.join(_lambda_root, "src", function_name)
            shared_layer_dir = os.path.join(_lambda_root, "shared", "python")

            if not os.path.isdir(function_dir):
                raise ImportError(
                    f"Function directory not found: {function_dir}. "
                    f"Expected structure: lambda/src/{function_name}/"
                )

            # Mirror Lambda: shared layer first (like /opt/python), then function folder
            if os.path.isdir(shared_layer_dir) and shared_layer_dir not in sys.path:
                sys.path.insert(0, shared_layer_dir)
            if function_dir not in sys.path:
                sys.path.insert(0, function_dir)

            # Import handler the same way Lambda does (handler.lambda_handler)
            module = importlib.import_module("handler")
            if hasattr(module, "lambda_handler"):
                return module.lambda_handler
            raise ImportError(f"lambda_handler not found in {function_name}")
        except Exception as e:
            self.logger.error("Failed to load handler: %s", str(e))
            raise

    def parse_event(self, event_str: Optional[str]) -> Dict[str, Any]:
        """Parse event JSON string to dictionary."""
        if not event_str:
            return {}
        try:
            return json.loads(event_str)
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid event JSON: {str(e)}") from e

    def format_result(self, result: Any) -> str:
        """Format lambda result for display."""
        output = ["\nLambda Response:", "-" * 25]

        if isinstance(result, dict):
            if "statusCode" in result:
                output.append(f"Status Code: {result.get('statusCode')}")

                body = result.get("body")
                if isinstance(body, str):
                    try:
                        body = json.loads(body)
                    except json.JSONDecodeError:
                        pass
                if body:
                    output.append(f"Body: {json.dumps(body, indent=2)}")

                headers = result.get("headers")
                if headers:
                    output.extend(["\nHeaders:"] + [f"{k}: {v}" for k, v in headers.items()])
            else:
                output.append(json.dumps(result, indent=2))
        else:
            output.append(str(result))

        return "\n".join(output)

    def invoke_lambda(self, function_name: str, event_data: Optional[str] = None) -> None:
        """Invoke a lambda function locally."""
        self.logger.info("Invoking %s", function_name)

        try:
            # Load handler
            handler = self.load_handler(function_name)

            # Parse event
            event = self.parse_event(event_data)
            self.logger.info("Event: %s", json.dumps(event, indent=2))

            # Execute
            print(f"\n{'=' * 50}\n{function_name}\n{'=' * 50}")
            result = handler(event, None)
            print(self.format_result(result))

        except Exception as e:
            self.logger.error("Execution failed", exc_info=True)
            print(f"\nError: {type(e).__name__}: {str(e)}")
            raise


def main() -> None:
    """Run the lambda invoker CLI."""
    parser = argparse.ArgumentParser(
        description="Test AWS Lambda functions locally",
        usage='%(prog)s function_name [--event \'{"key": "value"}\']',
    )
    parser.add_argument("function_name", help="Name of the lambda function")
    parser.add_argument("--event", help="JSON event data")

    args = parser.parse_args()

    try:
        LambdaInvoker().invoke_lambda(args.function_name, args.event)
    except Exception as e:
        print(f"Error: {type(e).__name__}: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    # Add the lambda directory to Python path
    lambda_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if lambda_dir not in sys.path:
        sys.path.insert(0, lambda_dir)

    # Add the parent app directory to Python path (for shared modules)
    app_dir = os.path.dirname(lambda_dir)
    if app_dir not in sys.path:
        sys.path.insert(0, app_dir)

    main()
