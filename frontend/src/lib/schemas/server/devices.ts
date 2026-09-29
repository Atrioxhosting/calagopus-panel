import { z } from 'zod';

export const serverDeviceSchema = z.looseObject({
  uuid: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  permissions: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[rwm]+$/),
  target: z.string(),
  created: z.coerce.date().nullable(),
});
