import { CfnOutput, RemovalPolicy } from 'aws-cdk-lib';
import { AttributeType, BillingMode, Table, TableEncryption } from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import type { Config } from '../../config/config';
import { RemovalPolicyType } from '../../config/config';
import { getResourceName } from '../../config/global-config';

export interface ReimbursementDynamoDBProps {
  readonly config: Config;
}

export interface LockTableInfo {
  readonly table: Table;
  readonly tableName: string;
  readonly tableArn: string;
}

export class ReimbursementDynamoDB extends Construct {
  readonly lockTable: LockTableInfo;

  constructor(scope: Construct, id: string, props: ReimbursementDynamoDBProps) {
    super(scope, id);

    const { config } = props;
    const lock = config.stack.dynamodb.lockTable;
    const tableName = getResourceName(lock.name, config);
    const partitionKey = lock.partitionKeyName ?? 'lock_key';
    const ttl = lock.ttlAttributeName ?? 'ttl';

    const table = new Table(this, 'LockTable', {
      tableName,
      partitionKey: { name: partitionKey, type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      encryption: TableEncryption.AWS_MANAGED,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy:
        config.stack.removalPolicy === RemovalPolicyType.Retain
          ? RemovalPolicy.RETAIN
          : RemovalPolicy.DESTROY,
      timeToLiveAttribute: ttl,
    });

    this.lockTable = {
      table,
      tableName: table.tableName,
      tableArn: table.tableArn,
    };

    const exportPrefix = getResourceName(lock.name, config);
    new CfnOutput(this, 'LockTableName', {
      value: table.tableName,
      description: 'DynamoDB lock / idempotency table name',
      exportName: `${exportPrefix}-name`,
    });
    new CfnOutput(this, 'LockTableArn', {
      value: table.tableArn,
      description: 'DynamoDB lock table ARN',
      exportName: `${exportPrefix}-arn`,
    });
  }
}
