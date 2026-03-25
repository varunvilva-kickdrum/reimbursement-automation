import type { EnvironmentType } from '../../enums';
import type { ReimbursementStackConfig } from './reimbursement-automation-stack-schema';

export type LambdaFunctionConfig = ReimbursementStackConfig['lambda']['functions'][number];

export type LambdaConfig = ReimbursementStackConfig['lambda'];

export enum RemovalPolicyType {
  Destroy = 'destroy',
  Retain = 'retain',
}

export interface S3BucketStackConfig {
  readonly name: string;
  readonly versioned?: boolean;
}

export type S3StackConfig = ReimbursementStackConfig['s3'];

export type DynamoDbLockTableConfig = ReimbursementStackConfig['dynamodb']['lockTable'];

export type DynamoDbStackConfig = ReimbursementStackConfig['dynamodb'];

export type SecretsStackConfig = NonNullable<ReimbursementStackConfig['secrets']>;

export type StateMachineStackConfig =
  ReimbursementStackConfig['stepFunction']['stateMachines'][number];

export type StepFunctionStackConfig = ReimbursementStackConfig['stepFunction'];

export type EventBridgeScheduleTargetType = 'LAMBDA' | 'STEP_FUNCTION';

export interface EventBridgeScheduleBaseConfig {
  readonly id: string;
  readonly enabled: boolean;
  readonly scheduleExpression: string;
}

export interface EventBridgeLambdaScheduleConfig extends EventBridgeScheduleBaseConfig {
  readonly targetType: 'LAMBDA';
  readonly lambdaFunctionName: string;
}

export interface EventBridgeStepFunctionScheduleConfig extends EventBridgeScheduleBaseConfig {
  readonly targetType: 'STEP_FUNCTION';
  readonly stateMachineName: string;
}

export type EventBridgeScheduleStackConfig =
  | EventBridgeLambdaScheduleConfig
  | EventBridgeStepFunctionScheduleConfig;

export type EventBridgeStackConfig = NonNullable<ReimbursementStackConfig['eventBridge']>;

export type { ReimbursementStackConfig };

export interface CommonConfig {
  readonly region: string;
  readonly environment: EnvironmentType;
  readonly account: string;
}

export interface Config extends CommonConfig {
  readonly stack: ReimbursementStackConfig;
}
