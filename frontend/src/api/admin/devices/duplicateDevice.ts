import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminDeviceSchema } from '@/lib/schemas/admin/devices.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (
  deviceUuid: string,
  name: string,
  source: string,
  target: string,
): Promise<z.infer<typeof adminDeviceSchema>> => {
  const { data } = await axiosInstance.post(`/api/admin/devices/${deviceUuid}/duplicate`, { name, source, target });
  return parseFromApi(adminDeviceSchema, data.device);
};
