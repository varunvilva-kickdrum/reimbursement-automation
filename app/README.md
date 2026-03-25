# reimbursement-automation app

Python app (Lambdas) for **reimbursement-automation**.

## Local setup (uv)

From this directory (`app/`):

```bash
uv sync
```

This creates a virtual environment (`.venv`) and installs dependencies from `pyproject.toml`.

## Run a Lambda locally

After `uv sync`, invoke a function by name (shared layer is added to `sys.path` automatically):

```bash
uv run lambda/local/invoke_lambda.py test_lambda
```

With a custom event (JSON):

```bash
uv run lambda/local/invoke_lambda.py test_lambda --event '{"key": "value"}'
```

## Shared layer

Common code lives in `lambda/shared/python/`. It is deployed as a Lambda layer so all functions can use it (e.g. `from common import get_app_name`). The local invoker adds this path when running so imports match the Lambda environment.
