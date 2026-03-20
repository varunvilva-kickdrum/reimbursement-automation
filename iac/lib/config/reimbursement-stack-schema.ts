import { z } from 'zod';

/**
 * Runtime validation for merged `reimbursementStackConfig.json` (strict: rejects unknown top-level keys).
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
            timeout: z.number().optional(),
            memorySize: z.number().optional(),
            enabled: z.boolean().optional(),
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
            z.object({
              id: z.string().min(1),
              enabled: z.boolean(),
              scheduleExpression: z.string().min(1),
              targetType: z.enum(['LAMBDA', 'STEP_FUNCTION']),
              lambdaFunctionName: z.string().optional(),
              stateMachineName: z.string().optional(),
            })
          )
          .optional()
          .default([]),
      })
      .optional(),
    tags: z.record(z.string(), z.string()).optional(),
  })
  .strict();

export type ReimbursementStackConfigValidated = z.infer<typeof reimbursementStackSchema>;
