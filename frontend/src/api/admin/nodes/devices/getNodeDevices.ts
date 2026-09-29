import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminNodeDeviceSchema } from '@/lib/schemas/admin/nodes.ts';
import { parsePaginationFromApi } from '@/lib/serialization/api-transform.ts';

export default async (
  nodeUuid: string,
  page: number,
  search?: string,
): Promise<Pagination<z.infer<typeof adminNodeDeviceSchema>>> => {
  const { data } = await axiosInstance.get(`/api/admin/nodes/${nodeUuid}/devices`, {
    params: { page, search },
  });
  return parsePaginationFromApi(adminNodeDeviceSchema, data.devices);
};
