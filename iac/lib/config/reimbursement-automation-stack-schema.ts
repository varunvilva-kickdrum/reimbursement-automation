import { z } from 'zod';

/**
 * Runtime validation for merged `reimbursement-automation-stack-config.json` (strict: rejects unknown top-level keys).
 */
export const reimbursementStackSchema = z
  .object({
    removalPolicy: z.enum(['destroy', 'retain']).optional(),
    lambda: z.object({
      functionsPath: z.string().min(1),
      buildDirectory: z.string().min(1),
      defaultTimeout: z.number().nonnegative(),
      defaultMemorySize: z.number().positive(),
      functions: z
        .array(
          z.object({
            name: z.string().min(1),
            timeout: z.number().nonnegative().optional(),
            memorySize: z.number().positive().optional(),
            enabled: z.boolean().optional(),
            /** Bucket logical names from `s3.buckets` this function may access; omit for no S3 grants. */
            s3Buckets: z.array(z.string().min(1)).optional(),
            lockTableAccess: z.boolean().optional(),
            secretsAccess: z.boolean().optional(),
          })
        )
        .min(1),
    }),
    s3: z.object({
      buckets: z
        .array(
          z.object({
            name: z.string().min(1),
            versioned: z.boolean().optional(),
          })
        )
        .min(1),
    }),
    dynamodb: z.object({
      lockTable: z.object({
        name: z.string().min(1),
        partitionKeyName: z.string().optional(),
        ttlAttributeName: z.string().optional(),
      }),
    }),
    secrets: z
      .object({
        enabled: z.boolean().optional(),
      })
      .optional(),
    stepFunction: z.object({
      enabled: z.boolean(),
      templatePath: z.string().min(1),
      tracingEnabled: z.boolean().optional(),
      /** Logical Lambda names (from `lambda.functions`) invoked by Step Functions tasks; scopes execution role. */
      invokeLambdaFunctionNames: z.array(z.string().min(1)).default([]),
      stateMachines: z
        .array(
          z.object({
            name: z.string().min(1),
            enabled: z.boolean().optional(),
            description: z.string().optional(),
          })
        )
        .min(1),
    }),
    eventBridge: z
      .object({
        enabled: z.boolean(),
        schedules: z
          .array(
            z.discriminatedUnion('targetType', [
              z.object({
                id: z.string().min(1),
                enabled: z.boolean(),
                scheduleExpression: z.string().min(1),
                targetType: z.literal('LAMBDA'),
                lambdaFunctionName: z.string().min(1),
              }),
              z.object({
                id: z.string().min(1),
                enabled: z.boolean(),
                scheduleExpression: z.string().min(1),
                targetType: z.literal('STEP_FUNCTION'),
                stateMachineName: z.string().min(1),
              }),
            ])
          )
          .optional()
          .default([]),
      })
      .optional(),
    tags: z.record(z.string(), z.string()).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (!data.stepFunction.enabled) {
      return;
    }
    const hasEnabledStateMachine = data.stepFunction.stateMachines.some((m) => m.enabled !== false);
    if (hasEnabledStateMachine && data.stepFunction.invokeLambdaFunctionNames.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'stepFunction.invokeLambdaFunctionNames must list at least one Lambda when Step Functions is enabled with an enabled state machine',
        path: ['stepFunction', 'invokeLambdaFunctionNames'],
      });
    }
  });

export type ReimbursementStackConfig = z.infer<typeof reimbursementStackSchema>;
