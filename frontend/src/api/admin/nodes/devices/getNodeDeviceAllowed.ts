import { axiosInstance } from '@/api/axios.ts';

export default async (nodeUuid: string, deviceUuid: string): Promise<boolean | null> => {
  const { data } = await axiosInstance.get(`/api/admin/nodes/${nodeUuid}/devices/${deviceUuid}/allowed`);
  return data.allowed;
};
