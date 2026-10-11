import { z } from 'zod';
import getDatabaseAgentHostCapacities from '@/api/admin/database-agent-hosts/getDatabaseAgentHostCapacities.ts';
import {
  DatabaseAgentHostDeploymentState,
  getDatabaseAgentHostDeploymentState,
  getDatabaseAgentHostDeploymentUsage,
} from '@/lib/domain/databaseAgentHost.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminDatabaseAgentHostSchema } from '@/lib/schemas/admin/databaseAgentHosts.ts';
import { useResource } from '@/plugins/resource/useResource.ts';

interface UseDatabaseAgentHostDeploymentResult {
  state: DatabaseAgentHostDeploymentState;
  usage: ReturnType<typeof getDatabaseAgentHostDeploymentUsage> | null;
  loading: boolean;
}

export function useDatabaseAgentHostDeployment(
  databaseAgentHost: z.infer<typeof adminDatabaseAgentHostSchema>,
): UseDatabaseAgentHostDeploymentResult {
  const { data, loading } = useResource({
    queryKey: queryKeys.admin.databaseAgentHosts.capacities(),
    queryFn: getDatabaseAgentHostCapacities,
    silent: true,
  });

  const allocated = data?.[databaseAgentHost.uuid];
  const state = getDatabaseAgentHostDeploymentState(databaseAgentHost, allocated);

  return {
    state,
    usage: allocated ? getDatabaseAgentHostDeploymentUsage(databaseAgentHost, allocated) : null,
    loading: loading && data === undefined && state === 'available',
  };
}
