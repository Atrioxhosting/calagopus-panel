import { axiosInstance } from '@/api/axios.ts';

export default async (hostUuid: string): Promise<{ config: object; lockedPaths: string[] }> => {
  const { data } = await axiosInstance.get(`/api/admin/database-agent-hosts/${hostUuid}/config`);
  return { config: data.config, lockedPaths: data.locked_paths };
};
