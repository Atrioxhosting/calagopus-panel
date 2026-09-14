import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import {
  serverDirectoryEntrySchema,
  serverDirectorySortingModeSchema,
  serverDirectoryUploadSchema,
} from '@/lib/schemas/server/files.ts';
import { parseFromApi, parsePaginationFromApi } from '@/lib/serialization/api-transform.ts';

export interface DirectoryResponse {
  directory: string;
  isFilesystemPrimary: boolean;
  isFilesystemWritable: boolean;
  isFilesystemFast: boolean;
  entries: Pagination<z.infer<typeof serverDirectoryEntrySchema>>;
  uploads: z.infer<typeof serverDirectoryUploadSchema>[];
}

export default async (
  uuid: string,
  directory: string,
  page: number,
  sort: z.infer<typeof serverDirectorySortingModeSchema>,
): Promise<DirectoryResponse> => {
  const root = directory ?? '/';
  const { data } = await axiosInstance.get(`/api/client/servers/${uuid}/files/list`, {
    params: { directory: root, page, per_page: 100, sort },
  });
  return {
    directory: root,
    isFilesystemPrimary: data.is_filesystem_primary,
    isFilesystemWritable: data.is_filesystem_writable,
    isFilesystemFast: data.is_filesystem_fast,
    entries: parsePaginationFromApi(serverDirectoryEntrySchema, data.entries),
    uploads: data.uploads.map((item: unknown) => parseFromApi(serverDirectoryUploadSchema, item)),
  };
};
