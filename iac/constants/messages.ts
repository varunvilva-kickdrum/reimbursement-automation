import { AccountId } from './validation';

export const ConfigMessage = {
  missingStackLambda: 'Missing stack.lambda in config. Add default/reimbursementStackConfig.json',
  missingAccount: (environment: string) =>
    `Missing AWS account for environment '${environment}'. Add to cdk.json: context.environments.${environment}.account`,
  invalidAccountId: (account: string) =>
    `Invalid AWS account ID: ${account} (must be ${AccountId.DigitCount} digits)`,
  invalidEnvironment: (value: string, allowed: string) =>
    `Invalid environment '${value}'. Must be one of: ${allowed}`,
} as const;

export const LambdaBuilderMessage = {
  directoryNotFound: (path: string) => `Directory not found: ${path}`,
  functionsPathNotFound: (path: string) =>
    `Functions path not found: ${path}. Check stack.lambda.functionsPath in config.`,
  buildDirectoryCreateFailed: (path: string) => `Failed to create build directory: ${path}`,
  functionFolderNotFound: (name: string, basePath: string) =>
    `Lambda function folder not found: ${name} in ${basePath}`,
  functionPathNotDirectory: (name: string) => `Lambda function path is not a directory: ${name}`,
  missingHandler: (name: string) => `Missing handler.py in Lambda folder: ${name}`,
  missingInit: (name: string) => `Missing __init__.py in Lambda folder: ${name}`,
  sharedLayerInvalid: (path: string) =>
    `Shared layer path not found or missing python/: ${path}. Expected: lambda/shared/python/`,
} as const;

export const LambdaComponentMessage = {
  functionNotFound: (name: string) => `Lambda function not found: ${name}`,
} as const;

export const LambdaComponentOperation = {
  GetLambdaFunction: 'getLambdaFunction',
} as const;

export const LambdaBuilderOperation = {
  CalculateDirectoryHash: 'calculateDirectoryHash',
  ValidatePaths: 'validatePaths',
  ValidateFunctionFolder: 'validateFunctionFolder',
  CreateSharedLayerCode: 'createSharedLayerCode',
} as const;
