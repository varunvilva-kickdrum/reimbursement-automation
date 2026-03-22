import { Construct } from 'constructs';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { ResourceName } from '../../../constants';
import type { Config } from '../../config/config';
import { getResourceName } from '../../config/global-config';

export interface SnsProps {
  readonly config: Config;
}

export class Sns extends Construct {
  readonly topic: Topic;

  constructor(scope: Construct, id: string, props: SnsProps) {
    super(scope, id);

    const { config } = props;
    const snsConfig = config.stack.sns;

    if (!snsConfig?.enabled) {
      throw new Error('Sns construct instantiated but sns.enabled is false or missing');
    }

    this.topic = new Topic(this, 'NotificationTopic', {
      topicName: getResourceName(ResourceName.NotificationTopic, config),
      displayName: `reimbursement-automation notifications (${config.environment})`,
      enforceSSL: true,
    });
  }
}
