import * as path from 'node:path';
import { CfnOutput, Stack, type StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ConstructId, PathSegment, RepoLayout, ResourceName } from '../../constants';
import { ReimbursementSchedules } from '../components/eventbridge/reimbursement-schedules';
import { ReimbursementDynamoDB } from '../components/dynamodb/reimbursement-dynamodb';
import { ReimbursementIam } from '../components/iam/reimbursement-iam';
import { Lambda } from '../components/lambda/lambda';
import { ReimbursementS3 } from '../components/s3/reimbursement-s3';
import { ReimbursementSecretsManager } from '../components/secrets-manager/secrets-manager';
import { ReimbursementStepFunctions } from '../components/stepfunctions/reimbursement-stepfunctions';
import type { Config } from '../config/config';
import { getResourceName } from '../config/global-config';

export interface ReimbursementStackProps extends StackProps {
  readonly config: Config;
  readonly baseConfigDir: string;
}

export class ReimbursementStack extends Stack {
  readonly lambda: Lambda;
  readonly iam: ReimbursementIam;
  readonly s3: ReimbursementS3;
  readonly dynamodb: ReimbursementDynamoDB;
  readonly secretsManager: ReimbursementSecretsManager;
  readonly stepFunctions: ReimbursementStepFunctions;
  readonly schedules: ReimbursementSchedules;

  constructor(scope: Construct, id: string, props: ReimbursementStackProps) {
    super(scope, id, {
      ...props,
      env: {
        account: props.config.account,
        region: props.config.region,
      },
    });

    const { config, baseConfigDir } = props;

    const repoRootSegments = Array.from(
      { length: PathSegment.ConfigToRepoDepth },
      () => PathSegment.Parent
    );
    const repoRoot = path.resolve(baseConfigDir, ...repoRootSegments);
    const resolvedFunctionsPath = path.join(repoRoot, config.stack.lambda.functionsPath);
    const resolvedSharedPath = path.join(
      path.dirname(resolvedFunctionsPath),
      RepoLayout.SharedCodeDirName
    );
    const resolvedBuildDir = path.join(repoRoot, config.stack.lambda.buildDirectory);
    const iacRoot = path.resolve(baseConfigDir, '..');
    const resolvedTemplateDir = path.join(iacRoot, config.stack.stepFunction.templatePath);

    const secretsEnabled = config.stack.secrets?.enabled !== false;

    this.iam = new ReimbursementIam(this, 'Iam', { config });
    this.s3 = new ReimbursementS3(this, 'S3', { config });
    this.dynamodb = new ReimbursementDynamoDB(this, 'DynamoDB', { config });
    this.secretsManager = new ReimbursementSecretsManager(this, 'Secrets', {
      config,
      baseConfigDir,
      enabled: secretsEnabled,
    });

    this.stepFunctions = new ReimbursementStepFunctions(this, 'StepFunctions', {
      config,
      iam: this.iam,
      resolvedTemplateDir,
    });

    this.lambda = new Lambda(this, ConstructId.Lambda, {
      config,
      resolvedFunctionsPath,
      resolvedSharedPath,
      resolvedBuildDir,
    });

    const fns = config.stack.lambda.functions.filter((f) => f.enabled !== false);
    for (const fnConfig of fns) {
      const fn = this.lambda.getLambdaFunction(fnConfig.name);
      for (const bucket of this.s3.buckets.values()) {
        bucket.grantReadWrite(fn);
      }
      this.dynamodb.lockTable.table.grantReadWriteData(fn);
      fn.addEnvironment('LOCK_TABLE_NAME', this.dynamodb.lockTable.tableName);
      const primary = config.stack.s3.buckets[0];
      if (primary) {
        const b = this.s3.getBucket(primary.name);
        if (b) {
          fn.addEnvironment('DATA_BUCKET_NAME', b.bucketName);
        }
      }
      const sec = this.secretsManager.secret;
      if (sec) {
        sec.grantRead(fn);
        fn.addEnvironment('SECRETS_ARN', sec.secretArn);
      }
    }

    this.schedules = new ReimbursementSchedules(this, 'EventBridgeSchedules', {
      config,
      lambda: this.lambda,
      stepFunctions: this.stepFunctions,
    });

    this.stepFunctions.stateMachines.forEach((info, name) => {
      const outputId = `${name
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join('')}Arn`;
      new CfnOutput(this, outputId, {
        value: info.arn,
        description: `Step Functions state machine ARN (${name})`,
        exportName: `${getResourceName(name, config)}-arn`,
      });
    });

    if (this.secretsManager.secret) {
      new CfnOutput(this, 'SecretsArn', {
        value: this.secretsManager.secret.secretArn,
        description: 'Application secrets ARN',
        exportName: `${getResourceName(ResourceName.Secrets, config)}-arn`,
      });
    }
  }
}
