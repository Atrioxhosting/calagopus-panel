import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminEggSchema } from '@/lib/schemas/admin/eggs.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (
  eggRepositoryUuid: string,
  eggRepositoryEggUuid: string,
  nestUuid: string | null,
): Promise<{ egg: z.infer<typeof adminEggSchema>; created: boolean }> => {
  const { data } = await axiosInstance.post(
    `/api/admin/egg-repositories/${eggRepositoryUuid}/eggs/${eggRepositoryEggUuid}/install`,
    {
      nest_uuid: nestUuid,
    },
  );
  return { egg: parseFromApi(adminEggSchema, data.egg), created: data.created };
};
