import { axiosInstance } from '@/api/axios.ts';

export default async (nestUuid: string, eggUuid: string, deviceUuid: string): Promise<void> => {
  await axiosInstance.post(`/api/admin/nests/${nestUuid}/eggs/${eggUuid}/devices`, {
    device_uuid: deviceUuid,
  });
};
