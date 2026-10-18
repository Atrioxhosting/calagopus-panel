import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminEggSchema } from '@/lib/schemas/admin/eggs.ts';
import { adminNestSchema } from '@/lib/schemas/admin/nests.ts';
import { parsePaginationFromApi } from '@/lib/serialization/api-transform.ts';

export const adminEggWithNestSchema = z.object({
  egg: adminEggSchema,
  nest: adminNestSchema,
});

export default async (
  nestUuid: string | null,
  page: number,
  search?: string,
): Promise<Pagination<z.infer<typeof adminEggWithNestSchema>>> => {
  const { data } = await axiosInstance.get('/api/admin/eggs', {
    params: { page, search, nest_uuid: nestUuid ?? undefined },
  });
  return parsePaginationFromApi(adminEggWithNestSchema, data.eggs);
};
