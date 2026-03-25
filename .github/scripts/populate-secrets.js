#!/usr/bin/env node

/**
 * Builds SecretString JSON for AWS Secrets Manager from iac/configs/secrets/*-secrets-config.json
 * (same merge rules as CDK). GitHub Actions should pipe stdout to aws secretsmanager put-secret-value.
 */

const fs = require('fs');
const path = require('path');

/** Must match environments used under iac/configs/secrets/ and deploy workflows (no path segments). */
const SUPPORTED_ENVS = new Set(['dev', 'staging', 'prod']);

function assertAllowedEnvironment(environment) {
  if (typeof environment !== 'string' || !environment.trim()) {
    throw new Error('Environment must be a non-empty string');
  }
  const trimmed = environment.trim();
  if (!/^[a-z0-9_-]+$/i.test(trimmed)) {
    throw new Error(`Invalid environment "${environment}": only letters, digits, hyphen, and underscore are allowed`);
  }
  if (!SUPPORTED_ENVS.has(trimmed)) {
    throw new Error(
      `Unsupported environment "${trimmed}". Expected one of: ${[...SUPPORTED_ENVS].sort().join(', ')}`
    );
  }
  return trimmed;
}

function loadSecretsConfig(environment) {
  const normalizedEnv = assertAllowedEnvironment(environment);
  const configDir = path.join(__dirname, '../../iac/configs/secrets');
  const defaultConfigPath = path.join(configDir, 'secrets-config.json');
  const defaultSecrets = JSON.parse(fs.readFileSync(defaultConfigPath, 'utf8')).secrets;
  const envConfigPath = path.join(configDir, `${normalizedEnv}-secrets-config.json`);
  let envSecrets = [];
  if (fs.existsSync(envConfigPath)) {
    envSecrets = JSON.parse(fs.readFileSync(envConfigPath, 'utf8')).secrets;
  }
  const merged = new Map();
  defaultSecrets.forEach((s) => merged.set(s.key, s));
  envSecrets.forEach((s) => merged.set(s.key, s));
  return Array.from(merged.values());
}

function buildSecretJson(secretsConfig) {
  const secretObject = {};
  secretsConfig.forEach(({ key, envVar, required }) => {
    const envValue = process.env[envVar];
    if (required && !envValue) {
      throw new Error(`Required environment variable ${envVar} is not set`);
    }
    secretObject[key] = envValue || '';
    console.error(`Mapped ${key} from ${envVar}`);
  });
  return JSON.stringify(secretObject);
}

function main() {
  const rawEnv = process.argv[2];
  if (!rawEnv) {
    console.error('Usage: node populate-secrets.js <environment>');
    console.error('Example: node populate-secrets.js dev');
    process.exit(1);
  }
  try {
    const secretsConfig = loadSecretsConfig(rawEnv);
    if (secretsConfig.length === 0) {
      console.error('No secrets in merged config — skipping output');
      console.log('{}');
      return;
    }
    const secretJson = buildSecretJson(secretsConfig);
    console.log(secretJson);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
