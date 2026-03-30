import * as path from 'node:path';
import { CfnOutput, Stack, type StackProps } from 'aws-cdk-lib';
import type { IRole } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { ConstructId, PathSegment, RepoLayout, ResourceName } from '../../constants';
import { ApiGateway } from '../components/apigateway/apigateway';
import { Schedules } from '../components/eventbridge/schedules';
import { DynamoDB } from '../components/dynamodb/dynamodb';
import { Iam } from '../components/iam/iam';
import { Lambda } from '../components/lambda/lambda';
import { Pipes } from '../components/pipes/pipes';
import { S3 } from '../components/s3/s3';
import { Sns } from '../components/sns/sns';
import { Sqs } from '../components/sqs/sqs';
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
  readonly iam: Iam;
  readonly s3: S3;
  readonly dynamodb: DynamoDB;
  readonly secretsManager: ReimbursementSecretsManager;
  readonly sqs?: Sqs;
  readonly sns?: Sns;
  readonly lambda: Lambda;
  readonly stepFunctions: StepFunctions;
  readonly pipes?: Pipes;
  readonly apiGateway?: ApiGateway;
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

    // 1. Storage resources
    this.s3 = new S3(this, 'S3', { config });
    this.dynamodb = new DynamoDB(this, 'DynamoDB', { config });
    this.secretsManager = new ReimbursementSecretsManager(this, 'Secrets', {
      config,
      baseConfigDir,
      enabled: secretsEnabled,
    });

    // 2. Messaging resources
    if (config.stack.sqs?.enabled) {
      this.sqs = new Sqs(this, ConstructId.Sqs, { config });
    }

    if (config.stack.sns?.enabled) {
      this.sns = new Sns(this, ConstructId.Sns, { config });
    }

    // 3. IAM roles with resource references for fine-grained policies
    const dataBucket = this.s3.getBucket('data');
    this.iam = new Iam(this, 'Iam', {
      config,
      resources: {
        dataBucket,
        claimsTableArn: this.dynamodb.claimsTable?.tableArn,
        webhookQueue: this.sqs?.queue,
        notificationTopic: this.sns?.topic,
        secret: this.secretsManager.secret,
      },
    });

    // 4. Build Lambda role map from IAM construct for functions with custom roles
    const roleMap = new Map<string, IRole>();
    const fns = config.stack.lambda.functions.filter((f) => f.enabled !== false);
    for (const fnConfig of fns) {
      if (fnConfig.role) {
        const role = this.iam.getRoleBySlug(fnConfig.role);
        if (!role) {
          throw IacErrors.validation(
            `Lambda "${fnConfig.name}" references unknown IAM role slug "${fnConfig.role}"`,
            'role'
          );
        }
        roleMap.set(fnConfig.role, role);
      }
    }

    // 5. Lambda functions
    this.lambda = new Lambda(this, ConstructId.Lambda, {
      config,
      resolvedFunctionsPath,
      resolvedSharedPath,
      resolvedBuildDir,
      roleMap,
    });

    // 6. Grant non-role-based permissions for functions without custom roles (backward compat)
    for (const fnConfig of fns) {
      if (fnConfig.role) {
        continue;
      }
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

    // 7. Add environment variables for functions with custom roles
    for (const fnConfig of fns) {
      if (!fnConfig.role) {
        continue;
      }
      const fn = this.lambda.getLambdaFunction(fnConfig.name);
      if (dataBucket) {
        fn.addEnvironment('DATA_BUCKET_NAME', dataBucket.bucketName);
      }
      if (this.dynamodb.claimsTable) {
        fn.addEnvironment('CLAIMS_TABLE_NAME', this.dynamodb.claimsTable.tableName);
      }
      if (this.secretsManager.secret && fnConfig.secretsAccess) {
        fn.addEnvironment('SECRETS_ARN', this.secretsManager.secret.secretArn);
      }
      if (this.sns?.topic) {
        fn.addEnvironment('NOTIFICATION_TOPIC_ARN', this.sns.topic.topicArn);
      }
    }

    // 8. Step Functions
    this.stepFunctions = new StepFunctions(this, 'StepFunctions', {
      config,
      iam: this.iam,
      resolvedTemplateDir,
    });

    // 9. EventBridge Pipes (SQS -> Step Functions)
    const pipelineInfo = this.stepFunctions.getStateMachine('pipeline');
    if (config.stack.pipes?.enabled && this.sqs && pipelineInfo) {
      this.iam.addPipeStartExecutionPolicy(pipelineInfo.stateMachine.stateMachineArn);
      this.pipes = new Pipes(this, ConstructId.Pipes, {
        config,
        sourceQueue: this.sqs.queue,
        targetStateMachine: pipelineInfo.stateMachine,
        role: this.iam.eventBridgePipeRole,
      });
    }

    // 10. API Gateway (HTTP API -> SQS)
    if (config.stack.apiGateway?.enabled && this.sqs) {
      this.apiGateway = new ApiGateway(this, ConstructId.ApiGateway, {
        config,
        queue: this.sqs.queue,
        role: this.iam.apiGatewayRole,
      });
    }

    // 11. EventBridge Schedules
    this.schedules = new Schedules(this, 'EventBridgeSchedules', {
      config,
      lambda: this.lambda,
      stepFunctions: this.stepFunctions,
    });

    // 12. Scheduler role: grant invoke on scheduled Lambda targets
    const scheduledLambdaArns = this.getScheduledLambdaArns(config);
    if (scheduledLambdaArns.length > 0) {
      this.iam.addSchedulerLambdaInvokePolicy(scheduledLambdaArns);
    }

    // CfnOutputs
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

  private getScheduledLambdaArns(config: Config): string[] {
    const eb = config.stack.eventBridge;
    if (!eb?.enabled) {
      return [];
    }
    const arns: string[] = [];
    for (const schedule of eb.schedules ?? []) {
      if (!schedule.enabled || schedule.targetType !== 'LAMBDA') {
        continue;
      }
      const fn = this.lambda.getLambdaFunction(schedule.lambdaFunctionName);
      arns.push(fn.functionArn);
    }
    return arns;
  }
}
