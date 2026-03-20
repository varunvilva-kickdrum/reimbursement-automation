import * as fs from 'fs';
import * as path from 'node:path';
import { ConfigDirectory, ConfigFileName, ConfigType } from '../../enums';
import { IacErrors } from '../errors';
import type { Config } from './config';

export interface SecretConfigItem {
  readonly key: string;
  readonly envVar: string;
  readonly description: string;
  readonly required: boolean;
}

export interface SecretsConfigFile {
  readonly secrets: SecretConfigItem[];
}

export function loadSecretsConfig(config: Config, baseConfigDir: string): SecretConfigItem[] {
  const secretsConfigDir = path.join(baseConfigDir, ConfigDirectory.Secrets);
  const defaultConfigPath = path.join(secretsConfigDir, ConfigFileName.Secrets);
  const defaultSecrets = loadSecretsFromFile(defaultConfigPath, ConfigType.Default);

  const envConfigPath = path.join(
    secretsConfigDir,
    `${config.environment}-${ConfigFileName.Secrets}`
  );
  const envSecrets = fs.existsSync(envConfigPath)
    ? loadSecretsFromFile(envConfigPath, ConfigType.Environment)
    : [];

  return mergeSecretsConfig(defaultSecrets, envSecrets);
}

function loadSecretsFromFile(filePath: string, configType: ConfigType): SecretConfigItem[] {
  if (!fs.existsSync(filePath)) {
    if (configType === ConfigType.Default) {
      throw IacErrors.config(`Default secrets configuration file not found: ${filePath}`, filePath);
    }
    return [];
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const secretsConfig: SecretsConfigFile = JSON.parse(raw) as SecretsConfigFile;
    validateSecretsConfig(secretsConfig, configType);
    return secretsConfig.secrets;
  } catch (error) {
    throw IacErrors.config(`Failed to load ${configType} secrets configuration`, filePath, error);
  }
}

function mergeSecretsConfig(
  defaultSecrets: SecretConfigItem[],
  envSecrets: SecretConfigItem[]
): SecretConfigItem[] {
  const merged = new Map<string, SecretConfigItem>();
  defaultSecrets.forEach((s) => merged.set(s.key, s));
  envSecrets.forEach((s) => merged.set(s.key, s));
  return [...merged.values()];
}

function validateSecretsConfig(config: SecretsConfigFile, configType: ConfigType): void {
  if (!config.secrets || !Array.isArray(config.secrets)) {
    throw IacErrors.validation(
      `Invalid ${configType} secrets configuration: missing secrets array`,
      'secrets'
    );
  }
  config.secrets.forEach((secret, index) => {
    if (!secret.key || typeof secret.key !== 'string') {
      throw IacErrors.validation(
        `Invalid ${configType} secret at index ${index}: missing key`,
        `secrets[${index}].key`
      );
    }
    if (!secret.envVar || typeof secret.envVar !== 'string') {
      throw IacErrors.validation(
        `Invalid ${configType} secret at index ${index}: missing envVar`,
        `secrets[${index}].envVar`
      );
    }
    if (typeof secret.required !== 'boolean') {
      throw IacErrors.validation(
        `Invalid ${configType} secret at index ${index}: required must be boolean`,
        `secrets[${index}].required`
      );
    }
  });
}
