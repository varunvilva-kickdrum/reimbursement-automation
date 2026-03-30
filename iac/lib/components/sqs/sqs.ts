import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import { Queue, QueueEncryption } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import { ResourceName } from '../../../constants';
import type { Config } from '../../config/config';
import { RemovalPolicyType } from '../../config/config';
import { getResourceName } from '../../config/global-config';

export interface SqsProps {
  readonly config: Config;
}

export class Sqs extends Construct {
  readonly queue: Queue;
  readonly dlq?: Queue;

  constructor(scope: Construct, id: string, props: SqsProps) {
    super(scope, id);

    const { config } = props;
    const sqsConfig = config.stack.sqs;

    if (!sqsConfig?.enabled) {
      throw new Error('Sqs construct instantiated but sqs.enabled is false or missing');
    }

    const removal =
      config.stack.removalPolicy === RemovalPolicyType.Retain
        ? RemovalPolicy.RETAIN
        : RemovalPolicy.DESTROY;

    if (sqsConfig.dlqEnabled) {
      this.dlq = new Queue(this, 'WebhookDlq', {
        queueName: getResourceName(ResourceName.WebhookDlq, config),
        encryption: QueueEncryption.SQS_MANAGED,
        retentionPeriod: Duration.days(14),
        removalPolicy: removal,
        enforceSSL: true,
      });
    }

    this.queue = new Queue(this, 'WebhookQueue', {
      queueName: getResourceName(sqsConfig.queueName, config),
      encryption: QueueEncryption.SQS_MANAGED,
      visibilityTimeout: Duration.seconds(300),
      retentionPeriod: Duration.days(7),
      removalPolicy: removal,
      enforceSSL: true,
      deadLetterQueue: this.dlq ? { queue: this.dlq, maxReceiveCount: 3 } : undefined,
    });
  }
}
