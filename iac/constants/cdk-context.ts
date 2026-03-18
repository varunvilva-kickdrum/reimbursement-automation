export const CdkContextKey = {
  Environment: 'environment',
  Environments: 'environments',
  DefaultRegion: 'defaultRegion',
  Region: 'region',
  Account: 'account',
} as const;

export const CdkDefaults = {
  Environment: 'dev',
  Region: 'us-west-2',
} as const;

export const EnvVar = {
  CdkDefaultRegion: 'CDK_DEFAULT_REGION',
  CdkDefaultAccount: 'CDK_DEFAULT_ACCOUNT',
} as const;
