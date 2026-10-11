import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import {
  adminBackupConfigurationTestResultSchema,
  adminBackupConfigurationTestSchema,
} from '@/lib/schemas/admin/backupConfigurations.ts';
import { parseFromApi, serializeForApi } from '@/lib/serialization/api-transform.ts';

export default async (
  testData: z.infer<typeof adminBackupConfigurationTestSchema>,
): Promise<z.infer<typeof adminBackupConfigurationTestResultSchema>> => {
  const { data } = await axiosInstance.post(
    '/api/admin/backup-configurations/test',
    serializeForApi(adminBackupConfigurationTestSchema, testData),
  );
  return parseFromApi(adminBackupConfigurationTestResultSchema, data);
};
