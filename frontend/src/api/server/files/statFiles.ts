import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverDirectoryEntrySchema } from '@/lib/schemas/server/files.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

const statFilesResponseSchema = z.object({
  entries: serverDirectoryEntrySchema.array(),
});

export default async (
  uuid: string,
  root: string,
  files: string[],
): Promise<z.infer<typeof serverDirectoryEntrySchema>[]> => {
  const { data } = await axiosInstance.post(`/api/client/servers/${uuid}/files/stat`, { root, files });
  return parseFromApi(statFilesResponseSchema, data).entries;
};
