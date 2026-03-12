/**
 * Configuration types for the reimbursement pipeline.
 * Environment-specific overrides are merged over default (see get-config).
 */

export enum EnvironmentType {
  prod = 'prod',
  dev = 'dev',
  staging = 'staging',
}

/** Lambda function entry: folder name under functionsPath (e.g. test_lambda). */
export interface LambdaFunctionConfig {
  name: string;
  timeout?: number;
  memorySize?: number;
  /** Only create this function when enabled (per-env override). */
  enabled?: boolean;
}

/** Lambda section of stack config. */
export interface LambdaConfig {
  /** Path to folder containing *_lambda directories (relative to repo root). */
  functionsPath: string;
  /** Build/cache directory for assets (e.g. .build). */
  buildDirectory: string;
  defaultTimeout: number;
  defaultMemorySize: number;
  /** List of Lambda functions (folder names). Can be overridden per env. */
  functions: LambdaFunctionConfig[];
}

/** Step Function: optional, can be enabled only in some environments. */
export interface StepFunctionConfig {
  enabled: boolean;
}

/** Reimbursement stack config (default + env merge). */
export interface ReimbursementStackConfig {
  lambda: LambdaConfig;
  stepFunction?: StepFunctionConfig;
  /** Optional tags applied to all resources. Merged with default tags (Environment, Project, etc.). */
  tags?: Record<string, string>;
}

/** Common config from CDK context (environment, account, region). */
export interface CommonConfig {
  region: string;
  environment: EnvironmentType;
  account: string;
}

/** Full config passed to the stack. */
export interface Config extends CommonConfig {
  stack: ReimbursementStackConfig;
}

export enum ConfigFileName {
  REIMBURSEMENT_STACK = 'reimbursementStackConfig.json',
}

export enum ConfigDirectory {
  DEFAULT = 'default',
}
