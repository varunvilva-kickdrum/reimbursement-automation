import { CfnOutput } from 'aws-cdk-lib';
import { CorsHttpMethod, HttpApi, HttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpSqsIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import type { IRole } from 'aws-cdk-lib/aws-iam';
import type { IQueue } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import { ResourceName } from '../../../constants';
import type { Config } from '../../config/config';
import { getResourceName } from '../../config/global-config';

export interface ApiGatewayProps {
  readonly config: Config;
  readonly queue: IQueue;
  readonly role: IRole;
}

export class ApiGateway extends Construct {
  readonly httpApi: HttpApi;

  constructor(scope: Construct, id: string, props: ApiGatewayProps) {
    super(scope, id);

    const { config, queue } = props;

    this.httpApi = new HttpApi(this, 'WebhookApi', {
      apiName: getResourceName(ResourceName.WebhookApi, config),
      description: `reimbursement-automation webhook API (${config.environment})`,
      corsPreflight: {
        allowMethods: [CorsHttpMethod.POST],
        allowOrigins: ['*'],
      },
    });

    const sqsIntegration = new HttpSqsIntegration('WebhookSqsIntegration', {
      queue,
    });

    this.httpApi.addRoutes({
      path: '/webhook',
      methods: [HttpMethod.POST],
      integration: sqsIntegration,
    });

    new CfnOutput(this, 'WebhookApiUrl', {
      value: this.httpApi.apiEndpoint,
      description: 'Webhook HTTP API endpoint URL',
      exportName: `${getResourceName(ResourceName.WebhookApi, config)}-url`,
    });
  }
}
