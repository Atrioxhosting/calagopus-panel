import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminDeviceSchema, adminDeviceUpdateSchema } from '@/lib/schemas/admin/devices.ts';
import { formExtensionSchemas, parseFromApi, serializeForApi } from '@/lib/serialization/api-transform.ts';

export default async (
  deviceData: z.infer<typeof adminDeviceUpdateSchema>,
): Promise<z.infer<typeof adminDeviceSchema>> => {
  const { data } = await axiosInstance.post(
    '/api/admin/devices',
    serializeForApi(adminDeviceUpdateSchema, deviceData, formExtensionSchemas('admin.devices.createOrUpdate')),
  );
  return parseFromApi(adminDeviceSchema, data.device);
};
