import type { Code } from 'aws-cdk-lib/aws-lambda';
import type { IRole } from 'aws-cdk-lib/aws-iam';
import type { Config } from '../../config/config';

export interface LambdaProps {
  readonly config: Config;
  /** Map of role slug (from config) to IAM Role; functions with a matching `role` config use this instead of CDK default. */
  readonly roleMap?: Map<string, IRole>;
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
