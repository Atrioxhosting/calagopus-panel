import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { userApiKeySchema } from '@/lib/schemas/user/apiKeys.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

const duplicateApiKeyResponseSchema = z.object({
  apiKey: userApiKeySchema,
  key: z.string(),
});

export default async (apiKeyUuid: string, name: string): Promise<z.infer<typeof duplicateApiKeyResponseSchema>> => {
  const { data } = await axiosInstance.post(`/api/client/account/api-keys/${apiKeyUuid}/duplicate`, { name });
  return parseFromApi(duplicateApiKeyResponseSchema, data);
};
