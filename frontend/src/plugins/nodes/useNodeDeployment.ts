import getNodeCapacities from '@/api/admin/nodes/getNodeCapacities.ts';
import { getNodeDeploymentState, getNodeDeploymentUsage, NodeDeploymentState } from '@/lib/domain/node.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { AdminNode } from '@/lib/schemas/admin/nodes.ts';
import { useResource } from '@/plugins/resource/useResource.ts';

interface UseNodeDeploymentResult {
  state: NodeDeploymentState;
  usage: ReturnType<typeof getNodeDeploymentUsage> | null;
}

export function useNodeDeployment(node: AdminNode): UseNodeDeploymentResult {
  const { data } = useResource({
    queryKey: queryKeys.admin.nodes.capacities(),
    queryFn: getNodeCapacities,
    silent: true,
  });

  const allocated = data?.[node.uuid];

  return {
    state: getNodeDeploymentState(node, allocated),
    usage: allocated ? getNodeDeploymentUsage(node, allocated) : null,
  };
}
