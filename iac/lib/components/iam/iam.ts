import { Effect, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import {
  StepFunctionsExecutionPolicySid,
  StepFunctionsSupportingServiceWildcardResource,
} from '../../../constants';
import type { Config } from '../../config/config';
import { getResourceName } from '../../config/global-config';

export interface IamProps {
  readonly config: Config;
}

export class Iam extends Construct {
  readonly stepFunctionExecutionRole: Role;

  constructor(scope: Construct, id: string, props: IamProps) {
    super(scope, id);

    const { config } = props;
    const prefix = getResourceName('', config);

    this.stepFunctionExecutionRole = new Role(this, 'StepFunctionExecutionRole', {
      assumedBy: new ServicePrincipal('states.amazonaws.com'),
      roleName: getResourceName('step-function-execution-role', config),
      description: `reimbursement-automation Step Functions execution role (${config.environment})`,
    });

    this.stepFunctionExecutionRole.addToPrincipalPolicy(
      new PolicyStatement({
        sid: StepFunctionsExecutionPolicySid.InvokeLambdas,
        effect: Effect.ALLOW,
        actions: ['lambda:InvokeFunction'],
        resources: [
          `arn:aws:lambda:${config.region}:${config.account}:function:${prefix}*`,
          `arn:aws:lambda:${config.region}:${config.account}:function:${prefix}*:*`,
        ],
      })
    );

    this.stepFunctionExecutionRole.addToPrincipalPolicy(
      new PolicyStatement({
        sid: StepFunctionsExecutionPolicySid.XRay,
        effect: Effect.ALLOW,
        actions: [
          'xray:PutTraceSegments',
          'xray:PutTelemetryRecords',
          'xray:GetSamplingRules',
          'xray:GetSamplingTargets',
        ],
        resources: [StepFunctionsSupportingServiceWildcardResource],
      })
    );

    this.stepFunctionExecutionRole.addToPrincipalPolicy(
      new PolicyStatement({
        sid: StepFunctionsExecutionPolicySid.LogsDelivery,
        effect: Effect.ALLOW,
        actions: [
          'logs:CreateLogDelivery',
          'logs:GetLogDelivery',
          'logs:UpdateLogDelivery',
          'logs:DeleteLogDelivery',
          'logs:ListLogDeliveries',
          'logs:PutResourcePolicy',
          'logs:DescribeResourcePolicies',
          'logs:DescribeLogGroups',
        ],
        resources: [StepFunctionsSupportingServiceWildcardResource],
      })
    );
  }
}
