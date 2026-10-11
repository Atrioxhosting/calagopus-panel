import { ZodType, z } from 'zod';
import { nullableString } from '@/lib/serialization/transformers.ts';
import { eggConfigurationRouteItemSchema } from '../generic.ts';

export const adminEggConfigurationDeploymentRandomSchema = z.object({
  type: z.literal('random'),
});

export const adminEggConfigurationDeploymentRangeSchema = z.object({
  type: z.literal('range'),
  endPort: z.number().min(1).max(65535),
  startPort: z.number().min(1).max(65535),
});

export const adminEggConfigurationDeploymentAddPrimarySchema = z.object({
  type: z.literal('add_primary'),
  value: z.number().min(0),
});

export const adminEggConfigurationDeploymentSubtractPrimarySchema = z.object({
  type: z.literal('subtract_primary'),
  value: z.number().min(0),
});

export const adminEggConfigurationDeploymentMultiplyPrimarySchema = z.object({
  type: z.literal('multiply_primary'),
  value: z.number(),
});

export const adminEggConfigurationDeploymentDividePrimarySchema = z.object({
  type: z.literal('divide_primary'),
  value: z.number(),
});

export interface EggConfigurationDeployment {
  mode:
    | z.infer<typeof adminEggConfigurationDeploymentRandomSchema>
    | z.infer<typeof adminEggConfigurationDeploymentRangeSchema>
    | z.infer<typeof adminEggConfigurationDeploymentAddPrimarySchema>
    | z.infer<typeof adminEggConfigurationDeploymentSubtractPrimarySchema>
    | z.infer<typeof adminEggConfigurationDeploymentMultiplyPrimarySchema>
    | z.infer<typeof adminEggConfigurationDeploymentDividePrimarySchema>;
  assignToVariable: string | null;
}

export const adminEggConfigurationDeploymentSchema: ZodType<EggConfigurationDeployment> = z.lazy(() =>
  z.object({
    mode: z.discriminatedUnion('type', [
      adminEggConfigurationDeploymentRandomSchema,
      adminEggConfigurationDeploymentRangeSchema,
      adminEggConfigurationDeploymentAddPrimarySchema,
      adminEggConfigurationDeploymentSubtractPrimarySchema,
      adminEggConfigurationDeploymentMultiplyPrimarySchema,
      adminEggConfigurationDeploymentDividePrimarySchema,
    ]),
    assignToVariable: z.preprocess(nullableString, z.string().max(255).nullable()),
  }),
);

export const adminEggConfigurationMatcherNeverSchema = z.object({
  type: z.literal('never'),
});

export const adminEggConfigurationMatcherAllSchema = z.object({
  type: z.literal('all'),
});

export const adminEggConfigurationMatcherEggsSchema = z.object({
  type: z.literal('eggs'),
  eggs: z.array(z.uuid()).max(100),
});

export const adminEggConfigurationMatcherNestsSchema = z.object({
  type: z.literal('nests'),
  nests: z.array(z.uuid()).max(100),
});

export const adminEggConfigurationMatcherNodesSchema = z.object({
  type: z.literal('nodes'),
  nodes: z.array(z.uuid()).max(100),
});

export const adminEggConfigurationMatcherLocationsSchema = z.object({
  type: z.literal('locations'),
  locations: z.array(z.uuid()).max(100),
});

export type AdminEggConfigurationMatcher =
  | z.infer<typeof adminEggConfigurationMatcherNeverSchema>
  | z.infer<typeof adminEggConfigurationMatcherAllSchema>
  | {
      type: 'and' | 'or';
      matchers: AdminEggConfigurationMatcher[];
    }
  | {
      type: 'not';
      matcher: AdminEggConfigurationMatcher;
    }
  | z.infer<typeof adminEggConfigurationMatcherEggsSchema>
  | z.infer<typeof adminEggConfigurationMatcherNestsSchema>
  | z.infer<typeof adminEggConfigurationMatcherNodesSchema>
  | z.infer<typeof adminEggConfigurationMatcherLocationsSchema>;

export const adminEggConfigurationMatcherSchema: ZodType<AdminEggConfigurationMatcher> = z.lazy(() =>
  z.discriminatedUnion('type', [
    adminEggConfigurationMatcherNeverSchema,
    adminEggConfigurationMatcherAllSchema,

    z.object({
      type: z.literal('and'),
      matchers: z.array(adminEggConfigurationMatcherSchema),
    }),
    z.object({
      type: z.literal('or'),
      matchers: z.array(adminEggConfigurationMatcherSchema),
    }),
    z.object({
      type: z.literal('not'),
      matcher: adminEggConfigurationMatcherSchema,
    }),

    adminEggConfigurationMatcherEggsSchema,
    adminEggConfigurationMatcherNestsSchema,
    adminEggConfigurationMatcherNodesSchema,
    adminEggConfigurationMatcherLocationsSchema,
  ]),
);

export const adminEggConfigurationSchema = z.looseObject({
  uuid: z.string(),
  name: z.string().min(1).max(255),
  description: z.preprocess(nullableString, z.string().max(1024).nullable()),
  order: z.number().min(0),
  matcher: adminEggConfigurationMatcherSchema,
  configAllocations: z
    .object({
      deployment: z.object({
        additional: z.lazy(() => z.array(adminEggConfigurationDeploymentSchema)),
        dedicated: z.boolean(),
        primary: z
          .object({
            endPort: z.number().min(1).max(65535),
            startPort: z.number().min(1).max(65535),
            assignToVariable: z.preprocess(nullableString, z.string().max(255).nullable()),
          })
          .nullable(),
      }),
      userSelfAssign: z.object({
        enabled: z.boolean(),
        requirePrimaryAllocation: z.boolean(),
        startPort: z.number().min(1).max(65535),
        endPort: z.number().min(1).max(65535),
      }),
    })
    .nullable(),
  configStartup: z
    .object({
      allowCustomStartupCommand: z.boolean(),
    })
    .nullable(),
  configRoutes: z
    .object({
      order: z.array(eggConfigurationRouteItemSchema),
    })
    .nullable(),
  configFeatures: z
    .object({
      firewall: z.boolean().nullable(),
      privateNetwork: z.boolean().nullable(),
    })
    .nullable(),
  created: z.coerce.date(),
});

export const adminEggConfigurationUpdateSchema = z.lazy(() =>
  adminEggConfigurationSchema.omit({
    uuid: true,
    created: true,
  }),
);

export type AdminEggConfiguration = z.infer<typeof adminEggConfigurationSchema>;
