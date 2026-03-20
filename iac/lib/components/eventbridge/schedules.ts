import { Annotations } from 'aws-cdk-lib';
import { Rule, RuleTargetInput, Schedule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction, SfnStateMachine } from 'aws-cdk-lib/aws-events-targets';
import { Construct } from 'constructs';
import {
  EventBridgeSchedulePayload,
  reimbursementAutomationScheduleRuleDescription,
} from '../../../constants';
import type { Config } from '../../config/config';
import { getResourceName } from '../../config/global-config';
import { IacErrors } from '../../errors';
import type { Lambda } from '../lambda/lambda';
import type { StepFunctions } from '../stepfunctions/stepfunctions';

export interface SchedulesProps {
  readonly config: Config;
  readonly lambda: Lambda;
  readonly stepFunctions: StepFunctions;
}

export class Schedules extends Construct {
  constructor(scope: Construct, id: string, props: SchedulesProps) {
    super(scope, id);

    const { config, lambda, stepFunctions } = props;
    const eb = config.stack.eventBridge;

    if (!eb?.enabled) {
      Annotations.of(this).addInfo('EventBridge schedules disabled or not configured');
      return;
    }

    for (const schedule of eb.schedules ?? []) {
      if (!schedule.enabled) {
        continue;
      }

      const rule = new Rule(this, `Schedule-${schedule.id}`, {
        ruleName: getResourceName(`schedule-${schedule.id}`, config),
        description: reimbursementAutomationScheduleRuleDescription(schedule.id),
        schedule: Schedule.expression(schedule.scheduleExpression),
      });

      if (schedule.targetType === 'LAMBDA') {
        const fnName = schedule.lambdaFunctionName;
        if (!fnName) {
          throw IacErrors.validation(
            `Schedule ${schedule.id}: lambdaFunctionName required for LAMBDA target`,
            'lambdaFunctionName'
          );
        }
        const fn = lambda.getLambdaFunction(fnName);
        rule.addTarget(new LambdaFunction(fn, { retryAttempts: 2 }));
      } else {
        const smName = schedule.stateMachineName;
        if (!smName) {
          throw IacErrors.validation(
            `Schedule ${schedule.id}: stateMachineName required for STEP_FUNCTION target`,
            'stateMachineName'
          );
        }
        const info = stepFunctions.getStateMachine(smName);
        if (!info) {
          throw IacErrors.validation(
            `Schedule ${schedule.id}: state machine "${smName}" not found`,
            'stateMachineName'
          );
        }
        rule.addTarget(
          new SfnStateMachine(info.stateMachine, {
            input: RuleTargetInput.fromObject({
              [EventBridgeSchedulePayload.SourceField]:
                EventBridgeSchedulePayload.ScheduledSourceValue,
            }),
            retryAttempts: 2,
          })
        );
      }
    }
  }
}
