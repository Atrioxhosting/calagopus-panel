import { axiosInstance } from '@/api/axios.ts';

export default async (uuid: string, deviceUuid: string): Promise<void> => {
  await axiosInstance.post(`/api/client/servers/${uuid}/devices`, {
    device_uuid: deviceUuid,
  });
};
