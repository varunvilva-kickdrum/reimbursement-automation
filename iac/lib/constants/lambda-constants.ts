import { Duration } from 'aws-cdk-lib';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';

export const DEFAULT_HANDLER = 'handler.lambda_handler';
export const DEFAULT_RUNTIME = Runtime.PYTHON_3_12;
export const DEFAULT_ARCHITECTURE = Architecture.X86_64;
export const DEFAULT_TIMEOUT = Duration.seconds(30);
export const DEFAULT_MEMORY = 128;

export const LambdaBuildDir = {
  FUNCTION_BUILD: 'function-builds',
} as const;

export const lambdaConstants = {
  DEFAULT_HANDLER,
  DEFAULT_RUNTIME,
  DEFAULT_ARCHITECTURE,
  DEFAULT_TIMEOUT,
  DEFAULT_MEMORY,
  BUILD_DIRS: LambdaBuildDir,
} as const;
