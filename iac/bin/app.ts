#!/usr/bin/env node
import * as path from 'node:path';
import * as cdk from 'aws-cdk-lib';
import { Aspects } from 'aws-cdk-lib';
import { AwsSolutionsChecks } from 'cdk-nag';
import { ConfigDirRelativeFromBin, formatStackDescription, stackConstructId } from '../constants';
import { getConfig } from '../lib/config';
import { applyReimbursementAutomationNagSuppressions } from '../lib/helpers/nag';
import { applyTags } from '../lib/helpers/tag';
import { ReimbursementStack } from '../lib/stacks/reimbursement-automation-stack';

const app = new cdk.App();
const configDir = path.join(__dirname, ConfigDirRelativeFromBin);
const config = getConfig(app, configDir);

applyTags(app, config);

const stackId = stackConstructId(config.environment);
const stack = new ReimbursementStack(app, stackId, {
  config,
  baseConfigDir: configDir,
  stackName: stackId,
  env: {
    account: config.account,
    region: config.region,
  },
  description: formatStackDescription(config.environment),
});

Aspects.of(app).add(new AwsSolutionsChecks({ verbose: process.env.CDK_NAG_VERBOSE === '1' }));
applyReimbursementAutomationNagSuppressions(stack);
