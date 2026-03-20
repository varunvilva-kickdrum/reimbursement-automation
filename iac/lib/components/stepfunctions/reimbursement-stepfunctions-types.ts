import type { StateMachine } from 'aws-cdk-lib/aws-stepfunctions';
import type { Config } from '../../config/config';
import type { ReimbursementIam } from '../iam/reimbursement-iam';

export interface ReimbursementStepFunctionsProps {
  readonly config: Config;
  readonly iam: ReimbursementIam;
  readonly resolvedTemplateDir: string;
}

export interface StateMachineInfo {
  readonly name: string;
  readonly arn: string;
  readonly stateMachine: StateMachine;
}
