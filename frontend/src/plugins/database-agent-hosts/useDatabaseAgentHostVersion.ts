import { z } from 'zod';
import getDatabaseAgentHostSystemOverview from '@/api/admin/database-agent-hosts/getDatabaseAgentHostSystemOverview.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminDatabaseAgentHostSchema } from '@/lib/schemas/admin/databaseAgentHosts.ts';
import { isOutdated } from '@/lib/version.ts';
import { useResource } from '@/plugins/resource/useResource.ts';
import { useAdminStore } from '@/stores/admin.tsx';

export function useDatabaseAgentHostUpdateAvailable(version: string | null | undefined): boolean {
  const updateInformation = useAdminStore((state) => state.updateInformation);

  if (!version || !updateInformation) {
    return false;
  }

  return isOutdated(updateInformation.latestDbAgentVersion, version);
}

interface UseDatabaseAgentHostVersionResult {
  version: string | null;
  unavailable: boolean;
  loading: boolean;
  updateAvailable: boolean;
}

export function useDatabaseAgentHostVersion(
  databaseAgentHost: z.infer<typeof adminDatabaseAgentHostSchema>,
  options?: { enabled?: boolean },
): UseDatabaseAgentHostVersionResult {
  const { data, error, loading } = useResource({
    queryKey: queryKeys.admin.databaseAgentHosts.systemOverview(databaseAgentHost.uuid),
    queryFn: () => getDatabaseAgentHostSystemOverview(databaseAgentHost.uuid),
    enabled: options?.enabled ?? true,
    silent: true,
  });

  const version = data?.version ?? null;

  return {
    version,
    unavailable: !!error,
    loading: loading && data === undefined && !error,
    updateAvailable: useDatabaseAgentHostUpdateAvailable(version),
  };
}
