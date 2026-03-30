/**
 * Logical resource name segments passed to getResourceName (become env-reimbursement-automation-{segment}).
 */
export const ResourceName = {
  Secrets: 'secrets',
  WebhookQueue: 'webhook-queue',
  WebhookDlq: 'webhook-dlq',
  ClaimsTable: 'claims',
  NotificationTopic: 'notification-topic',
  WebhookApi: 'webhook-api',
  WebhookPipe: 'webhook-pipe',
} as const;
