import { axiosInstance } from '@/api/axios.ts';

export default async (nodeUuid: string, mountUuid: string): Promise<boolean | null> => {
  const { data } = await axiosInstance.get(`/api/admin/nodes/${nodeUuid}/mounts/${mountUuid}/allowed`);
  return data.allowed;
};
