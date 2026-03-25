import { Tags } from 'aws-cdk-lib';
import type { IConstruct } from 'constructs';
import { DefaultTagMap, TagKey } from '../../constants';
import type { Config } from '../config/config';

export function tagList(config: Config): Record<string, string> {
  const base: Record<string, string> = {
    [TagKey.Environment]: config.environment,
    ...DefaultTagMap,
  };
  if (config.stack.tags && Object.keys(config.stack.tags).length > 0) {
    return { ...base, ...config.stack.tags };
  }
  return base;
}

export function applyTags(scope: IConstruct, config: Config): void {
  const tags = tagList(config);
  for (const [key, value] of Object.entries(tags)) {
    Tags.of(scope).add(key, value);
  }
}
