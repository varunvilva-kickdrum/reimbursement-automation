# Deployment & GitHub Actions CD

The CD pipeline (`.github/workflows/deploy.yml`) deploys the **reimbursement-automation** stack to AWS when you push to `dev` or `staging`, or when you run the workflow manually for `production`. For GitHub Actions to deploy, it needs **credentials to assume an IAM role or use an IAM user** in your AWS account.

---

## What to configure in GitHub for CD

| Where                                          | What to add                                                                                                          |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Settings → Secrets and variables → Actions** | Repository secrets (or environment-specific secrets; see below).                                                     |
| **Settings → Environments** (optional)         | Create environments `dev`, `staging`, `production` so you can use environment-specific secrets and protection rules. |

### Secrets required (repository secrets)

For **dev** (push to `dev`), the workflow’s **Configure AWS credentials** step uses the GitHub **environment** `dev` and expects:

| Secret name                  | Description                    |
| ---------------------------- | ------------------------------ |
| `AWS_ACCESS_KEY_ID_DEV`      | IAM user access key ID.        |
| `AWS_SECRET_ACCESS_KEY_DEV`  | IAM user secret access key.    |

Configure these under **Settings → Environments → dev → Environment secrets** (or equivalent for your org). Staging and production use `AWS_ACCESS_KEY_ID_STAGING` / `AWS_SECRET_ACCESS_KEY_STAGING` and `AWS_ACCESS_KEY_ID_PROD` / `AWS_SECRET_ACCESS_KEY_PROD` respectively.

### Application secrets (AWS Secrets Manager)

CDK creates a secret named `{environment}-reimbursement-automation-secrets` with **placeholder** values. After each deploy, `.github/workflows/deploy.yml` runs `.github/scripts/populate-secrets.js`, which reads `iac/configs/secrets/secrets-config.json` (and optional `{environment}-secrets-config.json` overrides), maps each entry to a GitHub Actions environment variable, and calls `aws secretsmanager put-secret-value`.

| GitHub secret (examples)                   | Used for                                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------- |
| `REIMBURSEMENT_AUTOMATION_API_KEY_DEV`     | Dev: `REIMBURSEMENT_AUTOMATION_API_KEY` in `secrets-config.json`        |
| `REIMBURSEMENT_AUTOMATION_API_KEY_STAGING` | Staging                                                                  |
| `REIMBURSEMENT_AUTOMATION_API_KEY_PROD`    | Production                                                               |

Extend `iac/configs/secrets/secrets-config.json` and mirror new keys in `iac/enums/environment-vars.ts` so CDK validation stays in sync. For **local synth/deploy without real secrets**, placeholders from CDK are enough; real values are only pushed from CI.

**Disable** the managed secret for sandbox stacks via `"secrets": { "enabled": false }` in `reimbursement-automation-stack-config.json` (skips reading secrets JSON and creating the secret).

### One-time: CDK bootstrap

In each AWS account/region you deploy to, run once (with credentials that can create the bootstrap stack). Get your account ID from the AWS console or run `aws sts get-caller-identity`:

```bash
cd iac && bun install && bun run build && bun run cdk bootstrap aws://YOUR_ACCOUNT_ID/us-west-2
```

---

## Option A: IAM user + access keys (current setup)

How it works today: the workflow uses **long‑lived access keys** stored as GitHub secrets.

### 1. Create an IAM user for deployments

In AWS IAM:

1. Create a user, e.g. `github-actions-reimbursement`.
2. Attach a policy that allows CDK deploy (and bootstrap) and Lambda. Example minimal policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudformation:*",
        "iam:*",
        "lambda:*",
        "s3:*",
        "sts:*",
        "dynamodb:*",
        "secretsmanager:*",
        "states:*",
        "events:*",
        "scheduler:*"
      ],
      "Resource": "*"
    }
  ]
}
```

For production, scope this down (e.g. limit to specific buckets, roles, and Lambda ARNs).

3. Create **Access key** for the user (programmatic access).

### 2. Add GitHub secrets

In the repo: **Settings → Secrets and variables → Actions**.

- For **dev**: create environment `dev` (or use repo-level secrets) and add:
  - `AWS_ACCESS_KEY_ID_DEV` = access key ID
  - `AWS_SECRET_ACCESS_KEY_DEV` = secret access key
  - `AWS_ACCOUNT_ID_DEV` = your AWS account ID (12 digits)

- Repeat for **staging** and **production** with `*_STAGING` and `*_PROD` secrets if you use separate environments/accounts.

The workflow uses these in “Configure AWS credentials” and sets `CDK_DEFAULT_ACCOUNT` / `CDK_DEFAULT_REGION` for CDK.

**IAC CI** (`.github/workflows/ci.yml`) runs `lint`, `format:check`, `build`, and a pinned **`bunx aws-cdk@… synth`** (see `iac/package.json` → `aws-cdk`) so the CLI understands the **cloud assembly** format produced by the repo’s `aws-cdk-lib`. **Deploy** jobs use the same pinned CLI for `deploy`.

### 3. Bootstrap CDK (one-time per account/region)

From your machine (or a one-off job) with AWS credentials configured:

```bash
cd iac
bun install
bun run build
bun run cdk bootstrap aws://ACCOUNT_ID/us-west-2
```

Replace `ACCOUNT_ID` with the same value as `AWS_ACCOUNT_ID_*`. After that, the GitHub Actions deploy step can run `cdk deploy` successfully.

---

## Option B: OIDC (no long-lived keys)

GitHub can assume an **IAM role** using OIDC, so you don’t store access keys in GitHub.

### 1. Add GitHub OIDC provider in AWS

Use the AWS console or CloudFormation to add the GitHub OIDC identity provider (e.g. `token.actions.githubusercontent.com`). Many docs and Terraform/CDK examples exist for “GitHub Actions OIDC AWS”.

### 2. Create an IAM role for the repo

Create a role that:

- **Trust policy**: allow `token.actions.githubusercontent.com` to assume the role when the subject (repo, branch, etc.) matches your repo, e.g. `varunvilva-kickdrum/reimbursement-automation`.
- **Permissions**: same as in Option A (CloudFormation, IAM, Lambda, S3, STS as needed for CDK).

### 3. Change the workflow to use the role

Replace the “Configure AWS credentials” step with something like:

```yaml
- name: Configure AWS credentials
  uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: arn:aws:iam::ACCOUNT_ID:role/github-actions-reimbursement
    aws-region: us-west-2
```

And add permissions for the job so GitHub can request an OIDC token:

```yaml
jobs:
  deploy_dev:
    permissions:
      id-token: write
      contents: read
    # ... rest unchanged
```

No `AWS_ACCESS_KEY_ID_*` or `AWS_SECRET_ACCESS_KEY_*` secrets are needed; the role’s permissions are used for the deploy.

---

## Summary

| Method          | Pros                                    | Cons                                    |
| --------------- | --------------------------------------- | --------------------------------------- |
| **A: IAM user** | Simple, works with current workflow     | Long-lived keys; must rotate and secure |
| **B: OIDC**     | No stored keys; short-lived credentials | One-time setup of OIDC provider + role  |

You do need **some** IAM identity (user or role) that has permission to run CDK deploy and to create/update the Lambda and related resources. Option A uses an IAM user and keys in GitHub secrets; Option B uses an IAM role and GitHub OIDC so Actions assume the role with no keys.
