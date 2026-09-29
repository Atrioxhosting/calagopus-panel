import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverBackupSelectorSchema } from '@/lib/schemas/server/backups.ts';
import { serializeForApi } from '@/lib/serialization/api-transform.ts';

const deleteBackupsSchema = z.object({
  selector: serverBackupSelectorSchema,
});

export default async (
  uuid: string,
  selector: z.infer<typeof serverBackupSelectorSchema>,
): Promise<{ queued: number; skipped: number }> => {
  const { data } = await axiosInstance.delete(`/api/client/servers/${uuid}/backups`, {
    data: serializeForApi(deleteBackupsSchema, { selector }),
  });
  return data;
};
