import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminEggRepositoryCatalogEggSchema } from '@/lib/schemas/admin/eggRepositories.ts';
import { parsePaginationFromApi } from '@/lib/serialization/api-transform.ts';

export default async (
  page: number,
  search?: string,
): Promise<Pagination<z.infer<typeof adminEggRepositoryCatalogEggSchema>>> => {
  const { data } = await axiosInstance.get('/api/admin/egg-repositories/eggs', {
    params: { page, search },
  });
  return parsePaginationFromApi(adminEggRepositoryCatalogEggSchema, data.egg_repository_eggs);
};
