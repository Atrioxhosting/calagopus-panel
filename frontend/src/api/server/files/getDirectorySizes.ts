import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { serverDirectorySizesSchema } from '@/lib/schemas/server/files.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (
  uuid: string,
  directory: string,
  depth?: number,
): Promise<z.infer<typeof serverDirectorySizesSchema>> => {
  const { data } = await axiosInstance.get(`/api/client/servers/${uuid}/files/directory-sizes`, {
    params: { directory, depth },
  });
  return parseFromApi(serverDirectorySizesSchema, data.directory_sizes);
};
