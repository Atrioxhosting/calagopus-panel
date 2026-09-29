import { axiosInstance } from '@/api/axios.ts';

export default async (nodeUuid: string, deviceUuid: string): Promise<void> => {
  await axiosInstance.post(`/api/admin/nodes/${nodeUuid}/devices`, {
    device_uuid: deviceUuid,
  });
};
