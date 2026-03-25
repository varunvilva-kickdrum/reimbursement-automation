import * as path from 'node:path';
import { Stack, type StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ConstructId, PathSegment, RepoLayout } from '../../constants';
import { Lambda } from '../components/lambda/lambda';
import type { Config } from '../config/config';

export interface ReimbursementStackProps extends StackProps {
  readonly config: Config;
  readonly baseConfigDir: string;
}

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
    const repoRootSegments = Array.from(
      { length: PathSegment.ConfigToRepoDepth },
      () => PathSegment.Parent
    );
    const repoRoot = path.resolve(baseConfigDir, ...repoRootSegments);
    const resolvedFunctionsPath = path.join(repoRoot, config.stack.lambda.functionsPath);
    const resolvedSharedPath = path.join(
      path.dirname(resolvedFunctionsPath),
      RepoLayout.SharedCodeDirName
    );
    const resolvedBuildDir = path.join(repoRoot, config.stack.lambda.buildDirectory);

    this.lambda = new Lambda(this, ConstructId.Lambda, {
      config,
      resolvedFunctionsPath,
      resolvedSharedPath,
      resolvedBuildDir,
    });
  }
}
