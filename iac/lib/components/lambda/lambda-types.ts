import type { Config } from '../../config/config';

/**
 * Props for the Lambda component (aligned with Ad-Results pattern).
 */
export interface LambdaProps {
  config: Config;
}

/**
 * Built Lambda function info (for downstream constructs e.g. Step Function).
 */
export interface BuiltLambdaFunction {
  name: string;
  resourceName: string;
  functionArn: string;
}

/**
 * Function build result from LambdaBuilder.
 */
export interface FunctionBuildResult {
  code: import('aws-cdk-lib/aws-lambda').Code;
  exists: boolean;
}
