import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminDeviceUpdateSchema } from '@/lib/schemas/admin/devices.ts';
import { formExtensionSchemas, serializeForApi } from '@/lib/serialization/api-transform.ts';

export default async (deviceUuid: string, data: z.infer<typeof adminDeviceUpdateSchema>): Promise<void> => {
  await axiosInstance.patch(
    `/api/admin/devices/${deviceUuid}`,
    serializeForApi(adminDeviceUpdateSchema, data, formExtensionSchemas('admin.devices.createOrUpdate')),
  );
};
