export const S3BucketPolicySid = {
  /** Deny S3 API over cleartext; statement shape must satisfy cdk-nag AwsSolutions-S10. */
  DenyInsecureTransport: 'DenyInsecureTransport',
} as const;
