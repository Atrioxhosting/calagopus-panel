import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import { adminOAuthProviderDiscoverySchema } from '@/lib/schemas/admin/oauthProviders.ts';
import { parseFromApi } from '@/lib/serialization/api-transform.ts';

export default async (url: string): Promise<z.infer<typeof adminOAuthProviderDiscoverySchema>> => {
  const { data } = await axiosInstance.post('/api/admin/oauth-providers/discover', { url });
  return parseFromApi(adminOAuthProviderDiscoverySchema, data.oauth_provider);
};
