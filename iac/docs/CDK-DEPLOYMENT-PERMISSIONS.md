# CDK Deployment Permissions (CI/CD)

When the pipeline fails with:

- **"current credentials could not be used to assume '...cdk-hnb659fds-file-publishing-role...'"**
- **"Bucket named 'cdk-hnb659fds-assets-...' exists, but we dont have access to it"**

the IAM user/role used by the pipeline can deploy in the account but **cannot assume the CDK bootstrap roles** or use the CDK assets bucket. Fix it by giving the pipeline identity permission to assume those roles and by allowing those roles to be assumed by the pipeline.

---

## 1. Let the pipeline user assume the CDK roles

Attach an IAM policy to the **pipeline user** (e.g. `test-varun`) or to the role used by GitHub Actions.

**Policy name (example):** `CDKBootstrapAssumeRolePolicy`

**Policy document:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AssumeCDKDeployRole",
      "Effect": "Allow",
      "Action": "sts:AssumeRole",
      "Resource": "arn:aws:iam::503226040441:role/cdk-hnb659fds-deploy-role-503226040441-us-west-2"
    },
    {
      "Sid": "AssumeCDKFilePublishingRole",
      "Effect": "Allow",
      "Action": "sts:AssumeRole",
      "Resource": "arn:aws:iam::503226040441:role/cdk-hnb659fds-file-publishing-role-503226040441-us-west-2"
    }
  ]
}
```

- In **IAM** → **Users** → select the pipeline user → **Add permissions** → **Create inline policy** (or attach a customer-managed policy with the above).
- If the pipeline uses an **IAM role** (e.g. OIDC), attach this policy to that role instead.

---

## 2. Allow the CDK roles to be assumed by the pipeline user

The CDK bootstrap creates two roles. Each must **trust** the pipeline user (or role) so it can assume them.

### 2a. Trust policy on the **deploy** role

Role: `cdk-hnb659fds-deploy-role-503226040441-us-west-2`

In **IAM** → **Roles** → open that role → **Trust relationships** → **Edit**.

Ensure the trust policy includes the pipeline principal. If the pipeline uses IAM user `test-varun`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::503226040441:root"
      },
      "Action": "sts:AssumeRole"
    },
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::503226040441:user/test-varun"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

If the pipeline uses an **IAM role** (e.g. `GitHubActionsRole`), add:

```json
{
  "Effect": "Allow",
  "Principal": {
    "AWS": "arn:aws:iam::503226040441:role/GitHubActionsRole"
  },
  "Action": "sts:AssumeRole"
}
```

(Keep existing statements; add the one that matches your pipeline identity.)

### 2b. Trust policy on the **file-publishing** role

Role: `cdk-hnb659fds-file-publishing-role-503226040441-us-west-2`

Same idea: **Trust relationships** → **Edit** → add the pipeline user (or role) as above.

Example for user `test-varun`:

```json
{
  "Effect": "Allow",
  "Principal": {
    "AWS": "arn:aws:iam::503226040441:user/test-varun"
  },
  "Action": "sts:AssumeRole"
}
```

Again, keep any existing statements (e.g. `root`) and add this so the pipeline can assume the role.

---

## 3. CFN execution role missing permissions (Lambda, IAM, etc.)

If the stack fails with errors like:

- **"not authorized to perform: lambda:PublishLayerVersion"**
- **"not authorized to perform: iam:CreateRole"** / **"iam:DetachRolePolicy"**

then the **CFN execution role** (`cdk-hnb659fds-cfn-exec-role-503226040441-us-west-2`) does not have the permissions CloudFormation needs to create/update/delete your stack’s resources. This usually means the account was bootstrapped with an old template or the role’s policies were reduced.

**Fix:** Attach the following policy to the role **`cdk-hnb659fds-cfn-exec-role-503226040441-us-west-2`** (IAM → Roles → select that role → Add permissions → Create inline policy → JSON):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CDKBootstrapVersionRead",
      "Effect": "Allow",
      "Action": ["ssm:GetParameter", "ssm:GetParameters"],
      "Resource": "arn:aws:ssm:us-west-2:503226040441:parameter/cdk-bootstrap/*"
    },
    {
      "Sid": "LambdaAndLayer",
      "Effect": "Allow",
      "Action": [
        "lambda:PublishLayerVersion",
        "lambda:DeleteLayerVersion",
        "lambda:CreateFunction",
        "lambda:DeleteFunction",
        "lambda:GetFunction",
        "lambda:UpdateFunctionCode",
        "lambda:UpdateFunctionConfiguration",
        "lambda:AddPermission",
        "lambda:RemovePermission",
        "lambda:GetPolicy"
      ],
      "Resource": "*"
    },
    {
      "Sid": "IamRolesForLambda",
      "Effect": "Allow",
      "Action": [
        "iam:CreateRole",
        "iam:DeleteRole",
        "iam:GetRole",
        "iam:PassRole",
        "iam:PutRolePolicy",
        "iam:AttachRolePolicy",
        "iam:DetachRolePolicy",
        "iam:DeleteRolePolicy",
        "iam:ListRolePolicies",
        "iam:ListAttachedRolePolicies",
        "iam:TagRole",
        "iam:UntagRole",
        "iam:ListRoleTags",
        "iam:UpdateAssumeRolePolicy"
      ],
      "Resource": "*"
    }
  ]
}
```

Replace `503226040441` and `us-west-2` in the SSM resource if your account/region differ. After attaching, wait a short time and redeploy (after cleaning up any failed stack — see below).

**Best long-term fix:** Run **`cdk bootstrap aws://503226040441/us-west-2`** with an IAM identity that has **AdministratorAccess** (or at least full CloudFormation, IAM, Lambda, SSM). That updates the bootstrap stack and refreshes the CFN exec role’s policies to match the current CDK version.

---

## 3b. Give CFN execution role full admin (all services)

If your CDK stacks will create **many kinds of resources** (Lambda, API Gateway, DynamoDB, SQS, SNS, Step Functions, EventBridge, etc.) and you want to avoid permission errors, you can grant the CFN execution role **full account access** so CloudFormation can create and manage anything.

**Steps:**

1. IAM → **Roles** → open **`cdk-hnb659fds-cfn-exec-role-503226040441-us-west-2`**.
2. **Add permissions** → **Attach policies**.
3. Search for and select the AWS managed policy **`AdministratorAccess`**.
4. **Add permissions** (attach).

Only **CloudFormation** can assume this role (via the bootstrap trust policy). So the role is used only when a CDK/CloudFormation deployment runs. Anyone who can trigger a deploy (e.g. your pipeline user) can then cause creation of any resource in the account—so use this in dev/test or in prod only if you’re comfortable with that.

**When to use:**

- **Use AdministratorAccess on the CFN exec role** when you want CDK to be able to create any AWS resource without hitting permission errors (good for dev/staging or small teams).
- **Use the minimal policy in section 3** when you want to limit what stacks can create (e.g. prod with stricter security).

---

## 4. Cleanup after a failed deploy (ROLLBACK_FAILED)

If the stack is in **ROLLBACK_FAILED** because the CFN exec role could not delete an IAM role:

1. **Fix the CFN exec role** (add the policy in section 3 above) so it has `iam:DetachRolePolicy`, `iam:DeleteRolePolicy`, `iam:DeleteRole`.
2. In **CloudFormation** in the AWS console, open the stack **ReimbursementStack-dev** → **Stack actions** → **Continue update rollback** (or delete the stack if you prefer to start fresh).
3. If rollback still fails, delete the stuck IAM role manually: IAM → Roles → find **ReimbursementStack-dev-LambdatestlambdaServiceRole8-...** → Delete (you may need to detach policies from the role first).
4. Then delete the CloudFormation stack **ReimbursementStack-dev** if it is still present.
5. Fix the CFN exec role permissions (section 3), then run the pipeline again.

---

## 5. (Optional) Re-bootstrap

The CLI may warn that the bootstrap stack is outdated. After the pipeline can assume the roles and the deploy succeeds, you can update the bootstrap (run with credentials that have admin or bootstrap permissions):

```bash
cd iac
npx cdk bootstrap aws://503226040441/us-west-2
```

Use an IAM user/role that has **AdministratorAccess** (or equivalent) so the bootstrap stack and CFN exec role are fully updated.

---

## Summary

| Step | Where                                    | What                                                                                                                 |
| ---- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 1    | Pipeline user/role                       | Attach policy that allows `sts:AssumeRole` on the two CDK bootstrap roles.                                           |
| 2    | `cdk-hnb659fds-deploy-role-...`          | Trust policy: add pipeline user or role as principal.                                                                |
| 3    | `cdk-hnb659fds-file-publishing-role-...` | Trust policy: add pipeline user or role as principal.                                                                |
| 4    | `cdk-hnb659fds-cfn-exec-role-...`        | Attach policy for SSM, Lambda, IAM (section 3), **or** attach **AdministratorAccess** (section 3b) for all services. |
| 5    | (Optional)                               | Run `cdk bootstrap aws://503226040441/us-west-2` with admin to refresh bootstrap and CFN exec role.                  |

After steps 1–4, re-run the CD pipeline. If the stack is in ROLLBACK_FAILED, follow section 4 to clean up first.
