import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import Mustache from 'mustache';
import type { Config } from '../config/config';
import { getResourceName } from '../config/global-config';
import { IacErrors } from '../errors';

export function getDefinitionBodyFromASL(
  stateMachineName: string,
  config: Config,
  resolvedTemplateDir: string
): string {
  const view = {
    GetLambdaArn: () => (text: string, render: (t: string) => string) => {
      const lambdaName = render(text).trim();
      const fullName = getResourceName(lambdaName, config);
      const arn = `arn:aws:lambda:${config.region}:${config.account}:function:${fullName}`;
      return JSON.stringify(arn);
    },

    GetResourceName: () => (text: string, render: (t: string) => string) => {
      const resourceName = getResourceName(render(text).trim(), config);
      return JSON.stringify(resourceName);
    },

    Region: config.region,
    Account: config.account,
    Environment: config.environment,
  };

  const templatePath = path.join(resolvedTemplateDir, `${stateMachineName}.json.mustache`);
  try {
    const template = readFileSync(templatePath, 'utf-8');
    return Mustache.render(template, view);
  } catch (error) {
    throw IacErrors.config(
      `Failed to render Step Function template for ${stateMachineName}`,
      templatePath,
      error
    );
  }
}
