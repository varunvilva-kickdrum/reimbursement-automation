/**
 * Default tags applied to all resources.
 * Can be overridden or extended via config.stack.tags in reimbursementStackConfig.json.
 */
export const DEFAULT_TAGS: Record<string, string> = {
  Project: 'Reimbursements-Automation',
  Team: 'Reimbursements-Automation',
  Purpose: 'Org-Initiative',
} as const;
