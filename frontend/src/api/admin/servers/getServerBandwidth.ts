import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export const adminBandwidthSchema = z.object({
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  periodId: z.string(),
  rxBytes: z.number(),
  txBytes: z.number(),
  usedBytes: z.number(),
  quotaBytes: z.number().nullable(),
  bandwidthPerGib: z.number(),
  state: z.string(),
  resumeAfterQuota: z.boolean(),
  generation: z.number(),
  lastCheckpoint: z.coerce.date(),
});

export default async function getServerBandwidth(uuid: string): Promise<z.infer<typeof adminBandwidthSchema>> {
  const { data } = await axiosInstance.get(`/api/admin/servers/${uuid}/bandwidth`);
  return parseFromApi(adminBandwidthSchema, data);
}
