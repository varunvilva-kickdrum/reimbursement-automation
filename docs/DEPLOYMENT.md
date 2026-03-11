# Deployment & GitHub Actions CD

The CD pipeline (`.github/workflows/deploy.yml`) deploys the reimbursement stack to AWS when you push to `dev` or `staging`, or when you run the workflow manually for `production`. For GitHub Actions to deploy, it needs **credentials to assume an IAM role or use an IAM user** in your AWS account.

---

## What to configure in GitHub for CD

| Where | What to add |
|-------|-------------|
| **Settings → Secrets and variables → Actions** | Repository secrets (or environment-specific secrets; see below). |
| **Settings → Environments** (optional) | Create environments `dev`, `staging`, `production` so you can use environment-specific secrets and protection rules. |

### Secrets required per environment

For each environment you deploy to, the workflow expects these **secrets** (use repo secrets or environment secrets):

| Secret name | Description |
|-------------|-------------|
| `AWS_ACCESS_KEY_ID_DEV` | IAM user access key ID (dev). |
| `AWS_SECRET_ACCESS_KEY_DEV` | IAM user secret access key (dev). |
| `AWS_ACCOUNT_ID_DEV` | AWS account ID, 12 digits (dev). |
| `AWS_ACCESS_KEY_ID_STAGING` | Same for staging. |
| `AWS_SECRET_ACCESS_KEY_STAGING` | Same for staging. |
| `AWS_ACCOUNT_ID_STAGING` | Same for staging. |
| `AWS_ACCESS_KEY_ID_PROD` | Same for production. |
| `AWS_SECRET_ACCESS_KEY_PROD` | Same for production. |
| `AWS_ACCOUNT_ID_PROD` | Same for production. |

- **Dev**: used when the workflow runs on the `dev` branch.
- **Staging**: used when the workflow runs on the `staging` branch.
- **Production**: used when you trigger the workflow manually and choose `production`.

If you use **GitHub Environments** (`dev`, `staging`, `production`), add the three secrets for that environment in **Settings → Environments → &lt;env&gt; → Environment secrets**. Otherwise, add them as **Repository secrets** with the names above.

### One-time: CDK bootstrap

In each AWS account/region you deploy to, run once (with credentials that can create the bootstrap stack):

```bash
cd iac && bun run build && bunx cdk bootstrap aws://ACCOUNT_ID/us-west-2
```

Use the same `ACCOUNT_ID` as the corresponding `AWS_ACCOUNT_ID_*` secret.

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
        "sts:*"
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

### 3. Bootstrap CDK (one-time per account/region)

From your machine (or a one-off job) with AWS credentials configured:

```bash
cd iac
bun run build
bunx cdk bootstrap aws://ACCOUNT_ID/us-west-2
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

| Method        | Pros                          | Cons                         |
|---------------|-------------------------------|------------------------------|
| **A: IAM user** | Simple, works with current workflow | Long-lived keys; must rotate and secure |
| **B: OIDC**     | No stored keys; short-lived credentials | One-time setup of OIDC provider + role |

You do need **some** IAM identity (user or role) that has permission to run CDK deploy and to create/update the Lambda and related resources. Option A uses an IAM user and keys in GitHub secrets; Option B uses an IAM role and GitHub OIDC so Actions assume the role with no keys.
