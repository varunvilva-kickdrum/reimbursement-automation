import type { EnvironmentType } from '../../enums';

export interface LambdaFunctionConfig {
  readonly name: string;
  readonly timeout?: number;
  readonly memorySize?: number;
  readonly enabled?: boolean;
}

export interface LambdaConfig {
  readonly functionsPath: string;
  readonly buildDirectory: string;
  readonly defaultTimeout: number;
  readonly defaultMemorySize: number;
  readonly functions: readonly LambdaFunctionConfig[];
}

export enum RemovalPolicyType {
  Destroy = 'destroy',
  Retain = 'retain',
}

export interface S3BucketStackConfig {
  readonly name: string;
  readonly versioned?: boolean;
}

export interface S3StackConfig {
  readonly buckets: readonly S3BucketStackConfig[];
}

export interface DynamoDbLockTableConfig {
  readonly name: string;
  readonly partitionKeyName?: string;
  readonly ttlAttributeName?: string;
}

export interface DynamoDbStackConfig {
  readonly lockTable: DynamoDbLockTableConfig;
}

export interface SecretsStackConfig {
  readonly enabled?: boolean;
}

export interface StateMachineStackConfig {
  readonly name: string;
  readonly enabled?: boolean;
  readonly description?: string;
}

export interface StepFunctionStackConfig {
  readonly enabled: boolean;
  /** Path segment relative to the iac/ root (e.g. templates/step-functions). */
  readonly templatePath: string;
  readonly tracingEnabled?: boolean;
  readonly stateMachines: readonly StateMachineStackConfig[];
}

export type EventBridgeScheduleTargetType = 'LAMBDA' | 'STEP_FUNCTION';

export interface EventBridgeScheduleStackConfig {
  readonly id: string;
  readonly enabled: boolean;
  readonly scheduleExpression: string;
  readonly targetType: EventBridgeScheduleTargetType;
  readonly lambdaFunctionName?: string;
  readonly stateMachineName?: string;
}

export interface EventBridgeStackConfig {
  readonly enabled: boolean;
  readonly schedules: readonly EventBridgeScheduleStackConfig[];
}

export interface ReimbursementStackConfig {
  readonly removalPolicy?: RemovalPolicyType;
  readonly lambda: LambdaConfig;
  readonly s3: S3StackConfig;
  readonly dynamodb: DynamoDbStackConfig;
  readonly secrets?: SecretsStackConfig;
  readonly stepFunction: StepFunctionStackConfig;
  readonly eventBridge?: EventBridgeStackConfig;
  readonly tags?: Readonly<Record<string, string>>;
}

export interface CommonConfig {
  readonly region: string;
  readonly environment: EnvironmentType;
  readonly account: string;
}

export interface Config extends CommonConfig {
  readonly stack: ReimbursementStackConfig;
}
