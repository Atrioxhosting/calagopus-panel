import { axiosInstance } from '@/api/axios.ts';

export default async (nodeUuid: string): Promise<{ config: object; lockedPaths: string[] }> => {
  const { data } = await axiosInstance.get(`/api/admin/nodes/${nodeUuid}/config`);
  return { config: data.config, lockedPaths: data.locked_paths };
};
