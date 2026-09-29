import { axiosInstance } from '@/api/axios.ts';

export default async (uuid: string, deviceUuid: string): Promise<void> => {
  await axiosInstance.delete(`/api/client/servers/${uuid}/devices/${deviceUuid}`);
};
