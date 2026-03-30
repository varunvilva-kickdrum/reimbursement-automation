/**
 * IAM role name slugs passed to getResourceName (become env-reimbursement-automation-{slug}).
 */
export const IamRoleSlug = {
  IngestionLambda: 'ingestion-lambda-role',
  ExtractionLambda: 'extraction-lambda-role',
  ValidationLambda: 'validation-lambda-role',
  ReportingLambda: 'reporting-lambda-role',
  NotificationLambda: 'notification-lambda-role',
  ConfigSyncLambda: 'config-sync-lambda-role',
  StepFunctionExecution: 'step-function-execution-role',
  EventBridgePipe: 'eventbridge-pipe-role',
  EventBridgeScheduler: 'eventbridge-scheduler-role',
  ApiGateway: 'api-gateway-role',
} as const;

/**
 * Stable statement IDs for IAM policies (audits, nag suppressions, readability).
 */
export const IamPolicySid = {
  S3RawReadWrite: 'S3RawReadWrite',
  S3RawRead: 'S3RawRead',
  S3ProcessedWrite: 'S3ProcessedWrite',
  S3ConfigReadWrite: 'S3ConfigReadWrite',
  S3ConfigRead: 'S3ConfigRead',
  S3ReportsWrite: 'S3ReportsWrite',
  DynamoDbClaimsReadWrite: 'DynamoDbClaimsReadWrite',
  DynamoDbClaimsRead: 'DynamoDbClaimsRead',
  SecretsRead: 'SecretsRead',
  SnsPublish: 'SnsPublish',
  SqsSendMessage: 'SqsSendMessage',
  SqsConsume: 'SqsConsume',
  StatesStartExecution: 'StatesStartExecution',
  LambdaInvoke: 'LambdaInvoke',
} as const;

/**
 * Reusable IAM action arrays scoped to specific AWS services.
 */
export const S3ReadActions = ['s3:GetObject', 's3:GetObjectVersion'] as const;

export const S3WriteActions = ['s3:PutObject', 's3:DeleteObject'] as const;

export const S3ReadWriteActions = [...S3ReadActions, ...S3WriteActions] as const;

export const DynamoDbReadActions = [
  'dynamodb:GetItem',
  'dynamodb:Query',
  'dynamodb:Scan',
  'dynamodb:BatchGetItem',
] as const;

export const DynamoDbWriteActions = [
  'dynamodb:PutItem',
  'dynamodb:UpdateItem',
  'dynamodb:DeleteItem',
  'dynamodb:BatchWriteItem',
] as const;

export const DynamoDbReadWriteActions = [...DynamoDbReadActions, ...DynamoDbWriteActions] as const;

export const SqsConsumeActions = [
  'sqs:ReceiveMessage',
  'sqs:DeleteMessage',
  'sqs:GetQueueAttributes',
] as const;

export const SqsSendActions = ['sqs:SendMessage'] as const;

export const SnsPublishActions = ['sns:Publish'] as const;

/**
 * S3 key prefixes used to scope IAM policies to specific data partitions within the single data bucket.
 */
export const S3Prefix = {
  Raw: 'raw/*',
  Processed: 'processed/*',
  Config: 'config/*',
  Reports: 'reports/*',
} as const;
