import {
  Effect,
  type IManagedPolicy,
  ManagedPolicy,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from 'aws-cdk-lib/aws-iam';
import type { IBucket } from 'aws-cdk-lib/aws-s3';
import type { IQueue } from 'aws-cdk-lib/aws-sqs';
import type { ITopic } from 'aws-cdk-lib/aws-sns';
import type { ISecret } from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import {
  IamRoleSlug,
  IamPolicySid,
  S3ReadActions,
  S3WriteActions,
  S3ReadWriteActions,
  S3Prefix,
  DynamoDbReadActions,
  DynamoDbReadWriteActions,
  SqsConsumeActions,
  SqsSendActions,
  SnsPublishActions,
  StepFunctionsExecutionPolicySid,
  StepFunctionsSupportingServiceWildcardResource,
} from '../../../constants';
import type { Config } from '../../config/config';
import { getResourceName } from '../../config/global-config';

export interface IamResourceRefs {
  readonly dataBucket?: IBucket;
  readonly claimsTableArn?: string;
  readonly webhookQueue?: IQueue;
  readonly notificationTopic?: ITopic;
  readonly secret?: ISecret;
}

export interface IamProps {
  readonly config: Config;
  readonly resources?: IamResourceRefs;
}

export class Iam extends Construct {
  readonly stepFunctionExecutionRole: Role;
  readonly ingestionLambdaRole: Role;
  readonly extractionLambdaRole: Role;
  readonly validationLambdaRole: Role;
  readonly reportingLambdaRole: Role;
  readonly notificationLambdaRole: Role;
  readonly configSyncLambdaRole: Role;
  readonly eventBridgePipeRole: Role;
  readonly eventBridgeSchedulerRole: Role;
  readonly apiGatewayRole: Role;

  private readonly config: Config;

  constructor(scope: Construct, id: string, props: IamProps) {
    super(scope, id);

    this.config = props.config;
    const { config, resources } = props;
    const lambdaBasicExec = ManagedPolicy.fromAwsManagedPolicyName(
      'service-role/AWSLambdaBasicExecutionRole'
    );

    this.ingestionLambdaRole = this.createLambdaRole(
      'IngestionLambdaRole',
      IamRoleSlug.IngestionLambda,
      'Ingestion Lambda: Keka API, S3 raw, SQS',
      lambdaBasicExec
    );

    this.extractionLambdaRole = this.createLambdaRole(
      'ExtractionLambdaRole',
      IamRoleSlug.ExtractionLambda,
      'OCR/Extraction Lambda: S3 raw/processed, DynamoDB, Secrets',
      lambdaBasicExec
    );

    this.validationLambdaRole = this.createLambdaRole(
      'ValidationLambdaRole',
      IamRoleSlug.ValidationLambda,
      'Validation Lambda: S3 config, DynamoDB claims',
      lambdaBasicExec
    );

    this.reportingLambdaRole = this.createLambdaRole(
      'ReportingLambdaRole',
      IamRoleSlug.ReportingLambda,
      'Reporting Lambda: DynamoDB read, S3 reports, SNS, Secrets',
      lambdaBasicExec
    );

    this.notificationLambdaRole = this.createLambdaRole(
      'NotificationLambdaRole',
      IamRoleSlug.NotificationLambda,
      'Notification Lambda: Secrets (Slack)',
      lambdaBasicExec
    );

    this.configSyncLambdaRole = this.createLambdaRole(
      'ConfigSyncLambdaRole',
      IamRoleSlug.ConfigSyncLambda,
      'Config Sync Lambda: S3 config, Secrets (Google Sheets)',
      lambdaBasicExec
    );

    this.stepFunctionExecutionRole = new Role(this, 'StepFunctionExecutionRole', {
      assumedBy: new ServicePrincipal('states.amazonaws.com'),
      roleName: getResourceName(IamRoleSlug.StepFunctionExecution, config),
      description: `reimbursement-automation Step Functions execution role (${config.environment})`,
    });

    this.eventBridgePipeRole = new Role(this, 'EventBridgePipeRole', {
      assumedBy: new ServicePrincipal('pipes.amazonaws.com'),
      roleName: getResourceName(IamRoleSlug.EventBridgePipe, config),
      description: `reimbursement-automation EventBridge Pipe role (${config.environment})`,
    });

    this.eventBridgeSchedulerRole = new Role(this, 'EventBridgeSchedulerRole', {
      assumedBy: new ServicePrincipal('scheduler.amazonaws.com'),
      roleName: getResourceName(IamRoleSlug.EventBridgeScheduler, config),
      description: `reimbursement-automation EventBridge Scheduler role (${config.environment})`,
    });

    this.apiGatewayRole = new Role(this, 'ApiGatewayRole', {
      assumedBy: new ServicePrincipal('apigateway.amazonaws.com'),
      roleName: getResourceName(IamRoleSlug.ApiGateway, config),
      description: `reimbursement-automation API Gateway role (${config.environment})`,
    });

    this.attachStepFunctionPolicies(config);

    if (resources) {
      this.attachResourcePolicies(resources);
    }
  }

  /**
   * Attach fine-grained policies once resource construct references are available.
   * Called from the stack after all resource constructs are created.
   */
  attachResourcePolicies(resources: IamResourceRefs): void {
    const { dataBucket, claimsTableArn, webhookQueue, notificationTopic, secret } = resources;

    if (dataBucket) {
      this.addBucketPrefixPolicy(
        this.ingestionLambdaRole,
        IamPolicySid.S3RawReadWrite,
        dataBucket,
        S3Prefix.Raw,
        [...S3ReadWriteActions]
      );

      this.addBucketPrefixPolicy(
        this.extractionLambdaRole,
        IamPolicySid.S3RawRead,
        dataBucket,
        S3Prefix.Raw,
        [...S3ReadActions]
      );
      this.addBucketPrefixPolicy(
        this.extractionLambdaRole,
        IamPolicySid.S3ProcessedWrite,
        dataBucket,
        S3Prefix.Processed,
        [...S3WriteActions]
      );

      this.addBucketPrefixPolicy(
        this.validationLambdaRole,
        IamPolicySid.S3ConfigRead,
        dataBucket,
        S3Prefix.Config,
        [...S3ReadActions]
      );

      this.addBucketPrefixPolicy(
        this.reportingLambdaRole,
        IamPolicySid.S3ReportsWrite,
        dataBucket,
        S3Prefix.Reports,
        [...S3WriteActions]
      );

      this.addBucketPrefixPolicy(
        this.configSyncLambdaRole,
        IamPolicySid.S3ConfigReadWrite,
        dataBucket,
        S3Prefix.Config,
        [...S3ReadWriteActions]
      );
    }

    if (claimsTableArn) {
      this.addDynamoDbPolicy(
        this.extractionLambdaRole,
        IamPolicySid.DynamoDbClaimsReadWrite,
        claimsTableArn,
        [...DynamoDbReadWriteActions]
      );
      this.addDynamoDbPolicy(
        this.validationLambdaRole,
        IamPolicySid.DynamoDbClaimsReadWrite,
        claimsTableArn,
        [...DynamoDbReadWriteActions]
      );
      this.addDynamoDbPolicy(
        this.reportingLambdaRole,
        IamPolicySid.DynamoDbClaimsRead,
        claimsTableArn,
        [...DynamoDbReadActions]
      );
    }

    if (secret) {
      const secretArn = secret.secretArn;
      this.addSecretsPolicy(this.ingestionLambdaRole, secretArn);
      this.addSecretsPolicy(this.extractionLambdaRole, secretArn);
      this.addSecretsPolicy(this.reportingLambdaRole, secretArn);
      this.addSecretsPolicy(this.notificationLambdaRole, secretArn);
      this.addSecretsPolicy(this.configSyncLambdaRole, secretArn);
    }

    if (notificationTopic) {
      this.reportingLambdaRole.addToPrincipalPolicy(
        new PolicyStatement({
          sid: IamPolicySid.SnsPublish,
          effect: Effect.ALLOW,
          actions: [...SnsPublishActions],
          resources: [notificationTopic.topicArn],
        })
      );
    }

    if (webhookQueue) {
      this.apiGatewayRole.addToPrincipalPolicy(
        new PolicyStatement({
          sid: IamPolicySid.SqsSendMessage,
          effect: Effect.ALLOW,
          actions: [...SqsSendActions],
          resources: [webhookQueue.queueArn],
        })
      );

      this.eventBridgePipeRole.addToPrincipalPolicy(
        new PolicyStatement({
          sid: IamPolicySid.SqsConsume,
          effect: Effect.ALLOW,
          actions: [...SqsConsumeActions],
          resources: [webhookQueue.queueArn],
        })
      );
    }
  }

  /**
   * Attach Step Functions execution role invoke permission for the given Lambda ARNs.
   */
  addStepFunctionLambdaInvokePolicy(lambdaArns: string[]): void {
    if (lambdaArns.length === 0) {
      return;
    }
    const resources = lambdaArns.flatMap((arn) => [arn, `${arn}:*`]);
    this.stepFunctionExecutionRole.addToPrincipalPolicy(
      new PolicyStatement({
        sid: StepFunctionsExecutionPolicySid.InvokeLambdas,
        effect: Effect.ALLOW,
        actions: ['lambda:InvokeFunction'],
        resources,
      })
    );
  }

  /**
   * Attach EventBridge Pipe policy to start Step Functions execution.
   */
  addPipeStartExecutionPolicy(stateMachineArn: string): void {
    this.eventBridgePipeRole.addToPrincipalPolicy(
      new PolicyStatement({
        sid: IamPolicySid.StatesStartExecution,
        effect: Effect.ALLOW,
        actions: ['states:StartExecution'],
        resources: [stateMachineArn],
      })
    );
  }

  /**
   * Attach EventBridge Scheduler policy to invoke the specified Lambda functions.
   */
  addSchedulerLambdaInvokePolicy(lambdaArns: string[]): void {
    if (lambdaArns.length === 0) {
      return;
    }
    this.eventBridgeSchedulerRole.addToPrincipalPolicy(
      new PolicyStatement({
        sid: IamPolicySid.LambdaInvoke,
        effect: Effect.ALLOW,
        actions: ['lambda:InvokeFunction'],
        resources: lambdaArns.flatMap((arn) => [arn, `${arn}:*`]),
      })
    );
  }

  /**
   * Map a role slug (from config) to the corresponding IAM Role instance.
   */
  getRoleBySlug(slug: string): Role | undefined {
    const mapping: Record<string, Role> = {
      [IamRoleSlug.IngestionLambda]: this.ingestionLambdaRole,
      [IamRoleSlug.ExtractionLambda]: this.extractionLambdaRole,
      [IamRoleSlug.ValidationLambda]: this.validationLambdaRole,
      [IamRoleSlug.ReportingLambda]: this.reportingLambdaRole,
      [IamRoleSlug.NotificationLambda]: this.notificationLambdaRole,
      [IamRoleSlug.ConfigSyncLambda]: this.configSyncLambdaRole,
    };
    return mapping[slug];
  }

  private createLambdaRole(
    constructId: string,
    slug: string,
    description: string,
    basicExecPolicy: IManagedPolicy
  ): Role {
    const role = new Role(this, constructId, {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      roleName: getResourceName(slug, this.config),
      description: `reimbursement-automation ${description} (${this.config.environment})`,
    });
    role.addManagedPolicy(basicExecPolicy);
    return role;
  }

  private attachStepFunctionPolicies(config: Config): void {
    const invokeNames = config.stack.stepFunction.invokeLambdaFunctionNames;
    if (invokeNames.length > 0) {
      const resources = invokeNames.flatMap((functionName) => {
        const fullName = getResourceName(functionName, config);
        const arn = `arn:aws:lambda:${config.region}:${config.account}:function:${fullName}`;
        return [arn, `${arn}:*`];
      });
      this.stepFunctionExecutionRole.addToPrincipalPolicy(
        new PolicyStatement({
          sid: StepFunctionsExecutionPolicySid.InvokeLambdas,
          effect: Effect.ALLOW,
          actions: ['lambda:InvokeFunction'],
          resources,
        })
      );
    }

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

  private addBucketPrefixPolicy(
    role: Role,
    sid: string,
    bucket: IBucket,
    prefix: string,
    actions: string[]
  ): void {
    role.addToPrincipalPolicy(
      new PolicyStatement({
        sid,
        effect: Effect.ALLOW,
        actions,
        resources: [bucket.arnForObjects(prefix)],
      })
    );
  }

  private addDynamoDbPolicy(
    role: Role,
    sid: string,
    tableArn: string,
    actions: string[]
  ): void {
    role.addToPrincipalPolicy(
      new PolicyStatement({
        sid,
        effect: Effect.ALLOW,
        actions,
        resources: [tableArn, `${tableArn}/index/*`],
      })
    );
  }

  private addSecretsPolicy(role: Role, secretArn: string): void {
    role.addToPrincipalPolicy(
      new PolicyStatement({
        sid: IamPolicySid.SecretsRead,
        effect: Effect.ALLOW,
        actions: ['secretsmanager:GetSecretValue', 'secretsmanager:DescribeSecret'],
        resources: [secretArn],
      })
    );
  }
}
