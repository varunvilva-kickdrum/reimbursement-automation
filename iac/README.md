# reimbursement-automation IAC (CDK)

AWS CDK (TypeScript) for the **reimbursement-automation** project: Lambda, S3, DynamoDB, Secrets Manager, Step Functions (ASL under `templates/step-functions/`), and optional EventBridge schedules.

## Structure

- **`bin/app.ts`** — CDK app entry; reads `environment` from context (dev | staging | prod).
- **`constants/`** — Centralized strings, numbers, and CDK-related defaults (no inline magic values in `lib/`).
- **`enums/`** — Shared enums (environment, config file names).
- **`configs/`** — Merged stack JSON (`default/` + env folder) and **`configs/secrets/`** for Secrets Manager key layout (merged like AdResults Media DataPipeline).
- **`templates/step-functions/`** — `.json.mustache` ASL templates (Mustache helpers inject Lambda ARNs and resource names).
- **`lib/stacks/`** — Stacks (e.g. `ReimbursementStack` → deployed as **ReimbursementAutomationStack-{env}**).
- **`lib/components/`** — Lambda, IAM, S3, DynamoDB, Secrets Manager, Step Functions, EventBridge schedules; **`lib/helpers/`** — e.g. `asl-utils`, lambda-builder.
- **`cdk.json`** — CDK CLI config; app runs compiled `dist/bin/app.js`. Context includes `environments.dev|staging|prod` with `account`, `region`, and `profile` (like Ad-Results Media).

### AWS resource naming (single source of truth)

Most physical names follow **`{environment}-{MiddleSegment}-{resource}`** via `getResourceName()` in `lib/config/global-config.ts`, where **`MiddleSegment`** is **`reimbursement-automation`** (`constants/resource-naming.ts`). To rebrand again, change **`ResourceNaming.MiddleSegment`** first; then fix any literals outside that path (deploy workflow secret IDs, docs, and GitHub secret names should stay aligned).

CloudFormation **stack** name prefix is **`ReimbursementAutomationStack`** (`constants/stack-constructs.ts`, `stackConstructId()`).

## Commands

| Command                | Description                                                             |
| ---------------------- | ----------------------------------------------------------------------- |
| `bun run build`        | Compile TypeScript to `dist/`                                           |
| `bun run lint`         | ESLint                                                                  |
| `bun run format`       | Prettier write                                                          |
| `bun run format:check` | Prettier check (used in CI / deploy)                                    |
| `bun run synth`        | Synthesize CloudFormation (no deploy)                                   |
| `bun run deploy`       | Deploy stack (requires AWS credentials and `--context environment=...`) |
| `bun run diff`         | Show diff against deployed stack                                        |

`synth` runs **[cdk-nag](https://github.com/cdklabs/cdk-nag)** `AwsSolutionsChecks` from `bin/app.ts`. Documented suppressions are in `lib/helpers/nag.ts`. Verbose nag logging: `CDK_NAG_VERBOSE=1 bunx cdk synth ...`.

Merged `reimbursement-automation-stack-config.json` is validated with **Zod** (`lib/config/reimbursement-automation-stack-schema.ts`, strict top-level keys).

`stepFunction.tracingEnabled` defaults to `false` in `configs/default/reimbursement-automation-stack-config.json` (including the **pipeline** state machine). **`configs/dev/reimbursement-automation-stack-config.json`** and **`configs/staging/reimbursement-automation-stack-config.json`** set it to **`true`** so X-Ray can aid debugging; use `false` in prod if you prefer to avoid trace cost.

## Deploy locally

Fill in `cdk.json` → `context.environments.{dev|staging|prod}` with real `account` IDs. Optionally use the same `region` and `profile` (e.g. `default`, `staging`, `prod` for local AWS profiles).

Using account/region from cdk.json:

```bash
bun run build
bunx cdk deploy --all --context environment=dev --require-approval never
```

Using a specific profile (e.g. from cdk.json):

```bash
bunx cdk deploy --all --context environment=dev --profile default --require-approval never
```

Or set `CDK_DEFAULT_ACCOUNT` / `CDK_DEFAULT_REGION` (e.g. in CI) instead of context.

One-time bootstrap (per account/region):

```bash
bunx cdk bootstrap aws://ACCOUNT_ID/us-west-2
```

## Deployment from GitHub Actions

See [../docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md) for IAM user vs OIDC setup and required GitHub secrets.
