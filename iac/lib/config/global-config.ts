import { ResourceNaming } from '../../constants';
import type { Config } from './config';

export function getResourceName(name: string, config: Config): string {
  const normalized = name.replaceAll('_', ResourceNaming.UnderscoreReplacement);
  return [config.environment, ResourceNaming.MiddleSegment, normalized].join(
    ResourceNaming.SegmentSeparator
  );
}
