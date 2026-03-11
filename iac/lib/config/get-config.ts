import type { App } from 'aws-cdk-lib';
import * as path from 'node:path';
import * as fs from 'fs';
import type { CommonConfig, Config, ReimbursementStackConfig } from './config';
import { EnvironmentType } from './config';
import { ConfigDirectory, ConfigFileName } from './config';
import { IacErrors } from '../errors';

/**
 * Loads JSON from path; returns empty object if file missing.
 */
function loadJsonConfig(filePath: string): Record<string, unknown> {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * Deep merge: source overrides target (no array merge, replace).
 */
function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const s = source[key];
    const t = result[key];
    if (
      s != null &&
      typeof s === 'object' &&
      !Array.isArray(s) &&
      t != null &&
      typeof t === 'object' &&
      !Array.isArray(t)
    ) {
      result[key] = deepMerge(t as Record<string, unknown>, s as Record<string, unknown>);
    } else {
      result[key] = s;
    }
  }
  return result;
}

/**
 * Common config from CDK context (environment, region, account).
 * Account can come from context.environments[env].account (e.g. cdk.json).
 */
interface EnvironmentContext {
  account: string;
  region?: string;
  profile?: string;
}

export function getCommonConfig(app: App): CommonConfig {
  const environment = ((app.node.tryGetContext('environment') as string) || 'dev').toLowerCase();
  const environments = app.node.tryGetContext('environments') as
    | Record<string, EnvironmentContext>
    | undefined;
  const envEntry = environments?.[environment];

  const defaultRegion = (app.node.tryGetContext('defaultRegion') as string) || 'us-west-2';
  const region =
    (app.node.tryGetContext('region') as string) ||
    envEntry?.region ||
    process.env.CDK_DEFAULT_REGION ||
    defaultRegion;

  let account =
    (app.node.tryGetContext('account') as string | undefined) || process.env.CDK_DEFAULT_ACCOUNT;
  if (!account && envEntry?.account) {
    account = envEntry.account;
  }
  if (!account) {
    throw IacErrors.environment(
      `Missing AWS account for environment '${environment}'. Add to cdk.json: context.environments.${environment}.account`,
      environment
    );
  }
  if (!/^\d{12}$/.test(account)) {
    throw IacErrors.environment(
      `Invalid AWS account ID: ${account} (must be 12 digits)`,
      environment
    );
  }
  return {
    environment: environment as EnvironmentType,
    region,
    account,
  };
}

/**
 * Get the AWS profile name for the current environment (from cdk.json).
 * Use with CLI: cdk deploy --profile $(node -p "require('./cdk.json').context.environments.dev.profile")
 * or set AWS_PROFILE before running cdk.
 */
export function getProfileForEnvironment(app: App, environment: string): string | undefined {
  const environments = app.node.tryGetContext('environments') as
    | Record<string, EnvironmentContext>
    | undefined;
  return environments?.[environment.toLowerCase()]?.profile;
}

/**
 * Load stack config: default + environment-specific merge.
 * Enables different resources per environment (e.g. disable step function in dev).
 */
function loadStackConfig(configDir: string, environment: string): ReimbursementStackConfig {
  const defaultPath = path.join(
    configDir,
    ConfigDirectory.DEFAULT,
    ConfigFileName.REIMBURSEMENT_STACK
  );
  const envPath = path.join(
    configDir,
    environment.toLowerCase(),
    ConfigFileName.REIMBURSEMENT_STACK
  );
  const defaultConfig = loadJsonConfig(defaultPath) as Record<string, unknown>;
  const envConfig = loadJsonConfig(envPath) as Record<string, unknown>;
  const merged = deepMerge(defaultConfig, envConfig) as unknown as ReimbursementStackConfig;
  if (!merged.lambda) {
    throw IacErrors.config(
      'Missing stack.lambda in config. Add default/reimbursementStackConfig.json',
      defaultPath
    );
  }
  return merged;
}

/**
 * Get full config: common (from context) + stack (default + env merge).
 */
export function getConfig(app: App, configDir: string): Config {
  const common = getCommonConfig(app);
  const stack = loadStackConfig(configDir, common.environment);
  return {
    ...common,
    stack,
  };
}
