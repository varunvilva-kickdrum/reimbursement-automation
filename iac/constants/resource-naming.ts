/** Drives `{environment}-{MiddleSegment}-{resource}` for most AWS resource names. */
export const ResourceNaming = {
  SegmentSeparator: '-',
  UnderscoreReplacement: '-',
  MiddleSegment: 'reimbursement-automation',
} as const;
