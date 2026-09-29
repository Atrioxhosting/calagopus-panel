import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverBackupSelectorSchema } from '@/lib/schemas/server/backups.ts';
import { serializeForApi } from '@/lib/serialization/api-transform.ts';

const updateBackupsSchema = z.object({
  selector: serverBackupSelectorSchema,
  backupGroupUuid: z.uuid().nullable().optional(),
  locked: z.boolean().optional(),
});

export default async (
  uuid: string,
  data: z.infer<typeof updateBackupsSchema>,
): Promise<{ updated: number; skipped: number }> => {
  const { data: response } = await axiosInstance.patch(
    `/api/client/servers/${uuid}/backups`,
    serializeForApi(updateBackupsSchema, data),
  );
  return response;
};
