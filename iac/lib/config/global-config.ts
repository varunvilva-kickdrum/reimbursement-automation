import type { Config } from './config';

/**
 * Resource name with environment prefix (e.g. dev-reimbursement-hello).
 * Use for resources that are per-environment.
 */
export function getResourceName(name: string, config: Config): string {
  return `${config.environment}-reimbursement-${name.replaceAll('_', '-')}`;
}
