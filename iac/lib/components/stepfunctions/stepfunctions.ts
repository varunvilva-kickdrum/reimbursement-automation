import { Annotations } from 'aws-cdk-lib';
import { DefinitionBody, StateMachine } from 'aws-cdk-lib/aws-stepfunctions';
import { Construct } from 'constructs';
import { getResourceName } from '../../config/global-config';
import { IacErrors } from '../../errors';
import { getDefinitionBodyFromASL } from '../../helpers/asl-utils';
import type { StateMachineInfo, StepFunctionsProps } from './stepfunctions-types';

export class StepFunctions extends Construct {
  readonly stateMachines: Map<string, StateMachineInfo> = new Map();

  constructor(scope: Construct, id: string, props: StepFunctionsProps) {
    super(scope, id);

    const { config, iam, resolvedTemplateDir } = props;

    if (!config.stack.stepFunction.enabled) {
      Annotations.of(this).addWarning('Step Functions disabled — no state machines created');
      return;
    }

    for (const machine of config.stack.stepFunction.stateMachines) {
      if (machine.enabled === false) {
        continue;
      }
      const name = machine.name;
      const resourceName = getResourceName(name, config);
      let definitionString: string;
      try {
        definitionString = getDefinitionBodyFromASL(name, config, resolvedTemplateDir);
        JSON.parse(definitionString);
      } catch (error) {
        if (error instanceof SyntaxError) {
          throw IacErrors.config(
            `Step Function ASL is invalid JSON: ${error.message}`,
            `${resolvedTemplateDir}/${name}.json.mustache`,
            error
          );
        }
        throw IacErrors.create(`Failed to build Step Function definition for ${name}`, error, {
          stateMachineName: name,
          resolvedTemplateDir,
        });
      }

      const sm = new StateMachine(this, `Sm-${name}`, {
        stateMachineName: resourceName,
        definitionBody: DefinitionBody.fromString(definitionString),
        role: iam.stepFunctionExecutionRole,
        comment: machine.description ?? `reimbursement-automation: ${name}`,
        tracingEnabled: config.stack.stepFunction.tracingEnabled ?? false,
      });

      this.stateMachines.set(name, {
        name,
        arn: sm.stateMachineArn,
        stateMachine: sm,
      });
    }
  }

  getStateMachine(name: string): StateMachineInfo | undefined {
    return this.stateMachines.get(name);
  }
}
