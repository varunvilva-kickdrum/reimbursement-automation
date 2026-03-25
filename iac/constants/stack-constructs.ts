export const ConstructId = {
  Lambda: 'Lambda',
  SharedLayer: 'SharedLayer',
} as const;

export const StackNaming = {
  IdPrefix: 'ReimbursementStack',
  DescriptionTemplate: 'Reimbursement pipeline ({0})',
} as const;

export function formatStackDescription(environment: string): string {
  return StackNaming.DescriptionTemplate.replace('{0}', environment);
}

export function stackConstructId(environment: string): string {
  return `${StackNaming.IdPrefix}-${environment}`;
}
