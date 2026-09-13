import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminNodeCapacitiesSchema } from '@/lib/schemas/admin/nodes.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (): Promise<z.infer<typeof adminNodeCapacitiesSchema>> => {
  const { data } = await axiosInstance.get('/api/admin/nodes/capacities');
  return parseFromApi(adminNodeCapacitiesSchema, data.allocated);
};
