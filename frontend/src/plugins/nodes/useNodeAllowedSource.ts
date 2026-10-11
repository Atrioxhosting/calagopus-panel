import getNodeDeviceAllowed from '@/api/admin/nodes/devices/getNodeDeviceAllowed.ts';
import getNodeMountAllowed from '@/api/admin/nodes/mounts/getNodeMountAllowed.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { useResource } from '@/plugins/resource/useResource.ts';

export type NodeAllowedSourceKind = 'mount' | 'device';

interface UseNodeAllowedSourceResult {
  allowed: boolean | null;
  loading: boolean;
}

export function useNodeAllowedSource(
  nodeUuid: string,
  kind: NodeAllowedSourceKind,
  uuid: string | null,
): UseNodeAllowedSourceResult {
  const { data, loading } = useResource({
    queryKey:
      kind === 'mount'
        ? queryKeys.admin.nodes.mountAllowed(nodeUuid, uuid ?? '')
        : queryKeys.admin.nodes.deviceAllowed(nodeUuid, uuid ?? ''),
    queryFn: () => (kind === 'mount' ? getNodeMountAllowed(nodeUuid, uuid!) : getNodeDeviceAllowed(nodeUuid, uuid!)),
    enabled: uuid !== null,
    silent: true,
  });

  return {
    allowed: data ?? null,
    loading: loading && data === undefined,
  };
}
