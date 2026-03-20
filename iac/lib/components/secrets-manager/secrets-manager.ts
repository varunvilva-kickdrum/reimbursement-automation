import { Annotations } from 'aws-cdk-lib';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { ResourceName } from '../../../constants/resource-names';
import type { Config } from '../../config/config';
import { getResourceName } from '../../config/global-config';
import { loadSecretsConfig } from '../../config/secrets-config';
import type { SecretConfigItem } from '../../config/secrets-config';
import { EnvVars } from '../../../enums';
import { IacErrors } from '../../errors';

export interface ReimbursementSecretsManagerProps {
  readonly config: Config;
  readonly baseConfigDir: string;
  /** When false, no secret is created and secrets JSON is not read (local / sandbox stacks). */
  readonly enabled: boolean;
}

export class ReimbursementSecretsManager extends Construct {
  readonly secret?: Secret;

  constructor(scope: Construct, id: string, props: ReimbursementSecretsManagerProps) {
    super(scope, id);

    if (!props.enabled) {
      Annotations.of(this).addInfo(
        'Secrets Manager construct disabled — skip secret and config load'
      );
      return;
    }

    const secretsConfig = loadSecretsConfig(props.config, props.baseConfigDir);
    if (secretsConfig.length === 0) {
      Annotations.of(this).addInfo('No secrets defined — skipping Secrets Manager secret');
      return;
    }

    const allowedEnvVars = new Set(Object.values(EnvVars) as string[]);
    secretsConfig.forEach(({ envVar }) => {
      if (!allowedEnvVars.has(envVar)) {
        throw IacErrors.validation(
          `Secret envVar "${envVar}" must be listed in EnvVars enum`,
          'envVar'
        );
      }
    });

    Annotations.of(this).addInfo(
      `${secretsConfig.length} secret key(s); values are placeholders until GitHub Actions runs populate-secrets.`
    );

    this.secret = this.createSecret(props.config, secretsConfig);
  }

  private createSecret(config: Config, secretsConfig: SecretConfigItem[]): Secret {
    const secretStringTemplate = JSON.stringify(
      secretsConfig.reduce(
        (acc, { key }) => {
          acc[key] = `PLACEHOLDER_${key.toUpperCase()}`;
          return acc;
        },
        {} as Record<string, string>
      )
    );

    return new Secret(this, ResourceName.Secrets, {
      secretName: getResourceName(ResourceName.Secrets, config),
      description: `reimbursement-automation app secrets (${config.environment}) — values set in CI`,
      generateSecretString: {
        secretStringTemplate,
        generateStringKey: 'GENERATED_KEY',
      },
    });
  }
}
