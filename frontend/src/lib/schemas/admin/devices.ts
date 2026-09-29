import { z } from 'zod';
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
    .regex(/^[rwm]+$/),
  userAttachable: z.boolean(),
  created: z.coerce.date(),
});

export const adminDeviceUpdateSchema = z.lazy(() =>
  adminDeviceSchema.omit({
    uuid: true,
    created: true,
  }),
);
