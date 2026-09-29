import { axiosInstance } from '@/api/axios.ts';

export default async (nodeUuids: string[], config: object): Promise<{ applied: number; ignoredPaths: string[] }> => {
  const { data } = await axiosInstance.patch('/api/admin/nodes/config', {
    node_uuids: nodeUuids,
    config,
  });
  return { applied: data.applied, ignoredPaths: data.ignored_paths };
};
