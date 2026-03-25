#!/usr/bin/env node
import * as path from 'node:path';
import * as cdk from 'aws-cdk-lib';
import { ConfigDirRelativeFromBin, formatStackDescription, stackConstructId } from '../constants';
import { getConfig } from '../lib/config';
import { applyTags } from '../lib/helpers/tag';
import { ReimbursementStack } from '../lib/stacks/reimbursement-stack';

const app = new cdk.App();
const configDir = path.join(__dirname, ConfigDirRelativeFromBin);
const config = getConfig(app, configDir);

applyTags(app, config);

new ReimbursementStack(app, stackConstructId(config.environment), {
  config,
  baseConfigDir: configDir,
  env: {
    account: config.account,
    region: config.region,
  },
  description: formatStackDescription(config.environment),
});
