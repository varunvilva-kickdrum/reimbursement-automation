import type { Stack } from 'aws-cdk-lib';
import { NagSuppressions } from 'cdk-nag';

/**
 * Documented suppressions for AwsSolutionsChecks. Prefer fixing the underlying finding;
 * add new entries only with a reason tied to AWS docs or accepted risk.
 */
export function applyReimbursementAutomationNagSuppressions(stack: Stack): void {
  NagSuppressions.addStackSuppressions(stack, [
    {
      id: 'AwsSolutions-IAM4',
      reason:
        'Lambda execution and custom-resource provider roles use AWS managed AWSLambdaBasicExecutionRole for CloudWatch Logs.',
    },
    {
      id: 'AwsSolutions-IAM5',
      reason:
        'Step Functions X-Ray and log-delivery actions require Resource *; Lambda invoke is scoped to env-reimbursement-automation-*; S3 grants use bucket-scoped ARNs on function roles.',
    },
    {
      id: 'AwsSolutions-L1',
      reason:
        'Custom resource provider Lambda uses CDK default Node runtime for S3 auto-delete; controlled by AWS-maintained construct.',
    },
    {
      id: 'AwsSolutions-S1',
      reason: 'Data bucket uses SSE-S3 (AES256); block public access enabled for the use case.',
    },
    {
      id: 'AwsSolutions-SF1',
      reason:
        'Step Functions standard logging to CloudWatch can be enabled later when a log group ARN is fixed in stack.',
    },
    {
      id: 'AwsSolutions-SF2',
      reason: 'X-Ray tracing on state machines is optional via stack config (tracingEnabled).',
    },
    {
      id: 'AwsSolutions-SMG4',
      reason:
        'Rotation not configured on application JSON secret; values updated via CI (populate-secrets) rather than automatic rotation.',
    },
  ]);
}
