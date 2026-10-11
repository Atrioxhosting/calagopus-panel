import { z } from 'zod';
import { ruleMessage } from '@/lib/schemas/rules.ts';
import { nullableString } from '@/lib/serialization/transformers.ts';

export const adminDeviceSchema = z.looseObject({
  uuid: z.string(),
  name: z.string().min(1).max(255),
  description: z.preprocess(nullableString, z.string().max(1024).nullable()),
  source: z.string().min(1).max(255),
  target: z.string().min(1).max(255),
  permissions: z
    .string()
    .min(1)
    .max(255)
    .regex(
      /^[rwm]+$/,
      ruleMessage((t) => t('common.form.rule.devicePermissions', {})),
    ),
  userAttachable: z.boolean(),
  created: z.coerce.date(),
});

export const adminDeviceUpdateSchema = z.lazy(() =>
  adminDeviceSchema.omit({
    uuid: true,
    created: true,
  }),
);
