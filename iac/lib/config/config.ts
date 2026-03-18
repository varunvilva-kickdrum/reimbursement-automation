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

export interface StepFunctionConfig {
  readonly enabled: boolean;
}

export interface ReimbursementStackConfig {
  readonly lambda: LambdaConfig;
  readonly stepFunction?: StepFunctionConfig;
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
