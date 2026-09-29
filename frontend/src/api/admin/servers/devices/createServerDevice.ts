import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serializeForApi } from '@/lib/serialization/api-transform.ts';

const createServerDeviceSchema = z.object({
  deviceUuid: z.string(),
});

export default async (serverUuid: string, deviceData: z.infer<typeof createServerDeviceSchema>): Promise<void> => {
  await axiosInstance.post(
    `/api/admin/servers/${serverUuid}/devices`,
    serializeForApi(createServerDeviceSchema, deviceData),
  );
};
