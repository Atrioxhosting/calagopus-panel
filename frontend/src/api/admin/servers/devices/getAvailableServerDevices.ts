import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminServerDeviceSchema } from '@/lib/schemas/admin/servers.ts';
import { parsePaginationFromApi } from '@/lib/serialization/api-transform.ts';

export default async (
  serverUuid: string,
  page: number,
  search?: string,
): Promise<Pagination<z.infer<typeof adminServerDeviceSchema>>> => {
  const { data } = await axiosInstance.get(`/api/admin/servers/${serverUuid}/devices/available`, {
    params: { page, per_page: 100, search },
  });
  return parsePaginationFromApi(adminServerDeviceSchema, data.devices);
};
