import { CfnOutput, RemovalPolicy } from 'aws-cdk-lib';
import { AttributeType, BillingMode, Table, TableEncryption } from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import type { Config } from '../../config/config';
import { RemovalPolicyType } from '../../config/config';
import { getResourceName } from '../../config/global-config';

export interface DynamoDBProps {
  readonly config: Config;
}

export interface TableInfo {
  readonly table: Table;
  readonly tableName: string;
  readonly tableArn: string;
}

export class DynamoDB extends Construct {
  readonly lockTable: TableInfo;
  readonly claimsTable?: TableInfo;

  constructor(scope: Construct, id: string, props: DynamoDBProps) {
    super(scope, id);

    const { config } = props;
    const removal =
      config.stack.removalPolicy === RemovalPolicyType.Retain
        ? RemovalPolicy.RETAIN
        : RemovalPolicy.DESTROY;

    this.lockTable = this.createLockTable(config, removal);
    this.claimsTable = this.createClaimsTable(config, removal);
  }

  private createLockTable(config: Config, removal: RemovalPolicy): TableInfo {
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
      removalPolicy: removal,
      timeToLiveAttribute: ttl,
    });

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

    return { table, tableName: table.tableName, tableArn: table.tableArn };
  }

  private createClaimsTable(config: Config, removal: RemovalPolicy): TableInfo | undefined {
    const claims = config.stack.dynamodb.claimsTable;
    if (!claims) {
      return undefined;
    }

    const tableName = getResourceName(claims.name, config);
    const table = new Table(this, 'ClaimsTable', {
      tableName,
      partitionKey: { name: claims.partitionKeyName, type: AttributeType.STRING },
      sortKey: { name: claims.sortKeyName, type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      encryption: TableEncryption.AWS_MANAGED,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: removal,
    });

    const exportPrefix = getResourceName(claims.name, config);
    new CfnOutput(this, 'ClaimsTableName', {
      value: table.tableName,
      description: 'DynamoDB claims table name',
      exportName: `${exportPrefix}-name`,
    });
    new CfnOutput(this, 'ClaimsTableArn', {
      value: table.tableArn,
      description: 'DynamoDB claims table ARN',
      exportName: `${exportPrefix}-arn`,
    });

    return { table, tableName: table.tableName, tableArn: table.tableArn };
  }
}
