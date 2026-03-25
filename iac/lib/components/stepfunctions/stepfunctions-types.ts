import type { StateMachine } from 'aws-cdk-lib/aws-stepfunctions';
import type { Config } from '../../config/config';
import type { Iam } from '../iam/iam';

export interface StepFunctionsProps {
  readonly config: Config;
  readonly iam: Iam;
  readonly resolvedTemplateDir: string;
}

export interface StateMachineInfo {
  readonly name: string;
  readonly arn: string;
  readonly stateMachine: StateMachine;
}
