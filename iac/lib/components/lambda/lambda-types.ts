import type { Code } from 'aws-cdk-lib/aws-lambda';
import type { Config } from '../../config/config';

export interface LambdaProps {
  readonly config: Config;
}

export interface BuiltLambdaFunction {
  readonly name: string;
  readonly resourceName: string;
  readonly functionArn: string;
}

export interface FunctionBuildResult {
  readonly code: Code;
  readonly exists: boolean;
}
