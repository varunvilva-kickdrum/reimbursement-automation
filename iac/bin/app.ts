#!/usr/bin/env node
/**
 * CDK app entry. Loads config (default + environment override) and creates the reimbursement stack.
 * Different environments can have different resources via configs/{dev|staging|prod}.
 */
import * as path from 'node:path';
import * as cdk from 'aws-cdk-lib';
import { getConfig } from '../lib/config/get-config';
import { applyTags } from '../lib/helpers/tag';
import { ReimbursementStack } from '../lib/stacks/reimbursement-stack';

const app = new cdk.App();

const configDir = path.join(__dirname, '../../configs');
const config = getConfig(app, configDir);

// Apply same tags to all resources (propagates to stack and every construct)
applyTags(app, config);

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
