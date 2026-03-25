import { RemovalPolicy } from 'aws-cdk-lib';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { BlockPublicAccess, Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { S3BucketPolicySid } from '../../../constants';
import type { Config } from '../../config/config';
import { RemovalPolicyType } from '../../config/config';
import { getResourceName } from '../../config/global-config';

export interface S3Props {
  readonly config: Config;
}

export class S3 extends Construct {
  /** Logical bucket config name → CDK bucket */
  readonly buckets: Map<string, Bucket> = new Map();

  constructor(scope: Construct, id: string, props: S3Props) {
    super(scope, id);

    const { config } = props;
    const removal =
      config.stack.removalPolicy === RemovalPolicyType.Retain
        ? RemovalPolicy.RETAIN
        : RemovalPolicy.DESTROY;

    for (const bucketConfig of config.stack.s3.buckets) {
      const fullName = getResourceName(bucketConfig.name, config);
      const bucket = new Bucket(this, `Bucket-${bucketConfig.name}`, {
        bucketName: fullName,
        versioned: bucketConfig.versioned ?? false,
        encryption: BucketEncryption.S3_MANAGED,
        blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
        removalPolicy: removal,
        autoDeleteObjects: removal === RemovalPolicy.DESTROY,
      });
      // Principal must be "*" (string) for cdk-nag AwsSolutions-S10 policy matcher
      bucket.addToResourcePolicy(
        PolicyStatement.fromJson({
          Sid: S3BucketPolicySid.DenyInsecureTransport,
          Effect: 'Deny',
          Principal: '*',
          Action: 's3:*',
          Resource: [bucket.bucketArn, bucket.arnForObjects('*')],
          Condition: {
            Bool: {
              'aws:SecureTransport': 'false',
            },
          },
        })
      );
      this.buckets.set(bucketConfig.name, bucket);
    }
  }

  getBucket(logicalName: string): Bucket | undefined {
    return this.buckets.get(logicalName);
  }
}
