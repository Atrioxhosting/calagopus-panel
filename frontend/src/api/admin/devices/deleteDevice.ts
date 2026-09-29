import { axiosInstance } from '@/api/axios.ts';

export default async (deviceUuid: string): Promise<void> => {
  await axiosInstance.delete(`/api/admin/devices/${deviceUuid}`);
};
