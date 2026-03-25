import { Duration } from 'aws-cdk-lib';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';

export const LambdaHandler = {
  ModuleDotHandler: 'handler.lambda_handler',
} as const;

export const LambdaLayer = {
  Description: 'Shared Python code for all Lambdas',
} as const;

export const LambdaRuntimeConfig = {
  Runtime: Runtime.PYTHON_3_12,
  Architecture: Architecture.X86_64,
  DefaultTimeoutSeconds: 30,
  DefaultMemoryMb: 128,
} as const;

export const LambdaBuildDirectoryName = {
  FunctionBuilds: 'function-builds',
  LayerBuilds: 'layer-builds',
} as const;

export const LambdaBuild = {
  LayerOutputDirPrefix: 'shared-layer-',
  SharedLayerExpectedHint: 'lambda/shared/python/',
  CleanupDelayMs: 5000,
  ContentHashAlgorithm: 'sha256',
  ContentHashHexLength: 8,
  ContentHashEntrySeparator: ':',
} as const;

export const LambdaAssetPayload = {
  Exists: true,
} as const;

export const LambdaDefaultDuration = Duration.seconds(LambdaRuntimeConfig.DefaultTimeoutSeconds);

export const lambdaRuntimeBundle = {
  handler: LambdaHandler.ModuleDotHandler,
  runtime: LambdaRuntimeConfig.Runtime,
  architecture: LambdaRuntimeConfig.Architecture,
  defaultTimeout: LambdaDefaultDuration,
  defaultMemory: LambdaRuntimeConfig.DefaultMemoryMb,
  buildDirs: LambdaBuildDirectoryName,
} as const;
