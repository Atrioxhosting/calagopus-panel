import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverTrashEntrySchema } from '@/lib/schemas/server/files.ts';
import { parsePaginationFromApi } from '@/lib/serialization/api-transform.ts';

export default async (uuid: string, page: number): Promise<Pagination<z.infer<typeof serverTrashEntrySchema>>> => {
  const { data } = await axiosInstance.get(`/api/client/servers/${uuid}/files/trash`, {
    params: { page },
  });
  return parsePaginationFromApi(serverTrashEntrySchema, data.entries);
};
