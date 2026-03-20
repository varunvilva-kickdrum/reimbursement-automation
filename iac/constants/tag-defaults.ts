export const TagKey = {
  Environment: 'Environment',
  Project: 'Project',
  Team: 'Team',
  Purpose: 'Purpose',
} as const;

export const TagValue = {
  Project: 'reimbursement-automation',
  Team: 'reimbursement-automation',
  Purpose: 'Org-Initiative',
} as const;

export const DefaultTagMap: Record<string, string> = {
  [TagKey.Project]: TagValue.Project,
  [TagKey.Team]: TagValue.Team,
  [TagKey.Purpose]: TagValue.Purpose,
};
