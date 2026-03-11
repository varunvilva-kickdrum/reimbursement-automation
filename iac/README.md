# Reimbursement IAC (CDK)

AWS CDK (TypeScript) for the reimbursement pipeline. Deploys the Hello World Lambda and can be extended with more stacks/constructs.

## Structure

- **`bin/app.ts`** — CDK app entry; reads `environment` from context (dev | staging | prod).
- **`lib/stacks/`** — Stacks (e.g. `ReimbursementStack`).
- **`lib/components/`** — Components (e.g. Lambda); **`lib/helpers/`** — Helpers (e.g. lambda-builder).
- **`cdk.json`** — CDK CLI config; app runs compiled `dist/bin/app.js`. Context includes `environments.dev|staging|prod` with `account`, `region`, and `profile` (like Ad-Results Media).

## Commands

| Command          | Description                                                             |
| ---------------- | ----------------------------------------------------------------------- |
| `bun run build`  | Compile TypeScript to `dist/`                                           |
| `bun run synth`  | Synthesize CloudFormation (no deploy)                                   |
| `bun run deploy` | Deploy stack (requires AWS credentials and `--context environment=...`) |
| `bun run diff`   | Show diff against deployed stack                                        |

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
