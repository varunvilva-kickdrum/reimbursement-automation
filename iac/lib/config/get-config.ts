import type { App } from 'aws-cdk-lib';
import * as fs from 'fs';
import * as path from 'node:path';
import {
  AccountId,
  CdkContextKey,
  CdkDefaults,
  ConfigMessage,
  EnvVar,
  FileEncoding,
} from '../../constants';
import { ConfigDirectory, ConfigFileName, EnvironmentType } from '../../enums';
import { IacErrors } from '../errors';
import type { CommonConfig, Config, ReimbursementStackConfig } from './config';

function loadJsonConfig(filePath: string): Record<string, unknown> {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  try {
    const content = fs.readFileSync(filePath, FileEncoding.Utf8);
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return {};
  }
}

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

interface EnvironmentContext {
  readonly account: string;
  readonly region?: string;
  readonly profile?: string;
}

const environmentValues = new Set<string>(Object.values(EnvironmentType));

function parseEnvironment(raw: string): EnvironmentType {
  const key = raw.toLowerCase();
  if (!environmentValues.has(key)) {
    throw IacErrors.environment(
      ConfigMessage.invalidEnvironment(key, [...environmentValues].sort().join(', ')),
      key
    );
  }
  return key as EnvironmentType;
}

export function getCommonConfig(app: App): CommonConfig {
  const rawEnv =
    (app.node.tryGetContext(CdkContextKey.Environment) as string | undefined) ??
    CdkDefaults.Environment;
  const environment = parseEnvironment(rawEnv);

  const environments = app.node.tryGetContext(CdkContextKey.Environments) as
    | Record<string, EnvironmentContext>
    | undefined;
  const envEntry = environments?.[environment];

  const defaultRegion =
    (app.node.tryGetContext(CdkContextKey.DefaultRegion) as string) ?? CdkDefaults.Region;
  const region =
    (app.node.tryGetContext(CdkContextKey.Region) as string) ||
    envEntry?.region ||
    process.env[EnvVar.CdkDefaultRegion] ||
    defaultRegion;

  let account =
    (app.node.tryGetContext(CdkContextKey.Account) as string | undefined) ||
    process.env[EnvVar.CdkDefaultAccount];
  if (!account && envEntry?.account) {
    account = envEntry.account;
  }
  if (!account) {
    throw IacErrors.environment(ConfigMessage.missingAccount(environment), environment);
  }
  if (!AccountId.Pattern.test(account)) {
    throw IacErrors.environment(ConfigMessage.invalidAccountId(account), environment);
  }
  return {
    environment,
    region,
    account,
  };
}

export function getProfileForEnvironment(app: App, environment: string): string | undefined {
  const environments = app.node.tryGetContext(CdkContextKey.Environments) as
    | Record<string, EnvironmentContext>
    | undefined;
  return environments?.[environment.toLowerCase()]?.profile;
}

function loadStackConfig(configDir: string, environment: string): ReimbursementStackConfig {
  const defaultPath = path.join(
    configDir,
    ConfigDirectory.Default,
    ConfigFileName.ReimbursementStack
  );
  const envPath = path.join(
    configDir,
    environment.toLowerCase(),
    ConfigFileName.ReimbursementStack
  );
  const defaultConfig = loadJsonConfig(defaultPath) as Record<string, unknown>;
  const envConfig = loadJsonConfig(envPath) as Record<string, unknown>;
  const merged = deepMerge(defaultConfig, envConfig) as unknown as ReimbursementStackConfig;
  if (!merged.lambda) {
    throw IacErrors.config(ConfigMessage.missingStackLambda, defaultPath);
  }
  return merged;
}

export function getConfig(app: App, configDir: string): Config {
  const common = getCommonConfig(app);
  const stack = loadStackConfig(configDir, common.environment);
  return {
    ...common,
    stack,
  };
}
