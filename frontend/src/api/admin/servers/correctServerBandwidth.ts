import { axiosInstance } from '@/api/axios.ts';

export default async function correctServerBandwidth(uuid: string, id: string, deltaBytes: number): Promise<void> {
  await axiosInstance.post(`/api/admin/servers/${uuid}/bandwidth/correction`, {
    id,
    delta_bytes: deltaBytes,
  });
}
