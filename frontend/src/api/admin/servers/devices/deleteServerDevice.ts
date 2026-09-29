import { axiosInstance } from '@/api/axios.ts';

export default async (serverUuid: string, deviceUuid: string): Promise<void> => {
  await axiosInstance.delete(`/api/admin/servers/${serverUuid}/devices/${deviceUuid}`);
};
