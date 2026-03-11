# IAC folder design

The IAC follows the same patterns as the Ad-Results Media DataPipeline repo: **config-driven**, **component + helper** layout, and **per-environment resources** via merged configs.

## Layout (Ad-Results style)

- **`lib/config/`** – `config.ts` (types), `get-config.ts` (load default + env merge), `global-config.ts` (getResourceName).
- **`lib/constants/`** – e.g. `lambda-constants.ts` (runtime, handler, timeouts).
- **`lib/errors/`** – `IacErrors.lambda`, `IacErrors.config`, `IacErrors.environment`, etc.
- **`lib/helpers/lambda-builder.ts`** – path validation, `createFunctionCode()` for *_lambda folders.
- **`lib/components/lambda/`** – `lambda-types.ts` (LambdaProps, BuiltLambdaFunction), `lambda.ts` (Lambda construct, creates functions from config).
- **`lib/stacks/`** – stack composes Lambda (and later Step Function) and passes resolved paths + config.
- **`configs/default/`** – default `reimbursementStackConfig.json`. **`configs/dev|staging|prod/`** – override per environment (e.g. enable/disable functions or step function).

## 1. What pattern does the IAC follow?

The layout follows **composition + CDK’s construct pattern** (not Factory or Singleton).

- **Composition root**: `bin/app.ts` creates the CDK app and a single stack per environment. It doesn’t create resources directly; it composes stacks.
- **Stacks** (`lib/stacks/`): Each stack is a composition of **constructs**. It receives environment (dev/staging/prod) and instantiates one or more constructs. No business logic; only wiring.
- **Constructs** (`lib/constructs/`): Each construct owns one or more AWS resources (e.g. one Lambda, or one Step Function + its roles). Constructs are the reusable building blocks. They are not “factories” that switch on a type; they are fixed units (e.g. “this construct is the test Lambda”, “this construct is the ingestion Lambda”).

So the pattern is: **one construct per logical piece of infra (or per Lambda), composed in one stack**. To add a new Lambda you add a new construct and add one line in the stack. To add a Step Function you add a construct that creates the state machine and references the Lambdas (by using the construct’s `.fn` or similar exports).

---

## 2. Why `dist/` and `cdk.out/`?

| Directory   | Produced by | Purpose |
|------------|-------------|---------|
| **`dist/`**   | `bun run build` (TypeScript compiler) | Holds the **compiled IAC code** (`.ts` → `.js`). The CDK app runs as `node dist/bin/app.js`. Check this into CI and run `build` before `cdk synth` / `cdk deploy`. |
| **`cdk.out/`** | `cdk synth` (CDK CLI) | Holds the **synthesized deployment artifacts**: CloudFormation templates, asset manifests, and metadata. Used by `cdk deploy` to talk to CloudFormation. Do not commit; it’s the “build output” of the CDK app. |

So: **`dist/` = compiled TypeScript for the app**. **`cdk.out/` = generated CloudFormation and assets for deployment**.

---

## 3. Where to make changes when adding more Lambdas or a Step Function

### Adding another Lambda (e.g. `ingestion_lambda`) with config

1. **App**: Add `app/lambda/src/ingestion_lambda/` with `__init__.py`, `handler.py`, and any other modules (relative imports).
2. **Config**: In `configs/default/reimbursementStackConfig.json`, add to `lambda.functions`: `{ "name": "ingestion_lambda", "timeout": 60 }`. Optionally in `configs/dev/reimbursementStackConfig.json` set `"enabled": false` to skip deploying it in dev.
3. No new construct file: the **Lambda component** reads `config.stack.lambda.functions` and creates one CDK Function per entry (when `enabled !== false`). Use `this.lambda.getLambdaFunction('ingestion_lambda')` from the stack if another construct (e.g. Step Function) needs the ARN.

### Adding a Step Function that connects Lambdas

1. **New construct**  
   In `iac/lib/constructs/` add e.g. `pipeline-stepfunction-construct.ts` that accepts the **Lambda component** (or individual function refs). Use `this.lambda.getLambdaFunction('test_lambda')` etc. to get `IFunction` for `LambdaInvoke`.
2. **Wire in the stack**  
   In `reimbursement-stack.ts`, create the Step Function construct after `this.lambda` and pass `this.lambda` (or the required function refs). Enable only in certain environments via `config.stack.stepFunction.enabled` (set to `true` in prod/staging, `false` in dev in configs).

---

## 4. Lambda source layout: `*_lambda` and multi-file

Convention:

- **One deployable Lambda = one folder** under `app/lambda/src/`, with a name ending in `_lambda` (e.g. `test_lambda`, `ingestion_lambda`).
- That folder is the **asset** for that Lambda: CDK uses `fromAsset(..., app/lambda/src/<name>_lambda)`.
- Inside the folder:
  - **`handler.py`** – entry point; must expose `lambda_handler(event, context)`.
  - **`__init__.py`** – so the folder is a Python package.
  - Any other modules (e.g. `greeting.py`, `parser.py`) – use **relative imports** inside the folder (e.g. `from .greeting import get_greeting`) so the same code works when the asset root is that folder at runtime.

Example: **test_lambda** (Hello World, multi-file)

- `app/lambda/src/test_lambda/`
  - `__init__.py`
  - `handler.py` – imports from `.greeting`, returns the greeting in the response.
  - `greeting.py` – defines `get_greeting()` returning `"Hello World"`.

Handler in CDK for this Lambda: `handler.lambda_handler` (module `handler`, function `lambda_handler`), because the asset root is `test_lambda/` and `handler.py` is at the root of that asset.
