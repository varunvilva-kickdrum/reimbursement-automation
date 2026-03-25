import * as path from 'node:path';
import { CfnOutput, Stack, type StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ConstructId, PathSegment, RepoLayout, ResourceName } from '../../constants';
import { Schedules } from '../components/eventbridge/schedules';
import { DynamoDB } from '../components/dynamodb/dynamodb';
import { Iam } from '../components/iam/iam';
import { Lambda } from '../components/lambda/lambda';
import { S3 } from '../components/s3/s3';
import { ReimbursementSecretsManager } from '../components/secrets-manager/secrets-manager';
import { StepFunctions } from '../components/stepfunctions/stepfunctions';
import type { Config } from '../config/config';
import { getResourceName } from '../config/global-config';
import { IacErrors } from '../errors';

export interface ReimbursementStackProps extends StackProps {
  readonly config: Config;
  readonly baseConfigDir: string;
}

export class ReimbursementStack extends Stack {
  readonly lambda: Lambda;
  readonly iam: Iam;
  readonly s3: S3;
  readonly dynamodb: DynamoDB;
  readonly secretsManager: ReimbursementSecretsManager;
  readonly stepFunctions: StepFunctions;
  readonly schedules: Schedules;

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

    this.iam = new Iam(this, 'Iam', { config });
    this.s3 = new S3(this, 'S3', { config });
    this.dynamodb = new DynamoDB(this, 'DynamoDB', { config });
    this.secretsManager = new ReimbursementSecretsManager(this, 'Secrets', {
      config,
      baseConfigDir,
      enabled: secretsEnabled,
    });

    this.stepFunctions = new StepFunctions(this, 'StepFunctions', {
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
      const bucketNames = fnConfig.s3Buckets;
      if (bucketNames && bucketNames.length > 0) {
        for (const bucketName of bucketNames) {
          const bucket = this.s3.getBucket(bucketName);
          if (!bucket) {
            throw IacErrors.validation(
              `Lambda "${fnConfig.name}" references unknown S3 bucket "${bucketName}"`,
              's3Buckets'
            );
          }
          bucket.grantReadWrite(fn);
        }
        const primaryBucket = this.s3.getBucket(bucketNames[0]);
        if (primaryBucket) {
          fn.addEnvironment('DATA_BUCKET_NAME', primaryBucket.bucketName);
        }
      }
      if (fnConfig.lockTableAccess === true) {
        this.dynamodb.lockTable.table.grantReadWriteData(fn);
        fn.addEnvironment('LOCK_TABLE_NAME', this.dynamodb.lockTable.tableName);
      }
      const sec = this.secretsManager.secret;
      if (fnConfig.secretsAccess === true && sec) {
        sec.grantRead(fn);
        fn.addEnvironment('SECRETS_ARN', sec.secretArn);
      }
    }

    this.schedules = new Schedules(this, 'EventBridgeSchedules', {
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
