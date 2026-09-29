import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminDeviceSchema } from '@/lib/schemas/admin/devices.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (deviceUuid: string): Promise<z.infer<typeof adminDeviceSchema>> => {
  const { data } = await axiosInstance.get(`/api/admin/devices/${deviceUuid}`);
  return parseFromApi(adminDeviceSchema, data.device);
};
