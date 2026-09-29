import { axiosInstance } from '@/api/axios.ts';

export default async (nodeUuid: string): Promise<string[]> => {
  const { data } = await axiosInstance.get(`/api/admin/nodes/${nodeUuid}/system/ips`);
  return data.ips;
};
