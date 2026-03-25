/** Payload key for scheduled Step Function / traceability. */
export const EventBridgeSchedulePayload = {
  SourceField: 'source',
  ScheduledSourceValue: 'eventbridge-schedule',
} as const;

export function reimbursementAutomationScheduleRuleDescription(scheduleId: string): string {
  return `reimbursement-automation scheduled rule: ${scheduleId}`;
}
