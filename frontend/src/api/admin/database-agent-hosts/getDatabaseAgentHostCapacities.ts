import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminDatabaseAgentHostCapacitiesSchema } from '@/lib/schemas/admin/databaseAgentHosts.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (): Promise<z.infer<typeof adminDatabaseAgentHostCapacitiesSchema>> => {
  const { data } = await axiosInstance.get('/api/admin/database-agent-hosts/capacities');
  return parseFromApi(adminDatabaseAgentHostCapacitiesSchema, data.allocated);
};
