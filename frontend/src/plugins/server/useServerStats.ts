import { useEffect } from 'react';
import { z } from 'zod';
import { adminServerSchema } from '@/lib/schemas/admin/servers.ts';
import { serverSchema } from '@/lib/schemas/server/server.ts';
import { useUserStore } from '@/stores/user.ts';

type StatsServer = z.infer<typeof adminServerSchema> | z.infer<typeof serverSchema>;

function serverNodeUuid(server: StatsServer): string | undefined {
  return ('nodeUuid' in server ? server.nodeUuid : server.node?.uuid) as string | undefined;
}

export function useServerStats(server: StatsServer) {
  const subscribeToNode = useUserStore((state) => state.subscribeToNode);
  const nodeUuid = serverNodeUuid(server);

  const stats = useUserStore((state) => state.serverResourceUsage[server.uuid] ?? null);

  useEffect(() => {
    if (!nodeUuid) return;
    return subscribeToNode(nodeUuid);
  }, [nodeUuid, subscribeToNode]);

  return stats;
}

export function useServerStatsUnavailable(server: StatsServer) {
  const nodeUuid = serverNodeUuid(server);

  return useUserStore((state) => !!nodeUuid && nodeUuid in state.failedResourceNodes);
}
