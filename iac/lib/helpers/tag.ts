import { Tags } from 'aws-cdk-lib';
import type { IConstruct } from 'constructs';
import { DEFAULT_TAGS } from '../constants/tag-constants';
import type { Config } from '../config/config';

/**
 * Returns the standard list of tags for all resources.
 * Environment is always set from config; then defaults from tag-constants; then config.stack.tags override/add.
 */
export function tagList(config: Config): Record<string, string> {
  const base: Record<string, string> = {
    Environment: config.environment,
    ...DEFAULT_TAGS,
  };
  if (config.stack.tags && Object.keys(config.stack.tags).length > 0) {
    return { ...base, ...config.stack.tags };
  }
  return base;
}

/**
 * Apply standard tags to a construct. Tags propagate to all child resources.
 * Call once at the app (or stack) level so every resource gets the same tags.
 */
export function applyTags(scope: IConstruct, config: Config): void {
  const tags = tagList(config);
  for (const [key, value] of Object.entries(tags)) {
    Tags.of(scope).add(key, value);
  }
}
