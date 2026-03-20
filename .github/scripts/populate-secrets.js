#!/usr/bin/env node

/**
 * Builds SecretString JSON for AWS Secrets Manager from iac/configs/secrets/*-secrets-config.json
 * (same merge rules as CDK). GitHub Actions should pipe stdout to aws secretsmanager put-secret-value.
 */

const fs = require('fs');
const path = require('path');

function loadSecretsConfig(environment) {
  const configDir = path.join(__dirname, '../../iac/configs/secrets');
  const defaultConfigPath = path.join(configDir, 'secrets-config.json');
  const defaultSecrets = JSON.parse(fs.readFileSync(defaultConfigPath, 'utf8')).secrets;
  const envConfigPath = path.join(configDir, `${environment}-secrets-config.json`);
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
  const environment = process.argv[2];
  if (!environment) {
    console.error('Usage: node populate-secrets.js <environment>');
    console.error('Example: node populate-secrets.js dev');
    process.exit(1);
  }
  try {
    const secretsConfig = loadSecretsConfig(environment);
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
