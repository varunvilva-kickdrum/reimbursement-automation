/**
 * Statement IDs on the Step Functions execution role (stable for audits / nag suppressions).
 */
export const StepFunctionsExecutionPolicySid = {
  InvokeLambdas: 'InvokeReimbursementAutomationLambdas',
  XRay: 'XRayTracing',
  LogsDelivery: 'CloudWatchLogsStepFunctions',
} as const;

/**
 * X-Ray and Step Functions log-delivery / DescribeLogGroups APIs are not grantable on specific ARNs;
 * AWS documents wildcard resource for these control-plane style permissions.
 */
export const StepFunctionsSupportingServiceWildcardResource = '*' as const;
