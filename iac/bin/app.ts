#!/usr/bin/env node
/**
 * CDK app entry. Loads config (default + environment override) and creates the reimbursement stack.
 * Different environments can have different resources via configs/{dev|staging|prod}.
 */
import * as path from 'node:path';
import * as cdk from 'aws-cdk-lib';
import { getConfig } from '../lib/config/get-config';
import { ReimbursementStack } from '../lib/stacks/reimbursement-stack';

const app = new cdk.App();

const configDir = path.join(__dirname, '../../configs');
const config = getConfig(app, configDir);

const env: cdk.Environment = {
  account: config.account,
  region: config.region,
};

new ReimbursementStack(app, `ReimbursementStack-${config.environment}`, {
  config,
  baseConfigDir: configDir,
  env,
  description: `Reimbursement pipeline (${config.environment})`,
});
