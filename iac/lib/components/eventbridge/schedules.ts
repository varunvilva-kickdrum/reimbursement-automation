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

      const scheduleId = schedule.id;
      const rule = new Rule(this, `Schedule-${scheduleId}`, {
        ruleName: getResourceName(`schedule-${scheduleId}`, config),
        description: reimbursementAutomationScheduleRuleDescription(scheduleId),
        schedule: Schedule.expression(schedule.scheduleExpression),
      });

      const targetType = schedule.targetType;
      if (targetType === 'LAMBDA') {
        const fn = lambda.getLambdaFunction(schedule.lambdaFunctionName);
        rule.addTarget(new LambdaFunction(fn, { retryAttempts: 2 }));
      } else if (targetType === 'STEP_FUNCTION') {
        const info = stepFunctions.getStateMachine(schedule.stateMachineName);
        if (!info) {
          throw IacErrors.validation(
            `Schedule ${scheduleId}: state machine "${schedule.stateMachineName}" not found`,
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
      } else {
        throw IacErrors.validation(
          `Schedule ${scheduleId}: unsupported targetType "${String(targetType)}"`,
          'targetType'
        );
      }
    }
  }
}
