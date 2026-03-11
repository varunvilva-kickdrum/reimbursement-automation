import * as path from 'node:path';
import { Stack, type StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import type { Config } from '../config/config';
import { Lambda } from '../components/lambda/lambda';

export interface ReimbursementStackProps extends StackProps {
  config: Config;
  /** Directory containing configs (e.g. iac/configs). Used to resolve paths relative to repo. */
  baseConfigDir: string;
}

/**
 * Main reimbursement stack. Composes Lambda (and optionally Step Function) from config.
 * Different environments get different resources via configs/default + configs/{dev|staging|prod}.
 */
export class ReimbursementStack extends Stack {
  readonly lambda: Lambda;

  constructor(scope: Construct, id: string, props: ReimbursementStackProps) {
    super(scope, id, {
      ...props,
      env: {
        account: props.config.account,
        region: props.config.region,
      },
    });

    const { config, baseConfigDir } = props;
    const repoRoot = path.resolve(baseConfigDir, '..', '..');
    const resolvedFunctionsPath = path.join(repoRoot, config.stack.lambda.functionsPath);
    const resolvedSharedPath = path.join(path.dirname(resolvedFunctionsPath), 'shared');

    this.lambda = new Lambda(this, 'Lambda', {
      config,
      resolvedFunctionsPath,
      resolvedSharedPath,
    });
  }
}
