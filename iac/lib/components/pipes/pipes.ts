import { CfnPipe } from 'aws-cdk-lib/aws-pipes';
import type { IRole } from 'aws-cdk-lib/aws-iam';
import type { IQueue } from 'aws-cdk-lib/aws-sqs';
import type { IStateMachine } from 'aws-cdk-lib/aws-stepfunctions';
import { Construct } from 'constructs';
import { ResourceName } from '../../../constants';
import type { Config } from '../../config/config';
import { getResourceName } from '../../config/global-config';

export interface PipesProps {
  readonly config: Config;
  readonly sourceQueue: IQueue;
  readonly targetStateMachine: IStateMachine;
  readonly role: IRole;
}

export class Pipes extends Construct {
  readonly pipe: CfnPipe;

  constructor(scope: Construct, id: string, props: PipesProps) {
    super(scope, id);

    const { config, sourceQueue, targetStateMachine, role } = props;

    this.pipe = new CfnPipe(this, 'WebhookPipe', {
      name: getResourceName(ResourceName.WebhookPipe, config),
      description: `reimbursement-automation webhook pipe (${config.environment})`,
      roleArn: role.roleArn,
      source: sourceQueue.queueArn,
      sourceParameters: {
        sqsQueueParameters: {
          batchSize: 1,
        },
      },
      target: targetStateMachine.stateMachineArn,
      targetParameters: {
        stepFunctionStateMachineParameters: {
          invocationType: 'FIRE_AND_FORGET',
        },
      },
    });
  }
}
